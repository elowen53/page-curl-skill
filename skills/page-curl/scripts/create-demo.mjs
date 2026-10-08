import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function buildDemo({ output, config } = {}) {
  if (!output) throw new Error('--output is required');
  const settings = config ? JSON.parse(await readFile(resolve(config), 'utf8')) : {};
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Config must be an object');
  for (const key of Object.keys(settings)) if (!['title','pages','startSheet','startPage','mode'].includes(key)) throw new Error(`Unknown config key: ${key}`);
  const mode=settings.mode??'auto';
  if(!['auto','desktop','mobile'].includes(mode))throw new Error('mode must be auto, desktop or mobile');
  if (settings.title !== undefined && typeof settings.title !== 'string') throw new Error('title must be a string');
  if (settings.pages !== undefined && (!Array.isArray(settings.pages) || settings.pages.length < 2 || settings.pages.length % 2)) throw new Error('pages must contain an even number of at least two images');
  const count = settings.pages ? settings.pages.length / 2 : 6;
  const startSheet = settings.startSheet ?? Math.min(3, count);
  if (!Number.isInteger(startSheet) || startSheet < 0 || startSheet > count) throw new Error(`startSheet must be an integer from 0 to ${count}`);
  const startPage=settings.startPage??startSheet*2;
  if(!Number.isInteger(startPage)||startPage<0||startPage>count*2)throw new Error(`startPage must be an integer from 0 to ${count*2}`);
  const pages = [];
  for (const name of settings.pages ?? []) {
    if (typeof name !== 'string' || !name) throw new Error('Each page must be a local image path');
    const mime = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[extname(name).toLowerCase()];
    if (!mime) throw new Error(`Unsupported image type: ${name}`);
    const bytes = await readFile(resolve(dirname(resolve(config)), name));
    if (!bytes.length) throw new Error(`Empty image: ${name}`);
    const signatureOK = mime==='image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
      : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
    if(!signatureOK)throw new Error(`Invalid ${mime} signature: ${name}`);
    pages.push(`data:${mime};base64,${bytes.toString('base64')}`);
  }
  const [shell,code,vendor,mobile,cone] = await Promise.all(['demo-shell.html','page-curl.js','three.module.min.js','mobile-curl.js','cone-model.mjs'].map(name=>readFile(resolve(root,'assets',name),'utf8')));
  const title = settings.title ?? '纸张翻页 · 原理复现';
  const escapedTitle=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json = JSON.stringify({pages,startSheet,startPage,mode}).replace(/</g,'\\u003c');
  const runtime=`import {createConeModel,clamp,coneShader} from 'data:text/javascript;base64,${Buffer.from(cone).toString('base64')}';
const settings=${json};
async function mountDesktop(pageCurlConfig){${code}\nreturn {page:()=>spread*2,dispose};}
async function mountMobile(pageCurlConfig){${mobile}}
const media=matchMedia('(min-width: 768px) and (orientation: landscape)');
let active=null,activeMode=null,savedPage=settings.startPage,queue=Promise.resolve();
async function switchMode(){
  const mode=settings.mode==='auto'?(media.matches?'desktop':'mobile'):settings.mode;
  if(active && mode===activeMode)return;
  if(active){savedPage=active.page();active.dispose();active=null;}
  const config={...settings,startPage:savedPage,startSheet:Math.floor(savedPage/2)};
  active=await (mode==='desktop'?mountDesktop(config):mountMobile(config));activeMode=mode;
}
function schedule(){queue=queue.then(switchMode).catch(error=>{
  document.querySelector('#status').textContent='加载失败：'+error.message;
  console.error(error);
});}
if(settings.mode==='auto')media.addEventListener('change',schedule);
schedule();`;
  const html = shell.replace('__THREE_MODULE__',`data:text/javascript;base64,${Buffer.from(vendor).toString('base64')}`)
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
