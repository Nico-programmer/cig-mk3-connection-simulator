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
const cables=await import(path.join(temp,'dist/app/cables.js'));
const rope=await import(path.join(temp,'dist/app/rope.js'));
const T=await import(path.join(temp,'dist/vendor/three.module.js'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const frames=(n)=>{for(let k=0;k<n;k++){fakeNow+=16;app.animate(fakeNow);}};
const harnesses=()=>app.parts.filter(p=>p.cableGroup);
// Checks one settled harness: the cable leaves the back of both connectors, never enters a
// connector shell (so never comes out of a pin face), never goes under the table, no loop.
function inspect(p,label){
  const R=p.rope,P=R.pos;
  for(const q of P)check(Number.isFinite(q.x+q.y+q.z),`${label} ${p.id}: invalid point`);
  const ends=[cables.jacketEnd(p.ports[0]),cables.jacketEnd(p.ports[1])];
  check(P[0].distanceTo(ends[0].point)<1e-9&&P.at(-1).distanceTo(ends[1].point)<1e-9,`${label} ${p.id}: cable not attached at the jacket behind each connector`);
  for(const port of p.ports){
    const box=app.colliderOf(port.colliders[0]),inv=box.rotation.clone().transpose();
    for(const q of P.slice(2,-2)){const l=q.clone().sub(box.center).applyMatrix3(inv),h=box.halfSize;
      check(!(Math.abs(l.x)<h.x&&Math.abs(l.y)<h.y&&Math.abs(l.z)<h.z),`${label} ${p.id}: cable passes through connector ${port.kind}`);}
  }
  for(const q of P)check(q.y>=rope.groundAt()+R.radius-1e-3,`${label} ${p.id}: cable below the table (y ${q.y.toFixed(3)})`);
  let loop=0;for(const q of P)loop=Math.max(loop,q.distanceTo(P[0])+q.distanceTo(P.at(-1))-R.length);
  check(loop<0.05,`${label} ${p.id}: cable loop beyond its length`);
  check(R.length<=cables.HARNESS_MAX+1e-9,`${label} ${p.id}: cable longer than the harness`);
  let total=0;for(let k=1;k<P.length;k++)total+=P[k].distanceTo(P[k-1]);
  check(total<=R.length*1.02,`${label} ${p.id}: cable stretched (${(total/R.length).toFixed(3)})`);
}
let checked=0;
const settleAll=(label)=>{frames(240);for(const p of harnesses()){inspect(p,label);checked++;}};
// ---- wires ----
app.buildScenario('assembly');
for(const p of harnesses())for(const port of p.ports){
  check(port.wires?.length===4,`${port.id} has four coloured wires`);
  const colors=port.wires.map(w=>w.material.color.getHex());
  check(JSON.stringify(colors)===JSON.stringify([0xb33227,0x17191b,0xc5722e,0x755042]),`${port.id} wire colours red/black/orange/brown`);
  for(const w of port.wires)check(w.position.z<-0.3,`${port.id} wires sit behind the shell`);
}
assert(true,'Every harness connector shows its four coloured wires (red, black, orange, brown) behind the shell');
// ---- every scenario and every lesson step ----
for(const code of ['assembly','healthy','F1','F4','F5','F9','F12'])app.buildScenario(code),settleAll(code);
for(let i=0;i<8;i++){els.lessonMenuItems.children[i].onclick();settleAll('lesson '+i);for(let k=0;k<20&&app.learning.active;k++){els.lessonNext.onclick();settleAll(`lesson ${i}.${k}`);}}
for(const v of ['screen','vehicle']){els.swapVariant.value=v;els.swapVariant.onchange();settleAll('swap '+v);}
assert(true,`${checked} settled harness checks across all scenarios and every lesson step: cables leave the back of the connectors, never pass through a connector or under the table, no loop, no stretch`);
// ---- the reported case: voltage lesson, orange connector disconnected ----
els.lessonMenuItems.children[2].onclick();frames(60);
const upper=app.workParts[1];app.select(upper.ports[0]);
assert(app.disconnectSelected(),'Orange connector disconnects in the voltage lesson');
frames(240);inspect(upper,'orange disconnected');
const back=cables.jacketEnd(upper.ports[0]);
const local=upper.ports[0].group.worldToLocal(upper.rope.pos[0].clone());
assert(local.z<-0.6&&Math.hypot(local.x,local.y)<1e-6,'After disconnecting, the cable still starts at the back of the orange connector, not at its pin face');
const inFront=upper.rope.pos.filter(q=>{const l=upper.ports[0].group.worldToLocal(q.clone());return l.z>0&&l.z<1.2&&Math.abs(l.x)<0.9&&Math.abs(l.y)<0.6;}).length;
assert(inFront===0,'No part of the cable lies in front of the orange connector\'s pin face (the 1.16 cable came out of it)');
// ---- reach: a harness connector stops where its cable runs out ----
app.buildScenario('assembly');frames(30);
const lower=app.workParts[2],moving=lower.ports[1],other=lower.ports[0];app.select(moving);
for(let k=0;k<40;k++){app.moveSelected(app.worldPos(moving).add(app.V(.6,0,.25)));frames(2);}
const gap=cables.jacketEnd(moving).point.distanceTo(cables.jacketEnd(other).point);
frames(240);inspect(lower,'reach');
assert(gap<=cables.HARNESS_REACH+1e-6&&gap>cables.HARNESS_REACH-0.6,`A dragged connector stops at the harness reach (${gap.toFixed(2)} of ${cables.HARNESS_REACH.toFixed(2)}); the cable is not stretched`);
// ---- cost ----
app.buildScenario('healthy');frames(400);
let t=realNow();for(let k=0;k<60;k++){fakeNow+=16;app.animate(fakeNow);}const idle=(realNow()-t)/60;
assert(idle<1.5,`Idle frame with all ${harnesses().length} harness cables, both leads and the bypass cables (since 1.18) asleep: ${idle.toFixed(3)} ms`);
app.select(lower.ports[1]);
t=realNow();for(let k=0;k<30;k++){app.moveSelected(app.worldPos(app.workParts[2].ports[1]).add(app.V(0,0,.03)));fakeNow+=16;app.animate(fakeNow);}const drag=(realNow()-t)/30;
assert(drag<8,`Frame while dragging a harness connector: ${drag.toFixed(3)} ms`);
console.log('Harness cables (1.17) checks passed.');
