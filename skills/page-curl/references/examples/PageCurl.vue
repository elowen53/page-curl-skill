<script setup>
import {ref,watch,onMounted,onBeforeUnmount} from 'vue';
import * as THREE from '../../assets/three.module.min.js';
import {mountPageCurl} from '../../assets/responsive-controller.mjs';

const props=defineProps({
  pages:{type:Array,default:()=>[]},
  mode:{type:String,default:'auto'},
  startPage:{type:Number,default:0}
});
const emit=defineEmits(['error']);
const stage=ref(null),prev=ref(null),next=ref(null),status=ref(null);
let mounted=false,version=0,book=null,cancel=null,queue=Promise.resolve();
function remount(){
  const request=++version;
  cancel?.abort();book?.dispose();book=null;
  const config={pages:[...props.pages],mode:props.mode,startPage:props.startPage};
  queue=queue.catch(()=>{}).then(async()=>{
    if(!mounted||request!==version)return;
    const currentCancel=new AbortController();cancel=currentCancel;
    const instance=await mountPageCurl({THREE,stage:stage.value,prev:prev.value,next:next.value,status:status.value,
      config,signal:currentCancel.signal,onError:error=>emit('error',error)});
    if(!mounted||request!==version){instance.dispose();return;}
    book=instance;
  }).catch(error=>{if(mounted&&request===version&&error.name!=='AbortError'){status.value.textContent=error.message;emit('error',error);}});
}
watch(()=>({pages:[...props.pages],mode:props.mode,startPage:props.startPage}),remount);
onMounted(()=>{mounted=true;remount();});
onBeforeUnmount(()=>{mounted=false;version++;cancel?.abort();book?.dispose();book=null;});
</script>

<template>
  <section class="page-curl">
    <div ref="stage" class="page-curl-stage" />
    <footer>
      <button ref="prev" type="button" disabled>上一页</button>
      <output ref="status" aria-live="polite" />
      <button ref="next" type="button" disabled>下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.page-curl-stage{height:65vh;min-height:340px}
.page-curl-stage :deep(canvas){display:block;width:100%;height:100%;touch-action:pan-y}
footer{display:flex;align-items:center;justify-content:center;gap:1rem;padding:1rem}
</style>
