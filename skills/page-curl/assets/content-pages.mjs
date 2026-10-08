/** Static document pages for the WebGL curl. No imported script is executed. */
export function validatePage(page) {
  if(typeof page==='string' && page)return;
  if(!page || typeof page!=='object' || Array.isArray(page))throw new TypeError('Each page must be a URL or a content descriptor');
  if(!['image','html','markdown','svg','pdf','blank'].includes(page.type))throw new Error(`Unsupported page type: ${page.type}`);
  for(const key of Object.keys(page))if(!['type','src','content','css','baseURL','page','pages','width','height','scale','background','fit'].includes(key))throw new Error(`Unknown page option: ${key}`);
  if(page.type!=='blank' && !(typeof page.src==='string' && page.src) && !(typeof page.content==='string' && page.content))throw new Error(`${page.type} page requires src or content`);
  if(page.src!==undefined && page.content!==undefined)throw new Error('Use src or content, not both');
  if(['image','pdf'].includes(page.type) && !page.src)throw new Error(`${page.type} requires src`);
  if(page.page!==undefined && (page.type!=='pdf'||!Number.isInteger(page.page)||page.page<1))throw new Error('PDF page is a positive one-based integer');
  if(page.pages!==undefined && (page.type!=='pdf'||page.page!==undefined||!Array.isArray(page.pages)||!page.pages.length||page.pages.some(n=>!Number.isInteger(n)||n<1)))throw new Error('PDF pages must be a nonempty list of positive page numbers');
  for(const key of ['width','height'])if(page[key]!==undefined && (!Number.isInteger(page[key])||page[key]<1||page[key]>4096))throw new Error(`${key} must be an integer from 1 to 4096`);
  if(page.scale!==undefined && (!Number.isFinite(page.scale)||page.scale<=0||page.scale>4))throw new Error('scale must be greater than zero and at most four');
  for(const key of ['css','background','baseURL'])if(page[key]!==undefined && typeof page[key]!=='string')throw new TypeError(`${key} must be a string`);
  if(page.fit!==undefined && !['contain','cover'].includes(page.fit))throw new Error('fit must be contain or cover');
  if((page.width??800)*(page.scale??1)>4096 || (page.height??1102)*(page.scale??1)>4096)throw new Error('Rendered page dimensions must not exceed 4096 pixels');
}
const cancelled=()=>Object.assign(new Error('Page content loading cancelled'),{name:'AbortError'});
function active(signal){if(signal?.aborted)throw cancelled();}
async function withAbort(promise,signal){
  active(signal);if(!signal)return promise;
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(cancelled());signal.addEventListener('abort',cancel,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
    if(signal.aborted)cancel();
  });
}
async function textSource(page,env,signal){
  if(page.content!==undefined)return page.content;
  const response=await env.fetch(page.src,{signal});if(!response.ok)throw new Error(`Content request failed (${response.status}): ${page.src}`);
  return response.text();
}
async function pdfDocument(src,signal){
  active(signal);
  const pdf=await import('./vendor/pdf.mjs');active(signal);
  // Works in a component bundle and in the generator's embedded offline module graph.
  pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
  const task=pdf.getDocument({url:src,isEvalSupported:false,useWasm:false,useSystemFonts:true,useWorkerFetch:false});
  const cancel=()=>{void task.destroy().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
  try{const document=await withAbort(task.promise,signal);return {document,destroy:()=>task.destroy()};}
  catch(error){await task.destroy().catch(()=>{});throw error;}
  finally{signal?.removeEventListener('abort',cancel);}
}
/** Expand all PDF pages or selected page numbers; split HTML/Markdown at <!-- pagebreak -->.
 * An odd document ends with blank paper. Image-only lists retain their original even-count contract.
 */
export async function preparePages(pages,{environment=globalThis,signal}={}){
  if(!Array.isArray(pages))throw new TypeError('pages must be an array');
  const result=[];let documents=false;
  for(const page of pages){
    active(signal);validatePage(page);
    if(typeof page==='string'||page.type==='image'||page.type==='blank'){result.push(page);continue;}
    documents=true;
    if(page.type==='pdf'){
      const source=await pdfDocument(page.src,signal);
      try{
        const numbers=page.pages??(page.page!==undefined?[page.page]:Array.from({length:source.document.numPages},(_,i)=>i+1));
        for(const number of numbers){if(number>source.document.numPages)throw new Error(`PDF page ${number} exceeds ${source.document.numPages} pages`);
          const {pages:unused,...base}=page;result.push({...base,page:number});}
      }finally{await source.destroy();}
    }else{
      const content=await textSource(page,environment,signal);active(signal);
      const parts=['html','markdown'].includes(page.type)?content.split(/<!--\s*pagebreak\s*-->/i):[content];
      const {src:unused,...base}=page;
      if(page.src && !page.src.startsWith('data:'))base.baseURL=new URL(page.src,environment.document?.baseURI??'http://localhost/').href;
      result.push(...parts.map(content=>({...base,content})));
    }
  }
  if(documents && result.length%2)result.push({type:'blank'});
  active(signal);return result;
}
const defaultCSS=`*{box-sizing:border-box}body{margin:0;color:#20201e;font:24px/1.5 Georgia,serif}main{padding:56px;height:100%;overflow:hidden}h1{font-size:64px;line-height:1.05;margin:0 0 32px}h2{font-size:38px;line-height:1.15}p,ul,ol{margin:0 0 24px}img,svg{max-width:100%}pre,code{font-family:monospace}pre{white-space:pre-wrap;font-size:18px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccc;padding:8px;text-align:left}blockquote{border-left:3px solid #aaa;margin:24px 0;padding-left:24px}`;
async function htmlCanvas(page,content,{env,scope},canvas){
  const [{default:createPurify},{default:html2canvas}]=await Promise.all([import('./vendor/purify.mjs'),import('./vendor/html2canvas.mjs')]);
  const doc=env.document,view=doc.defaultView,signal=scope.controller.signal;scope.assertActive();
  const purify=createPurify(view);
  if(page.type==='markdown'){const {marked}=await import('./vendor/marked.mjs');content=marked.parse(content,{async:false,gfm:true});}
  const clean=purify.sanitize(content,{WHOLE_DOCUMENT:true,FORBID_TAGS:['script','iframe','object','embed','form','input','button','link','base','meta']});
  const parsed=new view.DOMParser().parseFromString(clean,'text/html');
  const styles=[...parsed.querySelectorAll('style')].map(style=>style.textContent).join('\n');
  parsed.querySelectorAll('style').forEach(style=>style.remove());
  const frame=doc.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.setAttribute('aria-hidden','true');
  frame.style.cssText=`position:fixed;left:-100000px;top:0;border:0;width:${page.width}px;height:${page.height}px;pointer-events:none;`;
  scope.add(()=>frame.remove());
  const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(new Error('HTML content frame failed to load'));});
  // CSP blocks execution even if the sanitizer or a caller supplies executable CSS/markup.
  const baseURL=page.baseURL??(page.src && !page.src.startsWith('data:')?new URL(page.src,doc.baseURI).href:doc.baseURI);
  const escapedBase=baseURL.replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
  frame.srcdoc=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob: https: http:; font-src data: https: http:"><base href="${escapedBase}"><style>${defaultCSS}\n${(styles+'\n'+(page.css??'')).replace(/<\/style/gi,'<\\/style')}</style></head><body><main>${parsed.body.innerHTML}</main></body></html>`;
  doc.body.append(frame);await withAbort(loaded,signal);scope.assertActive();
  const inner=frame.contentDocument;inner.body.style.height=page.height+'px';await withAbort(inner.fonts.ready,signal);
  await withAbort(Promise.all([...inner.images].map(image=>image.decode())),signal);scope.assertActive();
  try{
    await withAbort(html2canvas(inner.body,{canvas,width:page.width,height:page.height,scale:page.scale,backgroundColor:page.background,logging:false,useCORS:true,allowTaint:false,removeContainer:true,windowWidth:page.width,windowHeight:page.height}),signal);
    // Detect long content instead of silently losing text beyond the page.
    const main=inner.querySelector('main');if(main.scrollHeight>main.clientHeight+2)throw new Error('HTML/Markdown page overflows: split content with <!-- pagebreak --> or adjust its layout');
  }finally{frame.remove();}
}
function fitImage(context,image,width,height,fit){
  const factor=(fit==='cover'?Math.max:Math.min)(width/image.width,height/image.height),w=image.width*factor,h=image.height*factor;
  context.drawImage(image,(width-w)/2,(height-h)/2,w,h);
}
/** Render one finalized page. context is scoped to one mount and owns cached PDF tasks. */
export async function renderPage(source,context){
  validatePage(source);const {env,scope}=context,signal=scope.controller.signal;
  const page={width:800,height:1102,scale:Math.min(env.devicePixelRatio??1,2),background:'#fff',fit:'contain',...source};
  page.scale=Math.min(page.scale,4096/page.width,4096/page.height);scope.assertActive();
  const canvas=env.createCanvas();canvas.width=Math.round(page.width*page.scale);canvas.height=Math.round(page.height*page.scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=page.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  if(page.type==='blank')return canvas;
  if(['html','markdown'].includes(page.type)){await htmlCanvas(page,await textSource(page,env,signal),context,canvas);}
  else if(page.type==='pdf'){
    if(!page.page)throw new Error('Expand PDF sources with preparePages or mountPageCurl before using a low-level factory');
    context.pdfDocuments??=new Map();
    if(!context.pdfDocuments.has(page.src)){
      const pending=pdfDocument(page.src,signal);context.pdfDocuments.set(page.src,pending);
      scope.add(()=>{void pending.then(source=>source.destroy()).catch(()=>{});});
    }
    const {document}=await context.pdfDocuments.get(page.src);scope.assertActive();
    const pdfPage=await document.getPage(page.page),unit=pdfPage.getViewport({scale:1});
    const factor=(page.fit==='cover'?Math.max:Math.min)(canvas.width/unit.width,canvas.height/unit.height);
    const viewport=pdfPage.getViewport({scale:factor});
    const task=pdfPage.render({canvasContext:ctx,viewport,transform:[1,0,0,1,(canvas.width-viewport.width)/2,(canvas.height-viewport.height)/2],background:page.background});
    const cancel=()=>task.cancel();signal.addEventListener('abort',cancel,{once:true});
    try{await withAbort(task.promise,signal);}finally{signal.removeEventListener('abort',cancel);pdfPage.cleanup();}
  }else{
    let src=page.src;
    if(page.type==='svg'){
      const {default:createPurify}=await import('./vendor/purify.mjs');scope.assertActive();
      const purify=createPurify(env.document.defaultView);
      purify.addHook('uponSanitizeAttribute',(node,data)=>{
        if(['href','xlink:href'].includes(data.attrName) && !data.attrValue.startsWith('#'))data.keepAttr=false;
      });
      const clean=purify.sanitize(await textSource(page,env,signal),{USE_PROFILES:{svg:true,svgFilters:true},ADD_TAGS:['use'],FORBID_TAGS:['foreignObject','script','image']});
      if(!/<svg[\s>]/i.test(clean))throw new Error('Invalid SVG document');
      src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
    }
    const image=new env.document.defaultView.Image();image.crossOrigin='anonymous';image.src=src;
    await withAbort(image.decode(),signal);scope.assertActive();fitImage(ctx,image,canvas.width,canvas.height,page.fit);
  }
  scope.assertActive();
  if(['html','markdown'].includes(page.type)){
    // html2canvas may clear a supplied canvas for transparent backgrounds.
    const paper=env.createCanvas();paper.width=canvas.width;paper.height=canvas.height;
    const paperContext=paper.getContext('2d');paperContext.fillStyle='#fff';paperContext.fillRect(0,0,paper.width,paper.height);paperContext.drawImage(canvas,0,0);return paper;
  }
  return canvas;
}
