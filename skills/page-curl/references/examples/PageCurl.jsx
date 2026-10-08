import {useEffect,useRef} from 'react';
import * as THREE from '../../assets/three.module.min.js';
import {mountPageCurl} from '../../assets/responsive-controller.mjs';

const EMPTY_PAGES=[];
export default function PageCurl({pages=EMPTY_PAGES,mode='auto',startPage=0}){
  const stage=useRef(null),prev=useRef(null),next=useRef(null),status=useRef(null),queue=useRef(Promise.resolve());
  // An equivalent new array from the parent should not rebuild the renderer.
  const configKey=JSON.stringify({pages,mode,startPage});
  useEffect(()=>{
    const cancel=new AbortController();let book=null;
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      if(cancel.signal.aborted)return;
      const instance=await mountPageCurl({THREE,stage:stage.current,prev:prev.current,next:next.current,status:status.current,
        config:JSON.parse(configKey),signal:cancel.signal,onError:console.error});
      if(cancel.signal.aborted){instance.dispose();return;}
      book=instance;
    }).catch(error=>{if(!cancel.signal.aborted&&error.name!=='AbortError'){status.current.textContent=error.message;console.error(error);}});
    return ()=>{cancel.abort();book?.dispose();};
  },[configKey]);
  return <section>
    <div ref={stage} style={{height:'65vh',minHeight:340}} />
    <footer style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'1rem',padding:'1rem'}}>
      <button ref={prev} type="button" disabled>上一页</button>
      <output ref={status} aria-live="polite" />
      <button ref={next} type="button" disabled>下一页</button>
    </footer>
  </section>;
}
