import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildDemo} from '../skills/page-curl/scripts/create-demo.mjs';
import {pdfFixture} from './pdf-fixture.mjs';
async function controllerModule(html,root){
 const match=html.match(/<script type="importmap">(.*?)<\/script>/s);
 assert(match,'generated demo must embed its complete module graph');
 const {imports}=JSON.parse(match[1]);
 for(const [name,url] of Object.entries(imports)){
   let source=Buffer.from(url.split(',')[1],'base64').toString('utf8');
   for(const id of Object.keys(imports))source=source.replaceAll(`'${id}'`,JSON.stringify(pathToFileURL(join(root,id)).href));
   const target=join(root,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,source);
 }
 await writeFile(join(root,'page-curl/package.json'),'{"type":"module"}');
 return import(pathToFileURL(join(root,'page-curl/responsive-controller.mjs')).href);
}
async function workspace(fn){
 const root=await mkdtemp(join(tmpdir(),'page-curl-test-'));
 try{return await fn(root);}finally{
   assert.equal(dirname(resolve(root)),resolve(tmpdir()));
   await rm(root,{recursive:true,force:true});
 }
}
test('offline default generator embeds pinned vendor and complete implementation',()=>workspace(async root=>{
 const output=join(root,'book.html'),result=await buildDemo({output});
 const html=await readFile(output,'utf8');
 assert.equal(result.sheets,6);assert(html.includes('data:text/javascript;base64,'));
 assert(!html.includes('__DEMO_CODE__'));assert(!html.includes('__THREE_MODULE__'));
 const module=await controllerModule(html,root);assert.equal(typeof module.mountPageCurl,'function');
 assert(html.length<3_000_000,'image-only preview must not bundle optional document vendors');
 assert(html.includes('mountPageCurl({THREE,stage,prev,next,status,config'));
}));
test('local paired images are embedded relative to config and title is escaped',()=>workspace(async root=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVhEAAAAASUVORK5CYII=','base64');
 await writeFile(join(root,'a.png'),png);await writeFile(join(root,'b.png'),png);
 await writeFile(join(root,'config.json'),JSON.stringify({title:'<script>hello</script>',pages:['a.png','b.png'],startSheet:0}));
 const output=join(root,'book.html');const result=await buildDemo({output,config:join(root,'config.json')});
 const html=await readFile(output,'utf8');
 assert.equal(result.sheets,1);assert(html.includes('data:image/png;base64,'));
 assert(html.includes('&lt;script&gt;hello&lt;/script&gt;'));
 assert(!html.includes('<script>hello</script>'));
}));
test('invalid counts, boundaries and unknown settings fail before output',()=>workspace(async root=>{
 for(const settings of [{pages:['a.png']},{startSheet:7},{startSheet:.5},{startPage:13},{startPage:-1},{mode:'other'},{title:42},{bad:true}]){
   const config=join(root,'config.json');await writeFile(config,JSON.stringify(settings));
   await assert.rejects(buildDemo({output:join(root,'book.html'),config}));
 }
 await assert.rejects(readFile(join(root,'book.html')));
}));
test('auto and forced mobile modes include the cone renderer and exact responsive breakpoint',()=>workspace(async root=>{
 for(const mode of ['auto','desktop','mobile']){
   const config=join(root,'config.json');await writeFile(config,JSON.stringify({mode,startPage:5}));
   const output=join(root,`${mode}.html`);await buildDemo({output,config});
   const html=await readFile(output,'utf8');
   assert(html.includes(`"mode":"${mode}"`));assert(html.includes('"startPage":5'));
   const module=await controllerModule(html,join(root,mode));
   assert.equal(module.BREAKPOINT,'(min-width: 768px) and (orientation: landscape)');
   assert.equal(typeof module.mountPageCurl,'function');
 }
}));
test('missing and corrupt image files fail without producing partial output',()=>workspace(async root=>{
 const config=join(root,'config.json'),output=join(root,'book.html');
 await writeFile(config,JSON.stringify({pages:['a.png','b.png']}));
 await assert.rejects(buildDemo({output,config}));
 await writeFile(join(root,'a.png'),'invalid');await writeFile(join(root,'b.png'),'invalid');
 await assert.rejects(buildDemo({output,config}),/signature/);
 await assert.rejects(readFile(output));
}));
test('HTML and Markdown file paths embed their local images and paginate in order',()=>workspace(async root=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVhEAAAAASUVORK5CYII=','base64');
 await mkdir(join(root,'article'));await writeFile(join(root,'article/picture.png'),png);
 await writeFile(join(root,'article/a.html'),'<h1>HTML</h1><img src="picture.png">');
 await writeFile(join(root,'article/b.md'),'# Markdown\r\n![figure](picture.png)\r\n<!-- pagebreak -->\r\n# Final');
 const config=join(root,'config.json');await writeFile(config,JSON.stringify({pages:['article/a.html','article/b.md']}));
 const output=join(root,'book.html'),result=await buildDemo({config,output}),html=await readFile(output,'utf8');
 assert.equal(result.sheets,2);assert.equal(result.startSheet,0);assert(html.includes('data:image/png;base64,'));
 const module=await controllerModule(html,root);assert.equal(typeof module.mountPageCurl,'function');
 const json=JSON.parse(html.match(/const config=(.*);/)[1]);assert.equal(json.pages.length,4);assert.equal(json.pages[3].type,'blank');assert.match(json.pages[2].content,/# Final/);
}));
test('SVG and PDF are embedded offline with matching PDF worker, with deferred document count',()=>workspace(async root=>{
 await writeFile(join(root,'drawing.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10"/></svg>');
 await writeFile(join(root,'issue.pdf'),pdfFixture());
 const config=join(root,'config.json');await writeFile(config,JSON.stringify({pages:['drawing.svg',{type:'pdf',src:'issue.pdf',pages:[3,1]}],startPage:0}));
 const output=join(root,'book.html'),result=await buildDemo({config,output}),html=await readFile(output,'utf8');
 assert.equal(result.sheets,null);assert(html.includes('data:application/pdf;base64,'));assert(!html.includes('https://unpkg.com'));
 const {imports}=JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
 assert(imports['page-curl/vendor/pdf.mjs']);assert(imports['page-curl/vendor/pdf.worker.mjs']);assert(!imports['page-curl/vendor/html2canvas.mjs']);
 const module=await controllerModule(html,root);assert.equal(typeof module.mountPageCurl,'function');
}));
test('bad SVG/PDF signatures and remote article images do not produce partial files',()=>workspace(async root=>{
 const config=join(root,'config.json'),output=join(root,'book.html');
 for(const extension of ['svg','pdf']){
  await writeFile(join(root,'bad.'+extension),'bad');await writeFile(config,JSON.stringify({pages:['bad.'+extension]}));
  await assert.rejects(buildDemo({config,output}),/signature/);
 }
 await writeFile(config,JSON.stringify({pages:[{type:'html',content:'<img src="https://example.com/pic.png">'}]}));
 await assert.rejects(buildDemo({config,output}),/Offline content/);await assert.rejects(readFile(output));
}));
