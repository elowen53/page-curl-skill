import {renderPage,preparePages} from '../skills/page-curl/assets/content-pages.mjs';
import {pdfFixture} from './pdf-fixture.mjs';
const status=document.querySelector('#status'),results=document.querySelector('#results');
let passed=0,failed=0;
function assert(condition,message){if(!condition)throw new Error(message);}
async function test(name,run){
 const item=document.createElement('li');results.append(item);
 try{await run();passed++;item.className='pass';item.textContent='PASS · '+name;}
 catch(error){failed++;item.className='fail';item.textContent='FAIL · '+name+' · '+error.message;}
 status.textContent=`${passed} passed / ${failed} failed`;
}
function context(){
 const controller=new AbortController(),cleanup=[];
 return {env:{document,fetch:fetch.bind(window),devicePixelRatio:1,createCanvas:()=>document.createElement('canvas')},
 scope:{controller,assertActive(){if(controller.signal.aborted)throw Object.assign(new Error('cancelled'),{name:'AbortError'});},add(fn){cleanup.push(fn);}},
 async dispose(){controller.abort();for(const fn of cleanup.reverse())await fn();}};
}
function pixel(canvas,x,y){return [...canvas.getContext('2d').getImageData(x,y,1,1).data];}
function darkPixels(canvas){const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i]<200 && bytes[i+1]<200 && bytes[i+2]<200 && bytes[i+3]>0)count++;return count;}
async function sample(page){const ctx=context();try{return await renderPage(page,ctx);}finally{await ctx.dispose();}}
await test('HTML and Markdown produce text pixels, CSS and high DPI',async()=>{
 for(const page of [{type:'html',content:'<style>h1{color:#233}</style><h1>HTML words</h1><div style="height:200px;background:#d45335"></div>'},{type:'markdown',content:'# Markdown\n\n| A | B |\n| --- | --- |\n| Text | Page |'}]){
  const canvas=await sample({...page,scale:2});assert(canvas.width===1600 && canvas.height===2204,'density lost');assert(darkPixels(canvas)>1000,'text missing');document.querySelector('#samples').append(canvas);
 }
 assert(!document.querySelector('iframe'),'capture frames leaked');
});
await test('SVG transparency composites on white, paths and internal references render',async()=>{
 const canvas=await sample({type:'svg',background:'transparent',content:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1102"><defs><rect id="mark" width="100" height="100" fill="#d45335"/></defs><use href="#mark" x="200" y="200"/></svg>'});
 assert(pixel(canvas,0,0).join(',')==='255,255,255,255','transparent paper is not white');assert(pixel(canvas,250,250)[0]>150 && pixel(canvas,250,250)[1]<120,'vector use missing');
});
await test('imported script and event handlers do not execute',async()=>{
 const canvas=await sample({type:'html',content:'<h1>Safe page</h1><script>parent.document.body.dataset.executed="script"</script><svg onload="parent.document.body.dataset.executed=\'handler\'"></svg>'});
 assert(!document.body.dataset.executed,'imported code executed');assert(darkPixels(canvas)>100,'safe text lost');
});
await test('long articles fail explicitly and release the content frame',async()=>{
 let rejected=false;try{await sample({type:'markdown',content:Array.from({length:150},(_,i)=>`Paragraph ${i} long words.\n`).join('\n')});}catch(error){rejected=/overflows/.test(error.message);}
 assert(rejected,'long article silently cropped');assert(!document.querySelector('iframe'),'failed frame leaked');
});
const bytes=pdfFixture(),pdfURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
await test('PDF expands all three pages and renders original page text/vector marks',async()=>{
 const pages=await preparePages([{type:'pdf',src:pdfURL}]);assert(pages.length===4 && pages[3].type==='blank','PDF count/padding wrong');
 const ctx=context();try{for(const page of pages.slice(0,3)){const canvas=await renderPage(page,ctx);assert(darkPixels(canvas)>10000,'PDF drawing missing');document.querySelector('#samples').append(canvas);}}finally{await ctx.dispose();}
});
await test('PDF selection preserves requested order and rejects missing pages',async()=>{
 const pages=await preparePages([{type:'pdf',src:pdfURL,pages:[3,1]}]);assert(pages[0].page===3 && pages[1].page===1,'selection reordered');
 let rejected=false;try{await preparePages([{type:'pdf',src:pdfURL,page:4}]);}catch(error){rejected=/exceeds/.test(error.message);}assert(rejected,'missing page accepted');
});
URL.revokeObjectURL(pdfURL);document.body.dataset.result=failed?'failed':'passed';
