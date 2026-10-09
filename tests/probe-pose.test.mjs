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
const {loadApp}=await import('./support/load-app.mjs');const app=await loadApp(temp);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const {segmentHitsSolid}=await import(path.join(temp,'dist/collision.js'));
const T=await import(path.join(temp,'dist/vendor/three.module.js'));
const probes=await import(path.join(temp,'dist/app/probes.js'));
const {S}=await import(path.join(temp,'dist/app/state.js'));
// Reference: the 1.0 (v16) probePose, without the reach filter.
function referencePose(contact,clearance=0.04){
  const {port,n}=contact,pin=port.pins.find(p=>p.userData.pin.n===n),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const q=g=>g.getWorldQuaternion(new T.Quaternion()),fwd=p=>V(0,0,1).applyQuaternion(q(p.group));
  if(!port.mate)return{position:pin.getWorldPosition(V()).addScaledVector(fwd(port),clearance),quaternion:q(port.group)};
  const access=['screen','em'].includes(port.kind)?port.mate:port,local=access.group.worldToLocal(pin.getWorldPosition(V()));local.z=-0.35;
  const position=access.group.localToWorld(local.clone()),base=q(access.group),candidates=[V(local.x,local.y,-0.35).normalize(),V(0,0,-1)];
  for(let i=0;i<16;i++)candidates.push(V(Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8),-0.08).normalize());
  const obstacles=S.allColliders.filter(m=>m.userData.probeIndex===undefined&&m.userData.probeLead===undefined).map(app.colliderOf);
  let direction=candidates[0].clone().applyQuaternion(base);
  for(const c of candidates){const d=c.clone().applyQuaternion(base),a=position.clone().addScaledVector(d,0.3),b=position.clone().addScaledVector(d,1.08);
    if(!obstacles.some(o=>segmentHitsSolid(position,a,o,0.066)||segmentHitsSolid(a,b,o,0.17))){direction=d;break;}}
  return{position:position.addScaledVector(direction,clearance-0.04),quaternion:new T.Quaternion().setFromUnitVectors(V(0,0,1),direction)};
}
const same=(a,b)=>a.x===b.x&&a.y===b.y&&a.z===b.z&&(a.w===undefined||a.w===b.w);
let checked=0;
for(const [label,setup] of [['assembly',()=>app.buildScenario('assembly')],['assembled',()=>app.buildScenario('healthy')],['F4',()=>app.buildScenario('F4')],['swap',()=>{els.lessonMenuItems.children[6].onclick();}]]){
  setup();
  for(const part of app.parts)for(const port of part.ports)for(const pin of port.pins){
    const contact={port,n:pin.userData.pin.n};
    for(const clearance of [0.04,0.08,0.24]){
      const fast=probes.probePose(contact,clearance),ref=referencePose(contact,clearance);
      assert(same(fast.position,ref.position)&&same(fast.quaternion,ref.quaternion),`probePose identical ${label} ${port.id}:${contact.n} @${clearance}`);
      assert(same(probes.probeTargetPosition(contact,clearance),ref.position),`probeTargetPosition identical ${label} ${port.id}:${contact.n} @${clearance}`);
      checked++;
    }
  }
}
console.log('PASS probePose/probeTargetPosition identical to 1.0 reference for',checked,'pin/clearance cases');
// nearbyProbeContact must pick the same pin as the 1.0 search at many tip positions.
app.buildScenario('healthy');
function referenceNearby(tip){let result=null,min=0.34;for(const part of app.parts)for(const port of part.ports)for(const pin of port.pins){const n=pin.userData.pin.n;if(!PINS[port.kind]?.[n])continue;const d=tip.distanceTo(referencePose({port,n}).position);if(d<min){min=d;result={port,n};}}return result;}
const {PINS}=await import(path.join(temp,'dist/electrical.js'));
let tips=0;
for(const part of app.parts)for(const port of part.ports)for(const pin of port.pins){
  const base=referencePose({port,n:pin.userData.pin.n}).position;
  for(const off of [[0,0,0],[0.1,0,0],[0,0.2,0.1],[0.3,0.05,-0.1],[0.5,0,0]]){
    app.probeTools[0].group.position.copy(base).add(new T.Vector3(...off));
    const a=probes.nearbyProbeContact(0),b=referenceNearby(app.probeTools[0].group.position);
    assert((a===null&&b===null)||(a&&b&&a.port===b.port&&a.n===b.n),'nearbyProbeContact identical at '+port.id+':'+pin.userData.pin.n+' '+off);
    tips++;
  }
}
console.log('PASS nearbyProbeContact identical to 1.0 reference at',tips,'tip positions');
