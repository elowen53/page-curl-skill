import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as ActualThree from '../assets/three.module.min.js';
const source=await readFile(new URL('../assets/page-curl.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function harness(){
  let time=0;
  const listeners=new Map();
  const context=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const canvas={getContext:()=>context,addEventListener:(name,fn)=>listeners.set(name,fn),
    setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})};
  const controls=Object.fromEntries(['#status','#prev','#next'].map(key=>[key,{}]));
  controls['#stage']={append(){},getBoundingClientRect:()=>({width:1000,height:600})};
  class Renderer{
    domElement=canvas; shadowMap={}; capabilities={getMaxAnisotropy:()=>1};
    setPixelRatio(){} setSize(){} render(){} setAnimationLoop(fn){this.loop=fn;}
  }
  const document={querySelector:key=>controls[key],createElement:()=>({...canvas})};
  const THREE={...ActualThree,WebGLRenderer:Renderer};
  const runtime=await new AsyncFunction('THREE','document','ResizeObserver','performance','devicePixelRatio','pageCurlConfig',
    source+'\nreturn {sheets,startTurn,state:()=>({spread,drag,turn,hovering}),renderer};')(
      THREE,document,class{constructor(fn){this.fn=fn;}observe(){this.fn();}}, {now:()=>time},1,{pages:[],startSheet:3});
  return {...runtime,canvas,controls,
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
