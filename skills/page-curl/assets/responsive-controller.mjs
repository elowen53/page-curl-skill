import {mountDesktop} from './page-curl.js';
import {mountMobile} from './mobile-curl.js';
import {normalizeConfig,resolveEnvironment,abortError} from './runtime-support.mjs';
export const BREAKPOINT='(min-width: 768px) and (orientation: landscape)';

/** Mount one book. dispose() also cancels a pending mount or mode switch.
 * @param {import('./api.js').ResponsiveOptions} options
 * @returns {Promise<import('./api.js').ResponsiveHandle>}
 */
export async function mountPageCurl(options){
  const {stage,prev,next,status,signal,onError}=options;
  for(const [name,element] of Object.entries({stage,prev,next,status}))if(!element)throw new Error(`Missing page curl element: ${name}`);
  const overrides=Object.fromEntries(['mode','pages','startPage','startSheet'].filter(key=>options[key]!==undefined).map(key=>[key,options[key]]));
  const config=normalizeConfig({...options.config,...overrides});
  const env=resolveEnvironment(stage,options.environment),controller=new env.AbortController();
  const factories=options.factories??{desktop:mountDesktop,mobile:mountMobile};
  if(config.mode==='auto' && !env.matchMedia)throw new Error('Auto mode requires environment.matchMedia');
  const media=config.mode==='auto'?env.matchMedia(BREAKPOINT):null;
  let closed=false,active=null,activeMode=null,savedPage=config.startPage,queue=Promise.resolve();
  function dispose(){
    if(closed)return;closed=true;controller.abort();
    media?.removeEventListener('change',changed);signal?.removeEventListener('abort',dispose);
    active?.dispose();active=null;activeMode=null;
  }
  async function switchMode(){
    if(closed)return;
    const mode=config.mode==='auto'?(media.matches?'desktop':'mobile'):config.mode;
    if(active && mode===activeMode)return;
    if(active){savedPage=active.page();active.dispose();active=null;}
    activeMode=null;
    prev.disabled=next.disabled=true;
    const mounted=await factories[mode]({...options,config:{...config,startPage:savedPage,startSheet:Math.floor(savedPage/2)},environment:env,signal:controller.signal});
    if(closed){mounted.dispose();return;}
    active=mounted;activeMode=mode;
  }
  function schedule(){queue=queue.catch(()=>{}).then(switchMode);return queue;}
  function changed(){
    schedule().catch(error=>{
      if(closed||error.name==='AbortError')return;
      status.textContent='加载失败：'+error.message;
      onError?.(error);
    });
  }
  signal?.addEventListener('abort',dispose,{once:true});
  if(signal?.aborted){dispose();throw abortError();}
  media?.addEventListener('change',changed);
  try{await schedule();if(closed)throw abortError();}
  catch(error){dispose();throw error;}
  return {
    page:()=>active?.page()??savedPage,mode:()=>activeMode,
    next:()=>active?.next(),previous:()=>active?.previous(),
    ready:()=>queue,dispose
  };
}
