import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {normalizeConfig} from '../assets/runtime-support.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function buildDemo({ output, config } = {}) {
  if (!output) throw new Error('--output is required');
  const settings = config ? JSON.parse(await readFile(resolve(config), 'utf8')) : {};
  const {mode,startSheet,startPage}=normalizeConfig(settings);
  const count=settings.pages?settings.pages.length/2:6;
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
  const shell=await readFile(resolve(root,'assets/demo-shell.html'),'utf8');
  const modules=new Map();
  async function embed(name){
    if(modules.has(name))return modules.get(name);
    let code=await readFile(resolve(root,'assets',name),'utf8');
    const dependencies=[...code.matchAll(/\bfrom\s+(['"])(\.\/[^'"]+)\1/g)];
    for(const match of dependencies){
      const url=await embed(match[2].slice(2));
      code=code.replace(match[0],()=>`from '${url}'`);
    }
    const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
    modules.set(name,url);return url;
  }
  const controller=await embed('responsive-controller.mjs'),vendor=await embed('three.module.min.js');
  const title = settings.title ?? '杂志翻页';
  const escapedTitle=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json = JSON.stringify({pages,startSheet,startPage,mode}).replace(/</g,'\\u003c');
  const runtime=`import {mountPageCurl} from '${controller}';
const config=${json};
const stage=document.querySelector('#stage'),prev=document.querySelector('#prev'),next=document.querySelector('#next'),status=document.querySelector('#status');
try{await mountPageCurl({THREE,stage,prev,next,status,config,onError:console.error});}
catch(error){status.textContent='加载失败：'+error.message;console.error(error);}`;
  const html = shell.replace('__THREE_MODULE__',vendor)
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
