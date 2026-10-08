// Narrow-screen single-leaf cone model. Independent specimen artwork.
const stage=document.querySelector('#stage'),status=document.querySelector('#status');
const config=pageCurlConfig;
const count=config.pages.length||12;
let page=Math.min(config.startPage??config.startSheet*2,count-1),drag=null,turn=null;
const controller=new AbortController();
const scene=new THREE.Scene(),book=new THREE.Group();scene.add(book);
const camera=new THREE.PerspectiveCamera(40,1,.1,20);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
stage.append(renderer.domElement);
stage.dataset.mode='mobile';
const canvas=renderer.domElement;
canvas.style.touchAction='pan-y pinch-zoom';
scene.add(new THREE.HemisphereLight(0xffffff,0xa1aeaf,1.7));
const light=new THREE.DirectionalLight(0xffffff,2);
light.position.set(.689,-1.15,2.15);light.castShadow=true;
light.shadow.mapSize.set(2048,2048);
Object.assign(light.shadow.camera,{left:-1.1,right:1.1,top:.8,bottom:-.8,near:1,far:10});
light.shadow.camera.updateProjectionMatrix();light.shadow.bias=-.001;scene.add(light);
const prev=document.querySelector('#prev'),next=document.querySelector('#next');
prev.disabled=next.disabled=true;
function specimen(index,blank=false){
  const c=document.createElement('canvas');c.width=720;c.height=992;
  const ctx=c.getContext('2d');
  const dark=!blank && index%7===2;
  ctx.fillStyle=dark?'#242421':'#f5f4ef';ctx.fillRect(0,0,720,992);
  if(!blank){
    ctx.strokeStyle=dark?'#615640':'#c3d4e4';ctx.lineWidth=1;
    for(let x=38;x<=686;x+=72){ctx.beginPath();ctx.moveTo(x,35);ctx.lineTo(x,935);ctx.stroke();}
    for(let y=35;y<=935;y+=112){ctx.beginPath();ctx.moveTo(38,y);ctx.lineTo(686,y);ctx.stroke();}
    const texts=['typographic','composition','intentional','experiments','letterforms','constraints','readability','iconography'];
    texts.forEach((text,row)=>{
      ctx.fillStyle=dark?'#caa155':'#181818';ctx.font=`${row<2?200:row<4?400:row<6?500:700} 68px sans-serif`;
      ctx.fillText(text,47,110+row*112,625);
    });
    ctx.font='15px monospace';ctx.fillText(`PAGE ${index+1} / CONICAL ROLL`,40,974);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
}
const textures=await Promise.all(config.pages.map(url=>new THREE.TextureLoader().loadAsync(url))).catch(error=>{
  status.textContent='页面图片无法解码，请检查输入文件。';throw error;
});
textures.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();});
const blank=specimen(0,true),geometry=new THREE.PlaneGeometry(1,1.377,64,88),sheets=[];
const model=createConeModel(count);
for(let index=0;index<count;index++){
  const uniforms={cone:{value:new THREE.Vector3()},tail:{value:new THREE.Vector4()},reach:{value:new THREE.Vector2(1,1)},
    bend:{value:0},rotation:{value:0},pileLift:{value:0},taper:{value:0},layer:{value:0},backPage:{value:blank}};
  const front=textures[index]??specimen(index);
  const material=new THREE.MeshStandardMaterial({map:front,side:THREE.DoubleSide,metalness:.17,roughness:.65});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);shader.vertexShader=coneShader+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
      vec3 p0=paperPosition(uv),pu=paperPosition(uv+vec2(.02,0.0)),pv=paperPosition(uv+vec2(0.0,.02/1.377));
      vec3 objectNormal=normalize(cross(pu-p0,pv-p0));
    `).replace('#include <begin_vertex>','vec3 transformed=paperPosition(uv);');
    shader.fragmentShader='uniform sampler2D backPage;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`
      vec3 normal=normalize(vNormal);normal*=normal.z>=0.0?1.0:-1.0;
      vec3 nonPerturbedNormal=normal;
    `).replace('#include <map_fragment>',`
      vec4 front=texture2D(map,vMapUv),back=texture2D(backPage,vec2(1.0-vMapUv.x,vMapUv.y));
      diffuseColor*=gl_FrontFacing?front:back;
    `);
  };
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  depth.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);shader.vertexShader=coneShader+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=paperPosition(uv);');
  };
  const mesh=new THREE.Mesh(geometry,material);mesh.customDepthMaterial=depth;
  mesh.castShadow=mesh.receiveShadow=true;book.add(mesh);
  sheets.push({mesh,uniforms,front,current:index<page?1:0,grab:{x:1,y:0}});
}
function updateStatus(){status.textContent=`${page+1} / ${count} 页`;}
function begin(forward){
  if(turn||drag)return;
  if(forward?page>=count-1:page<=0)return;
  const sheet=sheets[forward?page:page-1];
  turn={sheet,from:sheet.current,to:forward?1:0,start:performance.now(),duration:1200};
  page+=forward?1:-1;updateStatus();
}
prev.onclick=()=>begin(false);next.onclick=()=>begin(true);
let touchOrigin=null;
function grab(sheet,event){
  const rect=canvas.getBoundingClientRect();
  sheet.grab={x:clamp((event.clientX-rect.left)/rect.width),y:clamp((rect.top+rect.height/2-event.clientY)/(rect.height*.4),-1,1)};
}
canvas.addEventListener('pointerdown',event=>{
  if(turn||drag||event.button!==0)return;
  const rect=canvas.getBoundingClientRect();
  const forward=event.clientX>rect.left+rect.width*.22;
  if(forward?page>=count-1:page<=0)return;
  const sheet=sheets[forward?page:page-1];grab(sheet,event);
  drag={sheet,forward,base:sheet.current,target:sheet.current,x:event.clientX,y:event.clientY,width:rect.width,moved:false};
  canvas.setPointerCapture(event.pointerId);
},{signal:controller.signal});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;
  const dx=event.clientX-drag.x;
  drag.moved ||= Math.hypot(dx,event.clientY-drag.y)>5;
  drag.target=clamp(drag.base-dx/drag.width/1.2);grab(drag.sheet,event);
},{signal:controller.signal});
function release(event){
  if(!drag)return;
  const d=drag;drag=null;
  const committed=event.type!=='pointercancel' && (!d.moved||Math.abs(d.target-d.base)>=.1);
  const to=committed?+d.forward:+!d.forward;
  if(committed)page+=d.forward?1:-1;
  turn={sheet:d.sheet,from:d.sheet.current,to,start:performance.now(),duration:1300*Math.sqrt(Math.max(.02,Math.abs(to-d.sheet.current)))};
  try{canvas.releasePointerCapture(event.pointerId);}catch{}
  updateStatus();
}
canvas.addEventListener('pointerup',release,{signal:controller.signal});
canvas.addEventListener('pointercancel',release,{signal:controller.signal});
canvas.addEventListener('touchstart',event=>{
  const t=event.touches[0];touchOrigin=event.touches.length===1?{x:t.clientX,y:t.clientY,claimed:false}:null;
},{passive:true,signal:controller.signal});
canvas.addEventListener('touchmove',event=>{
  if(!touchOrigin||event.touches.length!==1)return;
  const t=event.touches[0],dx=Math.abs(t.clientX-touchOrigin.x),dy=Math.abs(t.clientY-touchOrigin.y);
  if(dx>=4 && dy<dx*1.6)touchOrigin.claimed=true;
  if(touchOrigin.claimed && event.cancelable)event.preventDefault();
},{passive:false,signal:controller.signal});
const observer=new ResizeObserver(()=>{
  const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);
  camera.aspect=width/height;
  camera.position.set(.43,0,Math.max(2.45,.75/(camera.aspect*Math.tan(Math.PI/9))));
  camera.lookAt(.43,0,0);camera.updateProjectionMatrix();
});observer.observe(stage);updateStatus();prev.disabled=next.disabled=false;
let previous=performance.now();
renderer.setAnimationLoop(now=>{
  const dt=Math.min((now-previous)/1000,.1);previous=now;
  if(turn){
    const t=clamp((now-turn.start)/turn.duration),eased=(1-Math.cos((1-(1-t)**.8)*Math.PI))/2;
    turn.sheet.current=turn.from+(turn.to-turn.from)*eased;
    if(t===1){turn.sheet.current=turn.to;turn=null;}
  }
  if(drag)drag.sheet.current+=(drag.target-drag.sheet.current)*(1-Math.pow(.01,dt/.9));
  const shape=model.frame(sheets.map(s=>s.current),sheets.map(s=>s.grab));
  sheets.forEach((sheet,index)=>{
    const p=shape[index],u=sheet.uniforms;
    u.cone.value.set(...p.cone);u.tail.value.set(...p.tail);u.reach.value.set(...p.reach);
    u.bend.value=p.bend;u.rotation.value=p.rotation;u.pileLift.value=p.lift;u.taper.value=p.taper;
    // Continuous depth separation; never reorder a settling leaf discretely.
    u.layer.value=-.0002*index;
    sheet.mesh.visible=index<=page+3 || index<page || sheet===turn?.sheet || sheet===drag?.sheet;
    sheet.mesh.renderOrder=index;
  });
  renderer.render(scene,camera);
});
return {
  page:()=>page,
  dispose(){
    controller.abort();observer.disconnect();renderer.setAnimationLoop(null);
    prev.onclick=next.onclick=null;
    for(const sheet of sheets){sheet.front.dispose();sheet.mesh.material.dispose();sheet.mesh.customDepthMaterial.dispose();}
    geometry.dispose();blank.dispose();light.shadow.dispose();renderer.dispose();canvas.remove();
  }
};
