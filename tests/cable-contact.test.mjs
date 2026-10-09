import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mk3-test-'));
fs.cpSync(path.join(root,'dist'),path.join(temp,'dist'),{recursive:true});
for(const [f,imp] of [['drag-performance.js','./vendor/three.module.js'],['collision.js','./vendor/three.module.js'],['geometry.js','./vendor/three.module.js'],['vendor/OrbitControls.js','./three.module.js'],['vendor/OBB.js','./three.module.js']]){const p=path.join(temp,'dist',f);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll("'three'",JSON.stringify(imp)));}
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
class Element{constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.userData={};this.children=[];this.listeners={};this.options=[];this.value='';this.classList={toggle(){}};this.ownerDocument=globalThis.document;this.width=1280;this.height=800;}
 addEventListener(t,fn){(this.listeners[t]??=[]).push(fn);} removeEventListener(){} setPointerCapture(){}releasePointerCapture(){}getRootNode(){return document;}appendChild(c){this.children.push(c);return c;}replaceChildren(...c){this.children=c;this.options=c;}querySelector(){return new Element();}querySelectorAll(){return [];}getBoundingClientRect(){return{left:0,top:0,width:1280,height:800};}getContext(){return new Proxy({},{get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});}setAttribute(k,v){this[k]=v;}showModal(){this.open=true;}close(){this.open=false;}}
const els={};globalThis.document={createElement:t=>new Element(t),getElementById:id=>els[id]??(els[id]=new Element()),documentElement:{dataset:{}},addEventListener(){},removeEventListener(){}};els.segment=new Element();els.segment.options=[{},{}];els.segment.value='upper';globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.innerWidth=1280;globalThis.innerHeight=800;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=()=>{};globalThis.FakeRenderer=class{constructor(){this.domElement=new Element('canvas');this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}};
els.swapVariant=new Element('select');els.swapVariant.options=[{},{}];
let fakeNow=1000;
Object.defineProperty(globalThis,'performance',{value:{now:()=>fakeNow},configurable:true,writable:true});
const realNow=()=>Number(process.hrtime.bigint())/1e6;
const {loadApp}=await import('./support/load-app.mjs');const app=await loadApp(temp);
const bypass=await import(path.join(temp,'dist/app/bypass.js'));
const T=await import(path.join(temp,'dist/vendor/three.module.js'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
const frames=(n)=>{for(let k=0;k<n;k++){fakeNow+=16;app.animate(fakeNow);}};
const ropes=()=>[...app.parts.filter(p=>p.rope).map(p=>[p.id,p.rope]),['red lead',app.probeTools[0].lead],['black lead',app.probeTools[1].lead],...bypass.bypassRopes.map((r,i)=>['bypass '+i,r])];
function segDist(p0,p1,q0,q1){const d1=p1.clone().sub(p0),d2=q1.clone().sub(q0),r=p0.clone().sub(q0),a=d1.dot(d1),e=d2.dot(d2),f=d2.dot(r),c=d1.dot(r),b=d1.dot(d2),den=a*e-b*b;let s=den>1e-12?Math.min(1,Math.max(0,(b*f-c*e)/den)):0,t=(b*s+f)/e;if(t<0){t=0;s=Math.min(1,Math.max(0,-c/a));}else if(t>1){t=1;s=Math.min(1,Math.max(0,(b-c)/a));}return p0.clone().lerp(p1,s).distanceTo(q0.clone().lerp(q1,t));}
// Deepest overlap between two different cables (excluding the pinned ends at shared anchors).
function worstOverlap(){
  const R=ropes();let worst={depth:0};
  for(let x=0;x<R.length;x++)for(let y=x+1;y<R.length;y++){
    const [na,A]=R[x],[nb,B]=R[y],gap=A.radius+B.radius;
    for(let i=3;i<A.n-2;i++)for(let j=3;j<B.n-2;j++){
      const pa=A.pos[i],pb=B.pos[j];if(Math.abs(pa.x-pb.x)>1.5||Math.abs(pa.z-pb.z)>1.5||Math.abs(pa.y-pb.y)>1.5)continue;
      const d=segDist(A.pos[i-1],pa,B.pos[j-1],pb),depth=gap-d;
      if(depth>worst.depth)worst={depth,a:na,b:nb,at:pa.toArray().map(v=>v.toFixed(2)).join(',')};
    }
  }
  return worst;
}
let n=0,worstAll={depth:0};
const settle=(label)=>{frames(300);const w=worstOverlap();n++;if(w.depth>worstAll.depth)worstAll={...w,label};};
for(const code of ['assembly','healthy','F4'])app.buildScenario(code),settle(code);
for(let i=0;i<8;i++){els.lessonMenuItems.children[i].onclick();settle('lesson '+i);for(let k=0;k<20&&app.learning.active;k++){els.lessonNext.onclick();settle(`lesson ${i}.${k}`);}}
console.log('worst overlap',JSON.stringify(worstAll));
assert(worstAll.depth<0.02,`${n} settled states across scenarios and every lesson step: no two cables pass through each other (deepest overlap ${worstAll.depth.toFixed(3)} of ~0.1-0.17 combined thickness)`);
// The reported case: the red lead dragged across the taped bypass wires and the harness cable.
app.buildScenario('assembly');frames(60);
for(const [x,z] of [[1,2.6],[2.5,4.6],[4,4.3],[1.5,5.2]]){app.probeTools[0].group.position.set(x,.25,z);app.refreshProbes();frames(240);
  const w=worstOverlap();assert(w.depth<0.02,`Red lead laid across the bypass and harness cables at (${x}, ${z}) rests on them, not through them (deepest ${w.depth.toFixed(3)})`);}
// Cost
frames(400);let t=realNow();for(let k=0;k<60;k++){fakeNow+=16;app.animate(fakeNow);}const idle=(realNow()-t)/60;
app.probeTools[0].group.position.set(2,.25,3);app.refreshProbes();
t=realNow();for(let k=0;k<30;k++){app.probeTools[0].group.position.x+=0.05;app.refreshProbes();fakeNow+=16;app.animate(fakeNow);}const active=(realNow()-t)/30;
assert(idle<1.5&&active<6,`Cost with cable-to-cable contact: idle ${idle.toFixed(3)} ms, dragging a probe over cables ${active.toFixed(3)} ms`);
console.log('Cable-to-cable contact (1.18.1) checks passed.');
