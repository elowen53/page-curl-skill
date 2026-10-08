import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {normalizeConfig} from '../assets/runtime-support.mjs';
import {validatePage} from '../assets/content-pages.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function buildDemo({ output, config } = {}) {
  if (!output) throw new Error('--output is required');
  const settings = config ? JSON.parse(await readFile(resolve(config), 'utf8')) : {};
  if(!Array.isArray(settings.pages??[]))throw new Error('pages must be an array');
  const pages = [];
  const base=config?dirname(resolve(config)):process.cwd();
  async function embedFile(name){
    const mime = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf'}[extname(name).toLowerCase()];
    if (!mime) throw new Error(`Unsupported asset type: ${name}`);
    const bytes = await readFile(resolve(base, name));
    if (!bytes.length) throw new Error(`Empty asset: ${name}`);
    const signatureOK = mime==='image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
      : mime==='application/pdf'?bytes.toString('ascii',0,5)==='%PDF-'
      : mime==='image/svg+xml'?/<svg[\s>]/i.test(bytes.toString('utf8'))
      : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
    if(!signatureOK)throw new Error(`Invalid ${mime} signature: ${name}`);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }
  async function inlineImages(content,type,relativeBase){
    const pattern=type==='markdown'?/!\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g:/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi;
    const matches=[...content.matchAll(pattern)];
    for(const match of matches){const url=type==='markdown'?match[1]:match[2];
      if(/^data:/i.test(url))continue;
      if(/^(?:https?:|\/\/)/i.test(url))throw new Error('Offline content requires local or embedded images');
      const embedded=await embedFile(resolve(relativeBase,url));content=content.replace(match[0],match[0].replace(url,embedded));
    }
    return content;
  }
  for(const input of settings.pages??[]){
    let page=input;
    if(typeof page==='string'){
      const extension=extname(page).toLowerCase();
      const type={'.html':'html','.htm':'html','.md':'markdown','.markdown':'markdown','.svg':'svg','.pdf':'pdf'}[extension];
      if(type)page={type,src:page};else{pages.push(await embedFile(page));continue;}
    }
    validatePage(page);page={...page};
    if(page.type==='image'||page.type==='pdf'){page.src=await embedFile(page.src);}
    else if(page.type!=='blank'){
      const relativeBase=page.src?dirname(resolve(base,page.src)):base;
      page.content=page.content??await readFile(resolve(base,page.src),'utf8');delete page.src;
      if(page.type==='svg' && !/<svg[\s>]/i.test(page.content))throw new Error('Invalid image/svg+xml signature');
      if(['html','markdown'].includes(page.type))page.content=await inlineImages(page.content,page.type,relativeBase);
    }
    pages.push(page);
  }
  const documents=pages.some(page=>typeof page==='object' && page.type!=='image');
  const deferredPDF=pages.some(page=>page?.type==='pdf' && !page.page);
  const finalized=pages.flatMap(page=>['html','markdown'].includes(page?.type)?page.content.split(/<!--\s*pagebreak\s*-->/i).map(content=>({...page,content})):page);
  if(documents && finalized.length%2)finalized.push({type:'blank'});
  // Full PDFs have their actual count checked in the browser before mounting.
  const validated=normalizeConfig(deferredPDF?{...settings,pages:[],startPage:0,startSheet:0}:{...settings,pages:finalized});
  const {mode}=validated;
  const startSheet=settings.startSheet??(documents?0:validated.startSheet),startPage=settings.startPage??startSheet*2;
  const count=deferredPDF?null:(finalized.length?finalized.length/2:6);
  if(!Number.isInteger(startSheet)||startSheet<0||!Number.isInteger(startPage)||startPage<0)throw new Error('Reading start must be a nonnegative integer');
  const shell=await readFile(resolve(root,'assets/demo-shell.html'),'utf8');
  const modules=new Map();
  const types=new Set(pages.filter(page=>typeof page==='object').map(page=>page.type));
  const needed=new Set();
  if(types.has('html')||types.has('markdown'))needed.add('html2canvas.mjs');
  if(types.has('html')||types.has('markdown')||types.has('svg'))needed.add('purify.mjs');
  if(types.has('markdown'))needed.add('marked.mjs');
  if(types.has('pdf')){needed.add('pdf.mjs');needed.add('pdf.worker.mjs');}
  async function embed(name){
    name=relative(resolve(root,'assets'),resolve(root,'assets',name)).replace(/\\/g,'/');
    if(modules.has(name))return modules.get(name);
    let code=await readFile(resolve(root,'assets',name),'utf8');
    const dependencies=[...code.matchAll(/\bfrom\s+(['"])(\.\/[^'"]+)\1|\bimport\((['"])(\.\/[^'"]+)\3\)|new URL\((['"])(\.\/[^'"]+)\5,import.meta.url\)\.href/g)];
    for(const match of dependencies){
      const relative=match[2]??match[4]??match[6];
      if(relative==='./api.js')continue; // JSDoc type imports have no runtime module.
      const dependency=resolve(dirname(resolve(root,'assets',name)),relative);
      if(relative.includes('/vendor/') && !needed.has(relative.split('/').at(-1))){
        code=code.replace(match[0],()=>match[4]?`Promise.reject(new Error('This generated preview does not include ${relative.split('/').at(-1)}'))`:`''`);continue;
      }
      const url=await embed(dependency);
      const id='page-curl/'+modules.get(dependency+'#id');
      code=code.replace(match[0],()=>match[2]?`from '${id}'`:match[4]?`import('${id}')`:`import.meta.resolve('${id}')`);
    }
    const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
    modules.set(name,url);modules.set(resolve(root,'assets',name)+'#id',name);return url;
  }
  await embed('responsive-controller.mjs');await embed('three.module.min.js');
  const imports=Object.fromEntries([...modules].filter(([name])=>!name.endsWith('#id')).map(([name,url])=>['page-curl/'+name,url]));
  const title = settings.title ?? '杂志翻页';
  const escapedTitle=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json = JSON.stringify({pages:deferredPDF?pages:finalized,startSheet,startPage,mode}).replace(/</g,'\\u003c');
  const runtime=`import {mountPageCurl} from 'page-curl/responsive-controller.mjs';
const config=${json};
const stage=document.querySelector('#stage'),prev=document.querySelector('#prev'),next=document.querySelector('#next'),status=document.querySelector('#status');
try{await mountPageCurl({THREE,stage,prev,next,status,config,onError:console.error});}
catch(error){status.textContent='加载失败：'+error.message;console.error(error);}`;
  const html = shell.replace('__THREE_MODULE__','page-curl/three.module.min.js')
    .replace('__IMPORT_MAP__',()=>JSON.stringify({imports}).replace(/</g,'\\u003c'))
    .replace('__DEMO_CODE__',()=>runtime)
    .replace(/<title>[^<]*<\/title>/,()=>`<title>${escapedTitle}</title>`)
    .replace(/<h1>[^<]*<\/h1>/,()=>`<h1>${escapedTitle}</h1>`);
  await mkdir(dirname(resolve(output)),{recursive:true});
  await writeFile(resolve(output),html,'utf8');
  return {output:resolve(output),sheets:count,startSheet};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args={};
    for(let i=2;i<process.argv.length;i+=2){
      const key=process.argv[i];
      if(!['--output','--config'].includes(key)||!process.argv[i+1])throw new Error('Usage: node create-demo.mjs --output book.html [--config book.json]');
      args[key.slice(2)]=process.argv[i+1];
    }
    console.log(JSON.stringify(await buildDemo(args)));
  } catch(error){ console.error(error.message); process.exitCode=1; }
}
