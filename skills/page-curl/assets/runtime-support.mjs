import {validatePage,renderPage,preparePages} from './content-pages.mjs';
export {preparePages};
export function normalizeConfig(input={}) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new TypeError('Config must be an object');
  for(const key of Object.keys(input))if(!['title','mode','pages','startPage','startSheet'].includes(key))throw new Error(`Unknown config key: ${key}`);
  const mode=input.mode??'auto',pages=input.pages??[];
  if(!['auto','desktop','mobile'].includes(mode))throw new Error('mode must be auto, desktop or mobile');
  if(input.title!==undefined && typeof input.title!=='string')throw new TypeError('title must be a string');
  if(!Array.isArray(pages) || (pages.length && (pages.length<2 || pages.length%2)))throw new Error('Final pages must contain an even number of at least two faces; expand documents with preparePages first');
  pages.forEach(validatePage);
  const count=pages.length?pages.length/2:6,startSheet=input.startSheet??Math.min(3,count);
  const startPage=input.startPage??startSheet*2;
  if(!Number.isInteger(startSheet)||startSheet<0||startSheet>count)throw new Error(`startSheet must be an integer from 0 to ${count}`);
  if(!Number.isInteger(startPage)||startPage<0||startPage>count*2)throw new Error(`startPage must be an integer from 0 to ${count*2}`);
  return {...input,mode,pages:[...pages],startSheet:Math.floor(startPage/2),startPage};
}
export function abortError(){return Object.assign(new Error('Page curl mount cancelled'),{name:'AbortError'});}
export function resolveEnvironment(stage,environment={}) {
  const doc=stage.ownerDocument,view=doc?.defaultView??globalThis;
  const resolved={
    document:doc,fetch:view.fetch?.bind(view),createCanvas:()=>doc.createElement('canvas'),
    performance:view.performance,devicePixelRatio:view.devicePixelRatio??1,
    ResizeObserver:view.ResizeObserver,AbortController:view.AbortController,
    matchMedia:view.matchMedia?.bind(view),...environment
  };
  for(const key of ['createCanvas','ResizeObserver','AbortController'])if(typeof resolved[key]!=='function')throw new Error(`Missing environment dependency: ${key}`);
  if(typeof resolved.performance?.now!=='function')throw new Error('Missing environment dependency: performance.now');
  return resolved;
}
export function prepareMount(options){
  const {THREE,stage,prev,next,status,environment,signal}=options;
  if(!THREE)throw new Error('THREE is required');
  for(const [name,element] of Object.entries({stage,prev,next,status}))if(!element)throw new Error(`Missing page curl element: ${name}`);
  const config=normalizeConfig(options.config),env=resolveEnvironment(stage,environment);
  const controller=new env.AbortController(),cleanups=[],owned=new Set();
  let disposed=false;
  const scope={controller,get disposed(){return disposed;},
    add(fn){if(disposed)fn();else cleanups.push(fn);},
    own(resource){if(!owned.has(resource)){owned.add(resource);scope.add(()=>resource.dispose());}return resource;},
    assertActive(){if(disposed||controller.signal.aborted)throw abortError();},
    dispose(){
      if(disposed)return;disposed=true;controller.abort();
      for(const fn of cleanups.reverse()){try{fn();}catch{ /* Continue releasing the remaining resources. */ }}
      cleanups.length=0;
    }
  };
  if(signal){
    const cancel=()=>scope.dispose();
    signal.addEventListener('abort',cancel,{once:true});scope.add(()=>signal.removeEventListener('abort',cancel));
    if(signal.aborted)scope.dispose();
  }
  scope.assertActive();
  return {THREE,stage,prev,next,status,config,env,scope,controller};
}
export async function loadTextures(THREE,urls,scope,env){
  scope.assertActive();
  const loader=new THREE.TextureLoader();
  const context={env,scope};
  const pending=(async()=>{
    if(urls.every(url=>typeof url==='string'))return Promise.all(urls.map(async url=>{
      const texture=scope.own(await loader.loadAsync(url));scope.assertActive();return texture;
    }));
    // Document rasterization is serial to bound peak canvas memory and PDF work.
    const textures=[];
    for(const url of urls){
      const texture=scope.own(typeof url==='string'?await loader.loadAsync(url):new THREE.CanvasTexture(await renderPage(url,context)));
      scope.assertActive();textures.push(texture);
    }
    return textures;
  })();
  const signal=scope.controller.signal;
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(abortError());signal.addEventListener('abort',cancel,{once:true});
    pending.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
    if(signal.aborted)cancel();
  });
}
