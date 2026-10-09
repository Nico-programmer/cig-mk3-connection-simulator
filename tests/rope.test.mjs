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
const probes=await import(path.join(temp,'dist/app/probes.js'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const frame=()=>{fakeNow+=16;app.animate(fakeNow);};
// ---- invariants of one lead ----
let worst={loop:0,stretch:0,depth:0};const inside=[0,0],overStretch=[0,0],lastDepth=[0,0],lastStretch=[0,0],lastTotal=[1,1];let grace=0;
function inspect(i,label){
  const tool=app.probeTools[i],L=tool.lead,P=L.pos,e=probes.leadEnds(i),seg=L.length/(P.length-1);
  for(const p of P)check(Number.isFinite(p.x+p.y+p.z),`${label}: lead ${i} has an invalid point`);
  check(L.length<=probes.LEAD_MAX+1e-9,`${label}: lead ${i} longer than its maximum`);
  let loop=0,stretch=0,depth=0;
  for(const p of P)loop=Math.max(loop,p.distanceTo(e.a)+p.distanceTo(e.b)-L.length);
  for(let k=1;k<P.length;k++)stretch=Math.max(stretch,P[k].distanceTo(P[k-1])/seg);
  for(const p of P.slice(2,-2))for(const m of app.allColliders){if(L.ignores(m))continue;const o=app.colliderOf(m),loc=p.clone().sub(o.center).applyMatrix3(o.rotation.clone().transpose()),h=o.halfSize;
    const d=Math.min(h.x-Math.abs(loc.x),h.y-Math.abs(loc.y),h.z-Math.abs(loc.z));if(d>depth)depth=d;}
  worst.loop=Math.max(worst.loop,loop);worst.stretch=Math.max(worst.stretch,stretch);worst.depth=Math.max(worst.depth,depth);
  check(loop<0.05,`${label}: lead ${i} forms a loop beyond its length (excess ${loop.toFixed(3)})`);
  let total=0;for(let k=1;k<P.length;k++)total+=P[k].distanceTo(P[k-1]);
  worst.total=Math.max(worst.total||0,total/L.length);
  // No rubber cable: while things move the whole lead never exceeds its length by 10 % (2 %
  // once settled, checked below). The tube is drawn as one smooth curve through every point,
  // so a longer segment leaves no visible gap; the per-segment bound (0.3 units while moving,
  // 0.05 settled) only guards against numerical blow-ups.
  const gap=(stretch-1)*seg;worst.gap=Math.max(worst.gap||0,gap);lastTotal[i]=total/L.length;
  if(grace>0)return; // the world just jumped (scenario, lesson, reset, teleport): loops and NaN only
  // A solid swept a long way in one frame (a 3-unit drag of the other probe) can shove a lead
  // for that single frame (1.18.1, since cables also rest on each other); it must recover on
  // the very next frame and never exceed 25 %.
  overStretch[i]=total>L.length*1.10?overStretch[i]+1:0;
  check(total<=L.length*1.25&&overStretch[i]<=1,`${label}: lead ${i} stretched as a whole (${(total/L.length).toFixed(3)})`);
  check(gap<0.3,`${label}: lead ${i} segment opened ${gap.toFixed(3)} beyond its length`);
  lastStretch[i]=gap;
  // A fast move can graze a solid for a moment; it must clear within 4 frames (0.07 s) and never go deep.
  inside[i]=depth>0.03?inside[i]+1:0;
  check(depth<0.12,`${label}: lead ${i} centre ${depth.toFixed(3)} deep inside a solid`);
  check(inside[i]<=4,`${label}: lead ${i} stays inside a solid for ${inside[i]} frames`);
  lastDepth[i]=depth;
}
const run=(n,label)=>{for(let k=0;k<n;k++){frame();inspect(0,label);inspect(1,label);if(grace>0)grace--;}};
// ---- rest: hangs, sleeps, cheap ----
app.buildScenario('assembly');run(240,'rest');
for(const i of [0,1]){const L=app.probeTools[i].lead,e=probes.leadEnds(i),low=Math.min(...L.pos.slice(2,-2).map(p=>p.y));
  assert(low<Math.min(e.a.y,e.b.y)-0.3,`Lead ${i} hangs under its own weight (lowest point ${low.toFixed(2)} below both ends)`);
  assert(L.sleep>=20,`Lead ${i} goes to sleep when nothing moves`);}
let t=realNow();for(let k=0;k<60;k++)frame();const idle=(realNow()-t)/60;
assert(idle<1.0,`Idle frame with every cable asleep (2 leads + 4 harnesses since 1.17): ${idle.toFixed(3)} ms`);
// ---- measurement in a lesson ----
els.lessonMenuItems.children[5].onclick();run(90,'lesson start');
const pinPort=(kind)=>app.workParts.flatMap(p=>p.ports).find(p=>p.kind===kind);
function fixturePlace(i,kind,n){const port=pinPort(kind),pose=app.probePose({port,n},.18);const g=app.probeTools[i].group;g.position.copy(pose.position);g.quaternion.copy(pose.quaternion);app.refreshProbes();app.refreshColliders();return app.placeProbe(i,{port,n});}
els.modeContinuity.onclick();
assert(fixturePlace(0,'orange',9)&&fixturePlace(1,'circular',1),'Both probes connect at screen pin 9 and EM pin 1');
t=realNow();for(let k=0;k<30;k++)frame();const active=(realNow()-t)/30;run(30,'measuring');
run(300,'measuring settle');
assert(app.meterResult&&app.meterResult!=='—','The meter reads with both leads simulated ('+app.meterResult+')');
assert(active<6,`Whole frame (render mocked) with both leads moving, the harness cables settling after a lesson change and cable-to-cable contact (1.18.1, budget 6 ms): ${active.toFixed(3)} ms`);
// ---- reach limit ----
els.removeProbe0.onclick();run(30,'removed');
const tool=app.probeTools[0],far=probes.leadEnds(0).a.clone().add(app.V(-30,1.5,-14));
for(let k=0;k<40;k++){app.moveProbe(0,tool.group.position.clone().lerp(far,.2));frame();inspect(0,'reach');inspect(1,'reach');}
const reach=probes.leadEnds(0);
assert(reach.a.distanceTo(reach.b)<=probes.LEAD_REACH+1e-6&&tool.blocked,`A probe stops at the lead's reach (${probes.LEAD_REACH.toFixed(1)} units) instead of stretching it`);
// ---- abuse: fast drags, jumps, resets, scenario and lesson switches ----
let seed=777;const rnd=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
for(let k=0;k<120;k++){
  const r=rnd(),i=rnd()<.5?0:1,g=app.probeTools[i].group;
  if(r<.55){app.probeTools[i].contact=null;app.moveProbe(i,g.position.clone().add(app.V((rnd()-.5)*6,(rnd()-.3)*2,(rnd()-.5)*6)));}
  else if(r<.7){g.position.add(app.V((rnd()-.5)*8,rnd()*2,(rnd()-.5)*8));app.refreshProbes();grace=3;}   // teleport
  else if(r<.8){app.buildScenario(['assembly','healthy','F4'][Math.floor(rnd()*3)]);grace=3;}
  else if(r<.9){els.lessonMenuItems.children[Math.floor(rnd()*8)].onclick();grace=3;}
  else {app.resetProbeTools?.();grace=3;}
  run(1+Math.floor(rnd()*12),'abuse '+k);
}
run(400,'abuse settle');
assert(lastTotal[0]<1.02&&lastTotal[1]<1.02,`Once settled, neither lead is stretched as a whole (${lastTotal.map(v=>((v-1)*100).toFixed(1)+' %').join(', ')})`);
assert(lastStretch[0]<0.05&&lastStretch[1]<0.05,`Once settled, no segment of either lead opens more than 0.05 (worst ${Math.max(...lastStretch).toFixed(3)})`);
assert(lastDepth[0]<0.005&&lastDepth[1]<0.005,`Once settled, both leads are completely outside every solid (depth ${lastDepth.map(d=>d.toFixed(3)).join(', ')})`);
assert(worst.loop<0.05,`Abuse run: 120 random drags, teleports, resets, scenario and lesson changes, checked every frame: never a loop (worst excess ${worst.loop.toFixed(3)}), worst whole-lead stretch ${((worst.total-1)*100).toFixed(1)} %, worst momentary segment opening ${(worst.gap||0).toFixed(3)} units, worst momentary graze ${worst.depth.toFixed(3)}`);
for(const i of [0,1]){const e=probes.leadEnds(i),d=e.a.distanceTo(e.b),L=app.probeTools[i].lead.length;
  assert(L<=probes.leadLength(d)*1.6+0.5,`Lead ${i} keeps a sensible length after the abuse run: ${L.toFixed(2)} for a ${d.toFixed(2)} gap (nominal ${probes.leadLength(d).toFixed(2)})`);}
console.log('Meter lead ropes (1.16) checks passed.');
