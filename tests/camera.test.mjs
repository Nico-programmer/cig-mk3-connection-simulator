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
const T=await import(path.join(temp,'dist/vendor/three.module.js'));
const view=await import(path.join(temp,'dist/app/view.js'));
const {controls}=await import(path.join(temp,'dist/app/scene.js'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
let now=1000;const frame=()=>{now+=16;app.animate(now);};
// One rendered frame with the orbit controls asking for `desired`.
function orbitTo(desired){view.restoreCameraDesired();app.camera.position.copy(desired);view.guardCamera();}
const sph=(target,r,polar,az)=>target.clone().add(new T.Vector3().setFromSphericalCoords(r,polar,az));
let frames=0,blockedFrames=0,stuck=0;
for(const code of ['assembly','healthy']){
  app.buildScenario(code);
  const targets=[controls.target.clone(),...app.parts.flatMap(p=>p.ports).map(p=>app.worldPos(p))];
  for(const target of targets){
    controls.target.copy(target);
    for(const r of [2,3.5,6,14])for(const polar of [0.5,1.0,1.45]){
      let last=null;
      for(let az=0;az<Math.PI*2;az+=Math.PI/24){
        const desired=sph(target,r,polar,az);if(desired.y<0.3)continue;
        orbitTo(desired);frames++;
        check(app.cameraSafe(app.camera.position),`Camera inside a solid at ${code} target ${target.toArray().map(v=>v.toFixed(2))} r${r} polar${polar} az${az.toFixed(2)}`);
        if(app.camera.position.distanceTo(desired)>1e-6)blockedFrames++;
        if(last&&app.camera.position.distanceTo(last)<1e-9)stuck++;
        last=app.camera.position.clone();
      }
    }
  }
}
assert(true,`Orbit sweep: ${frames} frames around the bench and every connector, camera never inside a solid (${blockedFrames} frames needed the arm)`);
assert(stuck===0,'The camera never sticks: it moves on every frame the orbit moves');
// Desired point inside the EM: the camera slides toward the target and stops just outside.
app.buildScenario('assembly');
const em=app.workParts[3],emCenter=em.root.localToWorld(app.V(0,1.25,0));
controls.target.copy(emCenter.clone().add(app.V(0,0,4)));
orbitTo(emCenter.clone());
assert(app.cameraSafe(app.camera.position)&&app.camera.position.z>emCenter.z+.3,'Asking for a point inside the EM leaves the camera just in front of it');
// A solid that only hides the target does not move the camera.
const behind=emCenter.clone().add(app.V(0,0,-4));
orbitTo(behind);
assert(app.camera.position.distanceTo(behind)<1e-9,'A solid between camera and target does not pull the camera in (only penetration does)');
// Back in free space the camera is exactly where the controls ask: no zoom drift.
const sideways=sph(controls.target,8,1.2,Math.PI*1.5);orbitTo(sideways);
assert(app.camera.position.distanceTo(sideways)<1e-9,'In free space the camera is exactly at the requested position');
// Real frames: the default bench view is unobstructed and must stay exactly where it is placed.
app.buildScenario('assembly');for(let i=0;i<5;i++)frame();
assert(app.camera.position.distanceTo(app.V(12,13,22))<1e-3,'The opening bench view is not shortened by a nearby connector ('+app.camera.position.toArray().map(v=>v.toFixed(2))+')');
const radius=app.camera.position.distanceTo(controls.target);
for(let i=0;i<60;i++)frame();
assert(Math.abs(app.camera.position.distanceTo(controls.target)-radius)<1e-6,'Idle frames keep the zoom distance exactly');
// The 1.0 guard teleported to (12,13,22) when trapped; the arm never teleports.
app.buildScenario('assembly');controls.target.copy(emCenter);
orbitTo(emCenter.clone().add(app.V(0.1,0.1,0.1)));
assert(app.cameraSafe(app.camera.position)&&app.camera.position.distanceTo(app.V(12,13,22))>3,'A target inside the EM puts the camera just outside it, not at a fixed fallback point');
// Cost
app.buildScenario('healthy');controls.target.set(0,.6,0);
const s=performance.now();for(let i=0;i<200;i++)orbitTo(sph(controls.target,5,1,i/30));const ms=(performance.now()-s)/200;
assert(ms<1,`Camera arm cost ${ms.toFixed(3)} ms per frame`);
console.log('Spring-arm camera (1.15) checks passed.');
