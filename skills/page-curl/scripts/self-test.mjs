import test from 'node:test';
import assert from 'node:assert/strict';
import * as ActualThree from '../assets/three.module.min.js';
import {createConeModel,wrapCone,clamp,coneShader,ASPECT} from '../assets/cone-model.mjs';
import {mountDesktop} from '../assets/page-curl.js';
import {mountMobile} from '../assets/mobile-curl.js';
import {mountPageCurl} from '../assets/responsive-controller.mjs';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
async function harness(){
  let time=0;
  const listeners=new Map();
  const context=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const canvas={style:{},remove(){},getContext:()=>context,addEventListener:(name,fn)=>listeners.set(name,fn),
    setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})};
  const controls=Object.fromEntries(['#status','#prev','#next'].map(key=>[key,{}]));
  controls['#stage']={dataset:{},append(){},getBoundingClientRect:()=>({width:1000,height:600})};
  class Renderer{
    domElement=canvas; shadowMap={}; capabilities={getMaxAnisotropy:()=>1};
    setPixelRatio(){} setSize(){} render(){} dispose(){} setAnimationLoop(fn){this.loop=fn;}
  }
  const THREE={...ActualThree,WebGLRenderer:Renderer};
  let runtime;
  const handle=await mountDesktop({THREE,stage:controls['#stage'],prev:controls['#prev'],next:controls['#next'],status:controls['#status'],config:{pages:[],startSheet:3},
    environment:{createCanvas:()=>({...canvas}),ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}disconnect(){}},performance:{now:()=>time},devicePixelRatio:1,AbortController},debug:value=>runtime=value});
  return {...runtime,...handle,canvas,controls,
    tick(now){time=now;runtime.renderer.loop(now);},
    pointer(type,x,y=300){listeners.get(type)?.({type,button:0,clientX:x,clientY:y,pointerId:1});}};
}
test('fixed Three.js revision and real shader chunks remain compatible',async()=>{
  assert.equal(ActualThree.REVISION,'162');
  const h=await harness();
  for(const sheet of h.sheets){
    const shader={...ActualThree.ShaderLib.standard,uniforms:{}};
    sheet.mesh.material.onBeforeCompile(shader);
    assert(!shader.vertexShader.includes('#include <begin_vertex>'));
    assert(!shader.vertexShader.includes('#include <beginnormal_vertex>'));
    assert(!shader.fragmentShader.includes('#include <normal_fragment_begin>'));
    assert(!shader.fragmentShader.includes('#include <map_fragment>'));
    assert(shader.fragmentShader.includes('gl_FrontFacing ? front : back'));
    const depth={...ActualThree.ShaderLib.depth,uniforms:{}};
    sheet.mesh.customDepthMaterial.onBeforeCompile(depth);
    assert(!depth.vertexShader.includes('#include <begin_vertex>'));
    assert.equal(shader.uniforms.progress,depth.uniforms.progress);
  }
});
test('white sheet keeps its own front/back textures and shader uniforms throughout forward/back turns',async()=>{
  const h=await harness(),sheet=h.sheets[3];
  const front=sheet.mesh.material.map,back=sheet.uniforms.backPage.value;
  h.startTurn(true);
  for(const t of [0,200,425,849,850]){h.tick(t);assert.equal(sheet.mesh.material.map,front);assert.equal(sheet.uniforms.backPage.value,back);}
  assert.equal(h.state().spread,4);assert.equal(sheet.current,1);
  h.startTurn(false);h.tick(1275);h.tick(1700);
  assert.equal(h.state().spread,3);assert.equal(sheet.current,0);
});
test('unmoving paper stacks do not jump when logical spread changes',async()=>{
  const h=await harness();h.tick(0);
  const before=h.sheets.map(s=>s.uniforms.stackLift.value);
  h.startTurn(true);h.tick(0);
  assert.deepEqual(h.sheets.map(s=>s.uniforms.stackLift.value),before);
  h.tick(849);const preLanding=h.sheets.map(s=>s.uniforms.stackLift.value);
  h.tick(850);
  h.sheets.forEach((s,i)=>assert(Math.abs(s.uniforms.stackLift.value-preLanding[i])<1e-6));
});
test('hover remains suppressed during turn and after landing until a new move',async()=>{
  const h=await harness();h.pointer('pointermove',800);h.tick(100);
  assert.equal(h.state().hovering,3);
  h.startTurn(true);h.pointer('pointermove',800);h.tick(950);
  assert.equal(h.state().hovering,null);
  const after=h.sheets.map(s=>s.current);h.tick(1950);
  assert.deepEqual(h.sheets.map(s=>s.current),after);
  h.pointer('pointermove',800);h.tick(1966);
  assert.equal(h.state().hovering,4);assert(h.sheets[4].current>0);
});
test('rapid input advances only one sheet per active turn',async()=>{
  const h=await harness();h.startTurn(true);h.startTurn(true);h.startTurn(false);
  h.pointer('pointerdown',800);
  assert.equal(h.state().spread,4);assert.equal(h.state().drag,null);
  h.tick(850);assert.equal(h.state().turn,null);
});
test('drag commits exactly once, short drag rebounds and cancellation does not change spread',async()=>{
  const h=await harness();h.pointer('pointerdown',800);h.pointer('pointermove',400);h.tick(100);h.pointer('pointerup',400);h.tick(2000);
  assert.equal(h.state().spread,4);assert.equal(h.sheets[3].current,1);
  h.pointer('pointerdown',200);h.pointer('pointermove',220);h.tick(2100);h.pointer('pointerup',220);h.tick(4000);
  assert.equal(h.state().spread,4);assert.equal(h.sheets[3].current,1);
  h.pointer('pointerdown',200);h.pointer('pointermove',700);h.tick(4100);h.pointer('pointercancel',700);h.tick(6000);
  assert.equal(h.state().spread,4);assert.equal(h.sheets[3].current,1);
});
test('first and last sheet boundaries clamp correctly',async()=>{
  const h=await harness();
  for(let i=0;i<8;i++){h.startTurn(true);h.tick((i+1)*1000);}
  assert.equal(h.state().spread,6);assert.equal(h.state().turn,null);
  for(let i=0;i<9;i++){h.startTurn(false);h.tick((i+9)*1000);}
  assert.equal(h.state().spread,0);assert.equal(h.state().turn,null);
  for(const sheet of h.sheets)assert(sheet.current>=0 && sheet.current<=1);
});
test('each sheet has independent uniform ownership',async()=>{
  const h=await harness();
  assert.equal(new Set(h.sheets.map(s=>s.uniforms.progress)).size,6);
  assert.equal(new Set(h.sheets.map(s=>s.uniforms.backPage.value)).size,6);
});

test('cone cap is continuous and its outgoing tangent is smooth',()=>{
  for(const slope of [0,-.03,-.1])for(const angle of [.5,1,2])for(const y of [-.6885,0,.6885]){
    const radius=.2+(.6885-y)*slope;
    const x=slope===0?radius*angle:radius*Math.tan(slope*angle)/slope;
    const eps=1e-6,shape=[slope,.2,angle];
    const a=wrapCone(x-eps,y,shape),b=wrapCone(x,y,shape),c=wrapCone(x+eps,y,shape);
    for(let k=0;k<3;k++){
      assert(Math.abs(a[k]-c[k])<3e-6,'cap cannot jump');
      assert(Math.abs((b[k]-a[k])/eps-(c[k]-b[k])/eps)<.0001,'tangent cannot kink');
    }
  }
});
test('zero wrap remains flat and zero taper reduces to a cylinder',()=>{
  for(const x of [0,.2,1])for(const y of [-.6885,0,.6885]){
    const flat=wrapCone(x,y,[-.08,.18,0]);
    flat.forEach((v,i)=>assert(Math.abs(v-[x,y,0][i])<1e-10));
    const r=.2,wrapped=wrapCone(x,y,[0,r,6]);
    const expected=[r*Math.sin(x/r),y,r*(1-Math.cos(x/r))];
    wrapped.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-10));
  }
});
test('cone frames remain finite through all page counts, rollback and closing',()=>{
  for(const count of [1,2,12,26]){
    const model=createConeModel(count);
    for(let total=0;total<=count;total+=.05){
      const state=Array.from({length:count},(_,i)=>clamp(total-i));
      for(const grab of [{x:0,y:-1},{x:1,y:1}]){
        for(const shape of model.frame(state,Array(count).fill(grab))){
          const values=Object.values(shape).flat();assert(values.every(Number.isFinite));
          assert(shape.tail[3]>0);assert(shape.cone[1]>0);
          for(const x of [0,.1,1])for(const y of [-ASPECT/2,0,ASPECT/2])assert(wrapCone(x,y,shape.cone).every(Number.isFinite));
        }
      }
    }
  }
});

async function mobileHarness(startPage=6,factory=mountMobile){
  let time=0,removed=0,disconnected=0;
  const listeners=new Map();
  const context=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const canvas={style:{},getContext:()=>context,remove:()=>removed++,addEventListener:(name,fn)=>listeners.set(name,fn),
    setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:696,height:765})};
  const controls=Object.fromEntries(['#status','#prev','#next'].map(key=>[key,{}]));
  controls['#stage']={dataset:{},append(){},getBoundingClientRect:()=>({width:696,height:765})};
  class Renderer{domElement=canvas;shadowMap={};capabilities={getMaxAnisotropy:()=>1};
    setPixelRatio(){}setSize(){}render(){}setAnimationLoop(fn){this.loop=fn;}dispose(){this.disposed=true;}}
  let runtime;
  const handle=await factory({THREE:{...ActualThree,WebGLRenderer:Renderer},stage:controls['#stage'],prev:controls['#prev'],next:controls['#next'],status:controls['#status'],config:{pages:[],startSheet:3,startPage},
    environment:{createCanvas:()=>({...canvas}),ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}disconnect(){disconnected++;}},performance:{now:()=>time},devicePixelRatio:1,AbortController},debug:value=>runtime=value});
  return {...runtime,...handle,controls,tick(now){time=now;runtime.renderer.loop(now);},cleanup:()=>({removed,disconnected}),
    pointer(type,x,y=380){listeners.get(type)?.({type,button:0,clientX:x,clientY:y,pointerId:1});}};
}
test('mobile shaders and stable front/back maps',async()=>{
  const h=await mobileHarness(6);const blank=h.sheets[0].uniforms.backPage.value;
  for(const sheet of h.sheets){
    const shader={...ActualThree.ShaderLib.standard,uniforms:{}};sheet.mesh.material.onBeforeCompile(shader);
    const depth={...ActualThree.ShaderLib.depth,uniforms:{}};sheet.mesh.customDepthMaterial.onBeforeCompile(depth);
    assert(shader.vertexShader.includes(coneShader));assert(depth.vertexShader.includes(coneShader));
    assert.equal(shader.uniforms.cone,depth.uniforms.cone);assert.equal(sheet.uniforms.backPage.value,blank);
    assert(!shader.vertexShader.includes('#include <begin_vertex>'));assert(!shader.fragmentShader.includes('#include <map_fragment>'));
  }
  const sheet=h.sheets[6],front=sheet.front;h.begin(true);h.begin(true);h.tick(600);h.tick(1200);
  assert.equal(h.page(),7);assert.equal(sheet.current,1);assert.equal(sheet.front,front);assert.equal(sheet.uniforms.backPage.value,blank);
  const landed=h.sheets.map(s=>s.uniforms.cone.value.toArray());h.tick(2400);
  assert.deepEqual(h.sheets.map(s=>s.uniforms.cone.value.toArray()),landed);
  h.begin(false);h.tick(3600);assert.equal(h.page(),6);assert.equal(sheet.current,0);
});
test('mobile drag commit, rebound and cancellation',async()=>{
  const h=await mobileHarness(6);h.pointer('pointerdown',600);h.pointer('pointermove',300);h.tick(100);h.pointer('pointerup',300);h.tick(1600);
  assert.equal(h.page(),7);assert.equal(h.sheets[6].current,1);
  h.pointer('pointerdown',600);h.pointer('pointermove',580);h.tick(1700);h.pointer('pointerup',580);h.tick(3100);
  assert.equal(h.page(),7);assert.equal(h.sheets[7].current,0);
  h.pointer('pointerdown',600);h.pointer('pointermove',300);h.tick(3200);h.pointer('pointercancel',300);h.tick(4600);
  assert.equal(h.page(),7);assert.equal(h.sheets[7].current,0);
});
test('mobile boundaries and responsive teardown',async()=>{
  const h=await mobileHarness(0);h.begin(false);assert.equal(h.page(),0);
  for(let i=0;i<15;i++){h.begin(true);h.tick((i+1)*1500);}assert.equal(h.page(),11);
  h.dispose();assert.equal(h.renderer.loop,null);assert(h.renderer.disposed);
  assert.deepEqual(h.cleanup(),{removed:1,disconnected:1});assert.equal(h.controls['#next'].onclick,null);
});

test('CRLF copies import directly and retain mobile shader, turn, drag and cleanup behavior',async()=>{
  const root=await mkdtemp(join(tmpdir(),'page-curl-crlf-'));
  try{
    for(const file of ['mobile-curl.js','runtime-support.mjs','cone-model.mjs','package.json']){
      const source=await readFile(new URL('../assets/'+file,import.meta.url),'utf8');
      await writeFile(join(root,file),source.replace(/\r\n?/g,'\n').replace(/\n/g,'\r\n'));
    }
    const {mountMobile:factory}=await import(pathToFileURL(join(root,'mobile-curl.js')).href);
    const h=await mobileHarness(6,factory),sheet=h.sheets[6];
    const shader={...ActualThree.ShaderLib.standard,uniforms:{}};sheet.mesh.material.onBeforeCompile(shader);
    const depth={...ActualThree.ShaderLib.depth,uniforms:{}};sheet.mesh.customDepthMaterial.onBeforeCompile(depth);
    assert.equal(shader.uniforms.cone,depth.uniforms.cone);
    h.next();h.tick(1200);assert.equal(h.page(),7);assert.equal(sheet.current,1);
    h.previous();h.tick(2400);assert.equal(h.page(),6);
    h.pointer('pointerdown',600);h.pointer('pointermove',300);h.tick(2500);h.pointer('pointerup',300);h.tick(4000);assert.equal(h.page(),7);
    h.pointer('pointerdown',600);h.pointer('pointermove',580);h.tick(4100);h.pointer('pointerup',580);h.tick(5500);assert.equal(h.page(),7);
    h.dispose();h.dispose();assert.deepEqual(h.cleanup(),{removed:1,disconnected:1});
  }finally{
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});
  }
});

function fixture(TextureLoader=ActualThree.TextureLoader){
  let now=0,canvases=0,disconnected=0;
  const renderers=[],mediaListeners=new Set();
  const media={matches:true,addEventListener:(type,fn)=>mediaListeners.add(fn),removeEventListener:(type,fn)=>mediaListeners.delete(fn)};
  const context=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const createCanvas=()=>({style:{},getContext:()=>context,addEventListener(){},remove:()=>canvases--,
    setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})});
  const stage={dataset:{},ownerDocument:{querySelector(){throw new Error('Global selectors forbidden');}},append(){canvases++;},getBoundingClientRect:()=>({width:1000,height:600})};
  class Renderer{domElement=createCanvas();shadowMap={};capabilities={getMaxAnisotropy:()=>1};
    constructor(){renderers.push(this);}setPixelRatio(){}setSize(){}render(){}setAnimationLoop(fn){this.loop=fn;}dispose(){this.disposed=true;}}
  const options={THREE:{...ActualThree,WebGLRenderer:Renderer,TextureLoader},stage,prev:{},next:{},status:{},config:{startPage:6},
    environment:{createCanvas,ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}disconnect(){disconnected++;}},performance:{now:()=>now},devicePixelRatio:1,AbortController,matchMedia:()=>media}};
  return {options,renderers,mediaListeners,stats:()=>({canvases,disconnected}),tick(time){now=time;for(const renderer of renderers)renderer.loop?.(time);},
    change(matches){media.matches=matches;for(const listener of mediaListeners)listener();}};
}
test('injected controls support independent books without document selectors or shared clocks',async()=>{
  const a=fixture(),b=fixture(),first=await mountDesktop(a.options),second=await mountMobile(b.options);
  assert.equal(a.options.next.disabled,false);assert.equal(b.options.next.disabled,false);
  a.options.next.onclick();a.tick(850);assert.equal(first.page(),8);assert.equal(second.page(),6);
  b.options.next.onclick();b.tick(1200);assert.equal(second.page(),7);
  first.dispose();first.dispose();assert.equal(a.stats().canvases,0);assert.equal(b.stats().canvases,1);
  second.previous();b.tick(2400);assert.equal(second.page(),6);second.dispose();
  assert.equal(b.stats().canvases,0);
});
test('missing injected elements produce a clear error before creating a renderer',async()=>{
  const f=fixture();delete f.options.next;
  await assert.rejects(mountDesktop(f.options),/Missing page curl element: next/);
  assert.equal(f.renderers.length,0);
});
test('both factories release allocated resources on texture failure, including late textures',async()=>{
  for(const factory of [mountDesktop,mountMobile]){
    let late,disposed=0;
    const texture=new ActualThree.Texture();texture.addEventListener('dispose',()=>disposed++);
    class Loader{loadAsync(url){return url==='fail'?Promise.reject(new Error('decode failed')):new Promise(resolve=>late=resolve);}}
    const f=fixture(Loader);f.options.config={pages:['late','fail'],startPage:0};
    await assert.rejects(factory(f.options),/decode failed/);
    assert.equal(f.stats().canvases,0);assert(f.renderers[0].disposed);
    late(texture);await Promise.resolve();await Promise.resolve();assert.equal(disposed,1);
  }
});
test('abort while a factory is loading removes the canvas without waiting for image decoding',async()=>{
  for(const factory of [mountDesktop,mountMobile]){
    const pendingTextures=[];class Loader{loadAsync(){return new Promise(resolve=>pendingTextures.push(resolve));}}
    const f=fixture(Loader),cancel=new AbortController();f.options.signal=cancel.signal;f.options.config={pages:['a','b'],startPage:0};
    const pending=factory(f.options);const assertion=assert.rejects(pending,{name:'AbortError'});
    cancel.abort();await assertion;assert.equal(f.stats().canvases,0);
    let disposed=0;
    for(const complete of pendingTextures){const texture=new ActualThree.Texture();texture.addEventListener('dispose',()=>disposed++);complete(texture);}
    await Promise.resolve();await Promise.resolve();assert.equal(disposed,2);
  }
});
test('responsive controller preserves page, serializes switches and removes its media listener',async()=>{
  const f=fixture(),handle=await mountPageCurl(f.options);
  assert.equal(handle.mode(),'desktop');handle.next();f.tick(850);assert.equal(handle.page(),8);
  f.change(false);await handle.ready();assert.equal(handle.mode(),'mobile');assert.equal(handle.page(),8);
  f.change(true);f.change(false);f.change(true);await handle.ready();assert.equal(handle.mode(),'desktop');
  assert.equal(f.stats().canvases,1);assert.equal(handle.page(),8);
  handle.dispose();handle.dispose();assert.equal(f.stats().canvases,0);assert.equal(f.mediaListeners.size,0);
  f.change(false);await handle.ready();assert.equal(f.stats().canvases,0);
});
test('dispose during an asynchronous mode switch cannot resurrect a late instance',async()=>{
  const f=fixture();let complete,disposed=0;
  const factories={desktop:async()=>({page:()=>6,next(){},previous(){},dispose(){disposed++;}}),
    mobile:async()=>new Promise(resolve=>complete=()=>resolve({page:()=>6,next(){},previous(){},dispose(){disposed++;}}))};
  const handle=await mountPageCurl({...f.options,factories});f.change(false);await Promise.resolve();await Promise.resolve();
  handle.dispose();complete();await handle.ready();assert.equal(disposed,2);assert.equal(handle.mode(),null);assert.equal(f.mediaListeners.size,0);
});
test('external abort handles a pending initial mount as in React StrictMode cleanup',async()=>{
  const f=fixture(),cancel=new AbortController();let complete,disposed=0;
  const create=async()=>new Promise(resolve=>complete=()=>resolve({page:()=>6,next(){},previous(){},dispose(){disposed++;}}));
  const pending=mountPageCurl({...f.options,signal:cancel.signal,factories:{desktop:create,mobile:create}});
  const assertion=assert.rejects(pending,{name:'AbortError'});await Promise.resolve();await Promise.resolve();cancel.abort();complete();await assertion;
  assert.equal(disposed,1);assert.equal(f.mediaListeners.size,0);
});
