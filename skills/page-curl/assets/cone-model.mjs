// Independent reconstruction of the narrow-screen roll geometry.
// Model coordinates: width 1, height 1.377, fixed spine at x=0.
export const ASPECT=1.377;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const hash=(x,seed)=>{const n=Math.sin(x*12.9898+seed*78.233)*43758.5453;return n-Math.floor(n);};
function cumulative(count,seed,power,total=1){
  if(count<1)return [0];
  const weights=Array.from({length:count},(_,i)=>hash(i+1,seed)**power);
  const sum=weights.reduce((a,b)=>a+b,0);
  const result=[0];
  for(const weight of weights)result.push(result.at(-1)+total*(.1/count+.9*weight/sum));
  return result;
}
export function createConeModel(count){
  if(!Number.isInteger(count)||count<1)throw new Error('At least one page is required');
  const radiusOffsets=cumulative(count-1,41.5,7.5);
  const depths=cumulative(count,41.5,1.6,count);
  const depthAt=turns=>{
    const integer=Math.floor(clamp(turns,0,count));
    return integer>=count?count:depths[integer]+(depths[integer+1]-depths[integer])*(turns-integer);
  };
  const heightAt=depth=>.08/(1+depth*.5)*(1-.002*depth);
  function reach(height){
    let length=0;
    const profile=x=>height*Math.sqrt(Math.max(0,1-(1-Math.min(x/.4,1))**2))*(1-.5*smooth((x-.4)/.6));
    for(let i=0;i<6;i++){
      const a=(i/6)**2,b=((i+1)/6)**2;
      length+=Math.hypot(b-a,profile(b)-profile(a));
    }
    return Math.max(.5,2-length);
  }
  function frame(progresses,grabs=[]){
    if(progresses.length!==count)throw new Error('Progress count does not match pages');
    const total=progresses.reduce((sum,p)=>sum+clamp(p),0);
    const depth=depthAt(total),opening=(100+90*(Math.min(depth/Math.max(1,count-1),1)**4))*Math.PI/180;
    const close=clamp(total-(count-1));
    const flatten=smooth((close-.6)/.4);
    return progresses.map((raw,index)=>{
      const p=clamp(raw),fall=Math.max(smooth((depth-index-1-15)/3),flatten);
      const ratio=radiusOffsets[index]??0;
      let top=(.04+.14*ratio)*(1-fall),bottom=(.01+.04*ratio)*(1-fall);
      const even=Math.min(depth/count,1)**6,average=(top+bottom)/2;
      top+=(average-top)*even;bottom+=(average-bottom)*even;
      const fallen=fall>=1;
      const remaining=Math.max(0,count-total);
      const stackDepth=fallen?remaining+index:Math.max(0,index-total);
      const shown=fallen?Math.max(smooth(depth-index-1-18),+(close>=1)):(1-p)*(1-flatten);
      const liftShare=.67+.33*depth/count;
      let lift=heightAt(stackDepth)*(fallen?.67:liftShare);
      lift+=(heightAt(index)*.67-lift)*flatten;lift*=shown;
      let taper=-.6*lift/Math.max(heightAt(0)*(liftShare+(.67-liftShare)*flatten),.001);
      const grab=grabs[index]??{x:1,y:0};
      const tilt=grab.y*(.5+.5*grab.x)*35*Math.PI/180;
      if(fallen)return {cone:[0,1,0],tail:[1,0,1,1],bend:0,rotation:2*Math.PI*p,lift,taper,reach:[reach(lift*(1-taper*.5)),reach(lift*(1+taper*.5))]};
      const lead=2*Math.PI*(1-(1-p)**2),rotation=Math.min(lead,opening),wrap=lead-rotation;
      const rollingGain=1+1.5*(1-smooth(wrap/Math.max(2*Math.PI-opening,.001)));
      const topRadius=Math.max(top*rollingGain,.0001),slope=clamp((bottom*rollingGain-topRadius)/ASPECT,-.999,.999);
      const edge=x=>{
        const radius=Math.max(.00001,topRadius+(ASPECT/2-x)*slope);
        return Math.abs(slope)<.0001?radius*wrap:radius*Math.tan(clamp(slope*wrap,-1.5,1.5))/slope;
      };
      const correctedTilt=tilt+(Math.atan2(edge(-ASPECT/2)-edge(ASPECT/2),ASPECT)-tilt)*smooth(p);
      const c=Math.cos(correctedTilt),s=Math.sin(correctedTilt);
      const curlStart=Math.max(edge(ASPECT/2)*c+ASPECT/2*s,edge(-ASPECT/2)*c-ASPECT/2*s);
      const curlLength=Math.max(c+ASPECT/2*Math.abs(s)-curlStart,.001);
      const shut=1-smooth(lead/opening);lift*=shut;taper*=shut;
      const bend=Math.max(2*(1-smooth((p-.3)/.5))*Math.min(2*Math.PI*p-lead,0),-lead);
      return {cone:[slope,topRadius,wrap],tail:[c,s,curlStart,curlLength],bend,rotation,lift,taper,reach:[reach(lift*(1-taper*.5)),reach(lift*(1+taper*.5))]};
    });
  }
  return {frame};
}

// Analytic cone wrap. Once the cap angle is reached the remaining paper
// continues along its tangent, making a flat leaf emerge from a rolled spine.
export function wrapCone(x,y,[slope,topRadius,maxAngle]){
  const radius=Math.max(1e-5,topRadius+(ASPECT/2-y)*slope);
  const slant=x*slope/radius;
  const lean=Math.abs(slant)<1e-3?1-slant*slant/3:Math.atan(slant)/slant;
  const angle=x/radius*lean;
  const cosCone=Math.sqrt(Math.max(0,1-slope*slope));
  if(angle<=maxAngle){
    const distance=Math.hypot(radius,x*slope),vers=1-Math.cos(angle);
    return [distance*Math.sin(angle),y+slope*(distance*vers-x*x/(radius+distance)),distance*cosCone*vers];
  }
  const fan=slope*maxAngle;
  const sinc=Math.abs(fan)<1e-3?1-fan*fan/6:Math.sin(fan)/fan;
  const vers=Math.abs(fan)<1e-3?fan*(.5-fan*fan/24):(1-Math.cos(fan))/fan;
  const along=x*slope*Math.sin(fan)+radius*Math.cos(fan);
  const past=x*Math.cos(fan)-radius*maxAngle*sinc;
  const lift=along*(1-Math.cos(maxAngle))+past*Math.sin(maxAngle);
  return [along*Math.sin(maxAngle)+past*Math.cos(maxAngle),y+radius*maxAngle*vers-x*Math.sin(fan)+slope*lift,cosCone*lift];
}

export const coneShader=`
uniform vec3 cone;
uniform vec4 tail;
uniform vec2 reach;
uniform float bend;
uniform float rotation;
uniform float pileLift;
uniform float taper;
uniform float layer;
vec3 conePosition(vec2 p) {
  float r=max(.00001,cone.y+(.6885-p.y)*cone.x);
  float slant=p.x*cone.x/r;
  float lean=abs(slant)<.001?1.0-slant*slant/3.0:atan(slant)/slant;
  float theta=p.x/r*lean;
  float cosCone=sqrt(max(0.0,1.0-cone.x*cone.x));
  if(theta<=cone.z){
    float d=length(vec2(r,p.x*cone.x));
    return vec3(d*sin(theta),p.y+cone.x*(d*(1.0-cos(theta))-p.x*p.x/(r+d)),d*cosCone*(1.0-cos(theta)));
  }
  float fan=cone.x*cone.z;
  float sinc=abs(fan)<.001?1.0-fan*fan/6.0:sin(fan)/fan;
  float vers=abs(fan)<.001?fan*(.5-fan*fan/24.0):(1.0-cos(fan))/fan;
  float along=p.x*cone.x*sin(fan)+r*cos(fan);
  float past=p.x*cos(fan)-r*cone.z*sinc;
  float lift=along*(1.0-cos(cone.z))+past*sin(cone.z);
  return vec3(along*sin(cone.z)+past*cos(cone.z),p.y+r*cone.z*vers-p.x*sin(fan)+cone.x*lift,cosCone*lift);
}
vec3 paperPosition(vec2 uv){
  float y=(uv.y-.5)*1.377;
  float x=uv.x*mix(reach.x,reach.y,uv.y);
  float along=x*tail.x+y*tail.y,across=-x*tail.y+y*tail.x;
  float beyond=max(0.0,along-tail.z),angle=beyond/tail.w*bend;
  float sinc=abs(angle)<.0001?1.0:sin(angle)/angle;
  float vers=abs(angle)<.0001?0.0:(1.0-cos(angle))/angle;
  float curled=along-beyond+beyond*sinc;
  vec2 tailPoint=vec2(curled*tail.x-across*tail.y,curled*tail.y+across*tail.x);
  vec3 shape=conePosition(tailPoint);
  float tailZ=beyond*vers;
  if(abs(tailZ)>.00001){
    vec3 dx=conePosition(tailPoint+vec2(.001,0.0))-shape;
    vec3 dy=conePosition(tailPoint+vec2(0.0,.001))-shape;
    shape+=normalize(cross(dx,dy))*tailZ;
  }
  float liftT=1.0-min(x/.4,1.0);
  shape.z+=pileLift*sqrt(max(0.0,1.0-liftT*liftT))*(1.0-.5*smoothstep(.4,1.0,x))*(1.0+taper*y/1.377);
  float c=cos(rotation),s=sin(rotation);
  return vec3(shape.x*c-shape.z*s,shape.y,shape.x*s+shape.z*c+layer);
}
`;

