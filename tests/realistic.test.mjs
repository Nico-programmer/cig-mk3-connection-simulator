import {pathToFileURL} from "node:url";
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

const {loadApp}=await import("./support/load-app.mjs");const app=await loadApp(temp);
const T=await import(pathToFileURL(path.join(temp,"dist/vendor/three.module.js")).href);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log("PASS",msg);};
// A stand-in for the realistic body (the GLB is only loaded over http), set before the bench is built.
const g=new T.Group();g.add(new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial()));
app.mk3.body=g;
// Same for the Expansion Module: a body 1.4 x 3 x 0.8 (centred), with its connector face at z = 0.27.
const eg=new T.Group();eg.add(new T.Mesh(new T.BoxGeometry(1.4,3,0.8),new T.MeshBasicMaterial()));
app.em3d.body=eg;app.em3d.box=new T.Box3(new T.Vector3(-0.7,-1.5,-0.4),new T.Vector3(0.7,1.5,0.4));app.em3d.port={x:0,y:0,z:0.27};
// And the 12-pin connector model (a plain box; the real one is 0.052 x 0.032 x 0.038 m).
const cg=new T.Group();cg.add(new T.Mesh(new T.BoxGeometry(0.052,0.032,0.038),new T.MeshBasicMaterial()));app.conn12.body=cg;
for(const code of ["F4","F5","F1"]){
  app.buildScenario(code);
  assert(app.parts.some((p)=>p.realistic),"The realistic MK3 is built for "+code);
  assert(app.parts.filter((p)=>p.type==="em").every((p)=>p.root.children.some((c)=>c.isGroup&&c.children[0]?.geometry?.parameters?.width===1.4)),"The realistic EM is built for "+code);
  assert(app.parts.filter((p)=>p.type==="upper").every((p)=>p.ports[0].rearZ<0.19),"The realistic orange connector moves the cable to its rear ("+code+")");
  for(const [ai,ap,bi,bp] of [[1,0,0,0],[2,0,1,1],[2,1,3,0]]){
    const p=app.parts[ai].ports[ap],q=app.parts[bi].ports[bp];
    if(p.joint){const m=p.mate;app.detach(p);p.blockMate=m.blockMate=null;}
    app.select(p);app.setWorldPosition(p.group,app.worldPos(q).add(app.V(0,1.5,0)));
    assert(app.connectSelected(),"Button connects "+p.kind+" to "+q.kind+" with the realistic MK3 ("+code+")");
  }
}
console.log("Realistic MK3 (1.21) checks passed.");
