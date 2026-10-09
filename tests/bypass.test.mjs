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
const rope=await import(path.join(temp,'dist/app/rope.js'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const frames=(n)=>{for(let k=0;k<n;k++){fakeNow+=16;app.animate(fakeNow);}};
const names=['vehicleA cable','relayA to tape','relayA to harness','vehicleB cable','relayB to tape','relayB to harness'];
// Every connector shell on the bench (harness connectors, EM and screen ports, bypass connectors).
const shells=()=>[...app.parts.flatMap(p=>p.ports),...app.bypassPorts].flatMap(p=>p.colliders.map(m=>({port:p,m})));
function inspect(label){
  const circular=app.workParts[2].ports[1];
  bypass.bypassRopes.forEach((R,k)=>{
    const P=R.pos,name=`${label}: ${names[k]}`;
    for(const q of P)check(Number.isFinite(q.x+q.y+q.z),`${name} invalid point`);
    for(const {port,m} of shells()){const box=app.colliderOf(m),inv=box.rotation.clone().transpose(),h=box.halfSize;
      for(const q of P.slice(2,-2)){const l=q.clone().sub(box.center).applyMatrix3(inv);
        check(!(Math.abs(l.x)<h.x&&Math.abs(l.y)<h.y&&Math.abs(l.z)<h.z),`${name} passes through connector ${port.id}`);}}
    // nothing in front of the circular connector's pin face
    for(const q of P){const l=circular.group.worldToLocal(q.clone());check(!(l.z>0&&l.z<1.0&&Math.hypot(l.x,l.y)<0.6),`${name} lies in front of the circular connector's pin face`);}
    for(const q of P)check(q.y>=rope.groundAt()+R.radius-1e-3,`${name} below the table`);
    let loop=0;for(const q of P)loop=Math.max(loop,q.distanceTo(P[0])+q.distanceTo(P.at(-1))-R.length);check(loop<0.05,`${name} loop`);
    let total=0;for(let i=1;i<P.length;i++)total+=P[i].distanceTo(P[i-1]);check(total<=R.length*1.02,`${name} stretched (${(total/R.length).toFixed(3)})`);
  });
}
let checks=0;const settle=(label)=>{frames(300);inspect(label);checks++;};
app.buildScenario('assembly');frames(5);
assert(bypass.bypassRopes.length===6,'Six bypass cables exist: two to the vehicle, two relay wires in two sections each');
assert(bypass.bypassRopes[4].mesh.material.map&&bypass.bypassRopes[5].mesh.material.map&&!bypass.bypassRopes[1].mesh.material.map,'The relay-1 black/white wire is one cable with a painted stripe; the black wire is plain');
for(const code of ['assembly','healthy','F4','F5','F12'])app.buildScenario(code),settle(code);
for(let i=0;i<8;i++){els.lessonMenuItems.children[i].onclick();settle('lesson '+i);for(let k=0;k<20&&app.learning.active;k++){els.lessonNext.onclick();settle(`lesson ${i}.${k}`);}}
assert(true,`${checks} settled checks across scenarios and every lesson step: no bypass cable passes through or in front of the circular connector (or any connector), below the table, in a loop or stretched`);
// ---- the bypass lesson, done with the real actions ----
els.backToMenu.onclick();els.lessonMenuItems.children[7].onclick();frames(120);
const [vA,rA,vB,rB]=app.bypassPorts;
app.select(rA);assert(app.disconnectSelected(),'Relay-1 black pair disconnects');frames(240);inspect('black pair open');
assert(app.lessonCheck('bypassBlack'),'Lesson sees the black pair open');
app.select(rB);assert(app.disconnectSelected(),'Relay-1 black/white pair disconnects');frames(240);inspect('stripe pair open');
assert(app.lessonCheck('bypassStripe'),'Lesson sees the black/white pair open');
app.select(vA);for(let k=0;k<30;k++){const to=app.worldPos(vB).sub(app.worldPos(vA));if(to.length()<0.6)break;app.moveSelected(app.worldPos(vA).add(to.multiplyScalar(0.3)));frames(2);}
assert(app.connectSelected(),'The two vehicle connectors join (bypass)');frames(300);inspect('bypass joined');
assert(app.lessonCheck('bypassJoined'),'Lesson sees the bypass joined');
// ---- the lower harness moves: relay wires follow from behind its circular connector ----
app.buildScenario('assembly');frames(60);
const circ=app.workParts[2].ports[1];app.select(circ);
for(let k=0;k<12;k++){app.moveSelected(app.worldPos(circ).add(app.V(.25,0,-.2)));frames(4);}
frames(300);inspect('lower harness moved');
const branch=circ.group.worldToLocal(bypass.bypassRopes[2].pos.at(-1).clone());
assert(branch.z<-0.7,'Relay wires stay attached behind the circular connector when the harness moves');
// ---- cost ----
frames(400);let t=realNow();for(let k=0;k<60;k++){fakeNow+=16;app.animate(fakeNow);}const idle=(realNow()-t)/60;
assert(idle<1.5,`Idle frame with every cable asleep (2 leads, 4 harnesses, 6 bypass): ${idle.toFixed(3)} ms`);
console.log('Bypass cables (1.18) checks passed.');
