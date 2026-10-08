import {prepareMount,loadTextures} from './runtime-support.mjs';
/** @param {import('./api.js').MountOptions} options @returns {Promise<import('./api.js').PageCurlHandle>} */
export async function mountDesktop(options){
const {THREE,stage,prev,next,status,config,env,scope,controller}=prepareMount(options);
const {createCanvas,ResizeObserver,performance,devicePixelRatio}=env;
try{
stage.dataset.mode='desktop';
const sheetCount = config.pages.length ? config.pages.length/2 : 6;
prev.disabled=true;
next.disabled=true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
camera.position.set(0, 0, 3.25);
const renderer = scope.own(new THREE.WebGLRenderer({ antialias: true, alpha: true }));
scope.add(()=>renderer.setAnimationLoop(null));
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.append(renderer.domElement);
scope.add(()=>renderer.domElement.remove());
scene.add(new THREE.HemisphereLight(0xffffff, 0xa1aeaf, 1.5));
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(-3.5, 1.3, 4.1);
light.castShadow = true;scope.own(light.shadow);
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1.5, far: 6.6 });
light.shadow.camera.updateProjectionMatrix();
light.shadow.bias = -0.001;
scene.add(light);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.15 }));
ground.position.z = -0.025;
ground.receiveShadow = true;
scene.add(ground);scope.own(ground.geometry);scope.own(ground.material);

// x = UV.x 保证书脊恒定位于 x=0。网格细分负责提供可弯曲的顶点。
const geometry = scope.own(new THREE.PlaneGeometry(1, 1.377, 64, 88));
const sheetShape = `
uniform float progress;
uniform float foldTilt;
uniform float turnDirection;
uniform float stackLift;
const float PI = 3.14159265359;
vec3 paperPosition(vec2 coord) {
  float x = coord.x;
  float y = (coord.y - .5) * 1.377;
  float c = cos(foldTilt), s = sin(foldTilt);
  float localU = x*c + y*s;
  float localV = -x*s + y*c;
  float lengthOfCurl = 1.0 - .6885*sin(abs(foldTilt));
  float curlStart = 1.0 - lengthOfCurl;
  float beyond = max(0.0, localU - curlStart);
  float bend = sin(progress*PI)*PI*.88;
  float angle = beyond/lengthOfCurl*bend;
  float sinc = abs(angle)<.0001 ? 1.0 : sin(angle)/angle;
  float versine = abs(angle)<.0001 ? 0.0 : (1.0-cos(angle))/angle;
  float bentU = localU-beyond+beyond*sinc;
  vec3 p = vec3(bentU*c-localV*s, bentU*s+localV*c, -turnDirection*beyond*versine);
  // 卷曲补偿让纸张在翻页途中拱起。
  float rotation = progress*PI + .5*turnDirection*(1.0-cos(bend))/max(bend,.0001);
  p.xz = mat2(cos(rotation),sin(rotation),-sin(rotation),cos(rotation))*p.xz;
  float lift = .04*sin(min(x/.14,1.0)*PI*.5);
  float wrinkle = .006*sin(x*8.0+y*5.0)*smoothstep(0.0,.35,x);
  p.z += lift + stackLift + wrinkle*cos(progress*PI);
  return p;
}
`;

function pageTexture(number) {
  const c = createCanvas();
  c.width = 720; c.height = 992;
  const ctx = c.getContext('2d');
  const dark = number % 4 < 2;
  ctx.fillStyle = dark ? '#22221f' : '#f4f3e9'; ctx.fillRect(0, 0, 720, 992);
  ctx.strokeStyle = dark ? '#33332d' : '#d4dddf';
  for (let x=24; x<720; x+=24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,992); ctx.stroke(); }
  ctx.fillStyle = dark ? '#cb9950' : '#427db4'; ctx.font = '18px monospace';
  ctx.fillText('PAPER / PROCEDURAL SURFACE', 35, 55);
  ctx.font = 'bold 210px monospace'; ctx.fillText(String.fromCharCode(65+number), 35, 320);
  ctx.font = 'bold 75px monospace'; ctx.fillText('AaBbCc', 35, 440); ctx.fillText('DdEeFf',35,530);
  ctx.fillStyle = dark ? '#e9e8df' : '#22221f'; ctx.font = '26px monospace';
  ['A plane becomes a page.', 'UV → curl → rotation', 'Normals follow the bend.', 'Light reveals the paper.', '', 'Drag to turn the page.'].forEach((text,i)=>ctx.fillText(text,35,650+i*42));
  ctx.font = '18px monospace'; ctx.fillText(`SIDE ${String(number+1).padStart(2,'0')}`,35,950);
  const texture = scope.own(new THREE.CanvasTexture(c)); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
const sheets = [];
let spread = Math.floor(config.startPage/2), drag = null, turn = null, hovering = null;
const importedTextures = await loadTextures(THREE,config.pages,scope,env).catch(error=>{
  if(error.name!=='AbortError')status.textContent='页面内容加载失败：'+error.message;
  throw error;
});
scope.assertActive();
for(const texture of importedTextures){
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
}
const textureAt = number => importedTextures[number] ?? pageTexture(number);
for (let index=0; index<sheetCount; index++) {
  const uniforms = {
    progress:{value:index<spread?1:0}, foldTilt:{value:0}, turnDirection:{value:1},
    stackLift:{value:0}, backPage:{value:textureAt(index*2+1)}
  };
  const material = new THREE.MeshStandardMaterial({ map:textureAt(index*2), side:THREE.DoubleSide, metalness:.17, roughness:.5 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = sheetShape + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      vec3 p0 = paperPosition(uv);
      vec3 pu = paperPosition(uv+vec2(.01,0.0));
      vec3 pv = paperPosition(uv+vec2(0.0,.01/1.377));
      vec3 objectNormal = normalize(cross(pu-p0,pv-p0));
    `).replace('#include <begin_vertex>', 'vec3 transformed = paperPosition(uv);');
    shader.fragmentShader = 'uniform sampler2D backPage;\n' + shader.fragmentShader;
    // 使用变形后的法线确定朝向。卷曲网格的三角形朝向与插值法线
    // 在卷角附近可能不一致，默认双面翻转会造成突然变暗。
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
      vec3 normal = normalize(vNormal);
      normal *= normal.z >= 0.0 ? 1.0 : -1.0;
      vec3 nonPerturbedNormal = normal;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec4 front = texture2D(map,vMapUv);
      vec4 back = texture2D(backPage,vec2(1.0-vMapUv.x,vMapUv.y));
      diffuseColor *= gl_FrontFacing ? front : back;
    `);
  };
  scope.own(material);
  // 阴影使用同一变形公式，否则阴影仍会是平纸形状。
  const depth = new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  depth.onBeforeCompile = shader => {
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader = sheetShape+shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed = paperPosition(uv);');
  };
  scope.own(depth);
  const mesh = new THREE.Mesh(geometry,material);
  mesh.customDepthMaterial=depth; mesh.castShadow=true; mesh.receiveShadow=true;
  scene.add(mesh);
  sheets.push({mesh,uniforms,current:index<spread?1:0});
}
function updateStatus() { status.textContent=`${spread} / ${sheets.length} 张`; }
function startTurn(forward) {
  if(scope.disposed || turn || drag) return;
  const index=forward?spread:spread-1;
  if(index<0 || index>=sheets.length) return;
  const sheet=sheets[index]; sheet.uniforms.turnDirection.value=forward?1:-1;
  hovering=null;
  turn={sheet,from:sheet.current,to:forward?1:0,start:performance.now(),duration:850};
  spread+=forward?1:-1; updateStatus();
}
next.onclick=()=>startTurn(true);
prev.onclick=()=>startTurn(false);
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',event=>{
  if(turn || event.button!==0) return;
  const rect=canvas.getBoundingClientRect(), forward=event.clientX>rect.left+rect.width/2;
  const sheet=sheets[forward?spread:spread-1]; if(!sheet)return;
  hovering=null;
  sheet.uniforms.turnDirection.value=forward?1:-1;
  drag={sheet,forward,x:event.clientX,base:sheet.current,target:sheet.current,width:rect.width,moved:false};
  canvas.setPointerCapture(event.pointerId);
},{signal:controller.signal});
canvas.addEventListener('pointermove',event=>{
  if(turn)return;
  const rect=canvas.getBoundingClientRect();
  hovering=drag?null:(event.clientX>rect.left+rect.width/2?spread:spread-1);
  const sheet=drag?.sheet || sheets[hovering];
  if(sheet)sheet.uniforms.foldTilt.value=THREE.MathUtils.clamp((event.clientY-rect.top-rect.height/2)/rect.height*1.4,-.7,.7);
  if(!drag)return;
  const dx=event.clientX-drag.x; drag.moved ||= Math.abs(dx)>5;
  drag.target=THREE.MathUtils.clamp(drag.base-dx/drag.width/.8,0,1);
},{signal:controller.signal});
canvas.addEventListener('pointerleave',()=>hovering=null,{signal:controller.signal});
function release(event) {
  if(!drag)return;
  const d=drag; drag=null;
  hovering=null;
  const committed=event.type!=='pointercancel' && (!d.moved || Math.abs(d.target-d.base)>=.2);
  const to=committed?(d.forward?1:0):(d.forward?0:1);
  if(committed)spread+=d.forward?1:-1;
  turn={sheet:d.sheet,from:d.sheet.current,to,start:performance.now(),duration:1000*Math.sqrt(Math.max(.05,Math.abs(to-d.sheet.current)))};
  canvas.releasePointerCapture(event.pointerId); updateStatus();
}
canvas.addEventListener('pointerup',release,{signal:controller.signal}); canvas.addEventListener('pointercancel',release,{signal:controller.signal});
const observer=new ResizeObserver(()=>{
  const {width,height}=stage.getBoundingClientRect();
  renderer.setSize(width,height); camera.aspect=width/height;
  camera.position.z=Math.max(2.5,1.2/(camera.aspect*Math.tan(Math.PI/9)));
  camera.updateProjectionMatrix();
});scope.add(()=>observer.disconnect());observer.observe(stage);
updateStatus();
prev.disabled=false;
next.disabled=false;
let previous=performance.now();
renderer.setAnimationLoop(now=>{
  const dt=Math.max(0,Math.min((now-previous)/1000,.1)); previous=now;
  if(turn){
    const t=THREE.MathUtils.clamp((now-turn.start)/turn.duration,0,1);
    turn.sheet.current=THREE.MathUtils.lerp(turn.from,turn.to,(1-Math.cos(t*Math.PI))/2);
    if(t===1)turn=null;
  }
  for(let index=0;index<sheets.length;index++){
    const sheet=sheets[index], busy=turn?.sheet===sheet || drag?.sheet===sheet;
    if(drag?.sheet===sheet)sheet.current+=(drag.target-sheet.current)*(1-Math.pow(.01,dt/.9));
    else if(!busy){
      const rest=index<spread?1:0, target=hovering===index?rest+(rest?-.03:.03):rest;
      sheet.uniforms.turnDirection.value=1;
      sheet.current+=(target-sheet.current)*(1-Math.pow(.001,dt/2));
      if(Math.abs(sheet.current-target)<.0001)sheet.current=target;
    }
    sheet.uniforms.progress.value=sheet.current;
    // 左右页堆的高度从物理纸张编号和连续进度计算。
    // 不能用spread更新高度：spread在翻页开始时就改变，导致纸层
    // 突然重叠/穿插，落地后再露出另一种颜色。
    sheet.uniforms.stackLift.value=-.003*THREE.MathUtils.lerp(index,sheets.length-1-index,sheet.current);
    sheet.mesh.renderOrder=index;
  }
  renderer.render(scene,camera);
});
const nextHandler=next.onclick,prevHandler=prev.onclick;
scope.add(()=>{if(next.onclick===nextHandler)next.onclick=null;if(prev.onclick===prevHandler)prev.onclick=null;});
options.debug?.({sheets,renderer,startTurn,state:()=>({spread,drag,turn,hovering})});
scope.assertActive();
return {page:()=>spread*2,next:()=>startTurn(true),previous:()=>startTurn(false),dispose:()=>scope.dispose()};
}catch(error){scope.dispose();throw error;}
}
