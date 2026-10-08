import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {buildDemo} from '../skills/page-curl/scripts/create-demo.mjs';
function controllerUrl(html){
 const match=html.match(/import \{mountPageCurl\} from '(data:text\/javascript;base64,[^']+)'/);
 assert(match,'generated demo must import the shared controller');return match[1];
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
 const module=await import(controllerUrl(html));assert.equal(typeof module.mountPageCurl,'function');
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
   const module=await import(controllerUrl(html));
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
