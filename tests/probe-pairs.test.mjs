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
const {PINS}=await import(path.join(temp,'dist/electrical.js'));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
// Connect both probes as the app does: bring each one near its pin, then Connect probe.
function connect(i,port,n){
  const tool=app.probeTools[i];tool.contact=null;
  const pose=app.probePose({port,n},.24);tool.group.position.copy(pose.position);tool.group.quaternion.copy(pose.quaternion);
  app.refreshProbes();app.refreshColliders();
  return app.placeProbe(i,{port,n});
}
function free(){for(const i of [0,1]){app.probeTools[i].contact=null;app.probeTools[i].group.position.set(4.2+i*1.1,.22,4.8);app.probeTools[i].group.rotation.set(-Math.PI/2,0,0);}app.refreshProbes();app.refreshColliders();}
const probesOverlap=()=>{const a=app.allColliders.filter(m=>m.userData.probeIndex===1),b=app.allColliders.filter(m=>m.userData.probeIndex===2);return a.some(x=>b.some(y=>app.colliderOf(x).intersectsOBB(app.colliderOf(y),-1e-4)));};
const failures=[];let pairs=0;
for(const code of ['assembly','healthy']){
  app.buildScenario(code);app.meterOn();
  const ports=app.workParts.flatMap(p=>p.ports);
  for(const port of ports){
    const pins=Object.keys(PINS[port.kind]||{}).map(Number);
    for(let x=0;x<pins.length;x++)for(let y=x+1;y<pins.length;y++){
      free();pairs++;
      const ok=connect(0,port,pins[x])&&connect(1,port,pins[y]);
      if(!ok||probesOverlap())failures.push(`${code} ${port.kind}${port.mate?' (mated)':''} pins ${pins[x]}+${pins[y]}`);
    }
  }
}
console.log('pairs tested',pairs,'failures',failures.length,failures.slice(0,12).join(' | '));
assert(failures.length===0,`Both probes connect together on every pair of documented pins of every connector, free and mated (${pairs} pairs)`);
console.log('Probe pair checks passed.');
