import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mk3-test-'));
fs.cpSync(path.join(root,'dist'),path.join(temp,'dist'),{recursive:true});
for(const [f,imp] of [['geometry.js','./vendor/three.module.js'],['vendor/OrbitControls.js','./three.module.js'],['vendor/OBB.js','./three.module.js']]){const p=path.join(temp,'dist',f);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll("'three'",JSON.stringify(imp)));}
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
class Element{constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.userData={};this.children=[];this.listeners={};this.options=[];this.value='';this.classList={toggle(){}};this.ownerDocument=globalThis.document;this.width=1280;this.height=800;}
 addEventListener(t,fn){(this.listeners[t]??=[]).push(fn);} removeEventListener(){} setPointerCapture(){}releasePointerCapture(){}getRootNode(){return document;}appendChild(c){this.children.push(c);return c;}replaceChildren(...c){this.children=c;this.options=c;}querySelector(){return new Element();}querySelectorAll(){return [];}getBoundingClientRect(){return{left:0,top:0,width:1280,height:800};}getContext(){return new Proxy({},{get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});}showModal(){this.open=true;}close(){this.open=false;}}
const els={};globalThis.document={createElement:t=>new Element(t),getElementById:id=>els[id]??(els[id]=new Element()),documentElement:{},addEventListener(){},removeEventListener(){}};els.segment=new Element();els.segment.options=[{},{}];els.segment.value='upper';globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.innerWidth=1280;globalThis.innerHeight=800;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=()=>{};globalThis.FakeRenderer=class{constructor(){this.domElement=new Element('canvas');this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}};
let s=fs.readFileSync(path.join(temp,'dist/app.js'),'utf8').replace("import * as T from 'three';","import * as ActualT from './vendor/three.module.js'; const T={...ActualT,WebGLRenderer:globalThis.FakeRenderer};");
s+='\nexport {buildScenario,parts,circuit,collision,selected,moveSelected,trySnap,rotateSelected,worldPos,worldQ,setWorldPosition,setWorldQuaternion,scene,V,Q,joints,compatible,allColliders,colliderOf,cameraSafe,camera,guardCamera,turnThread,focus,takeProbe,testStage,meterResult};\nexport function select(p){selected={port:p,part:p.part};} export function selectPart(p){selected={part:p,port:null};} export function meterOn(){meterMode="continuity";}\n';fs.writeFileSync(path.join(temp,'dist/check-app.mjs'),s);const app=await import(path.join(temp,'dist/check-app.mjs'));console.log('Runtime initialized',app.parts.length,'parts;',app.allColliders.length,'solids');globalThis.app=app;
app.buildScenario('assembly');
for(const p of app.parts.flatMap(p=>p.ports)){const entity=['screen','em'].includes(p.kind)?p.part.root:p.group;const coll=app.collision(entity,{port:p,part:p.part});if(coll)throw new Error('Initial overlap: '+p.kind+' '+p.part.id);}
for(const [ai,ap,bi,bp] of [[1,0,0,0],[2,0,1,1],[2,1,3,0]]){
 const p=app.parts[ai].ports[ap],q=app.parts[bi].ports[bp];app.select(p);const targetQ=app.worldQ(q).multiply(app.Q(0,Math.PI,0));app.setWorldQuaternion(p.group,targetQ);const norm=app.V(0,0,1).applyQuaternion(app.worldQ(q));app.setWorldPosition(p.group,app.worldPos(q).addScaledVector(norm,1.5));app.moveSelected(app.worldPos(q).addScaledVector(norm,.085));console.log('ATTACH',p.kind,'joint',!!p.joint,'remaining',app.worldPos(p).distanceTo(app.worldPos(q)));
}
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
// Withdrawal must be possible from the initial overlap, after releasing the clip.
app.buildScenario('healthy');let p=app.parts[1].ports[0],q=app.parts[0].ports[0];app.select(p);p.joint.secured=false;app.moveSelected(app.worldPos(p).addScaledVector(app.V(0,0,1).applyQuaternion(app.worldQ(q)),1.5));assert(!p.joint&&app.worldPos(p).distanceTo(app.worldPos(q))>1.1,'Released connector can be withdrawn');
// Reinsert without changing orientation and restore physical connection.
app.moveSelected(app.worldPos(q).addScaledVector(app.V(0,0,1).applyQuaternion(app.worldQ(q)),.085));assert(!!p.joint,'Withdrawn connector can be reinserted');
// A secured clip blocks dragging.
let before=app.worldPos(p);app.moveSelected(before.clone().add(app.V(0,3,0)));assert(before.distanceTo(app.worldPos(p))<.001,'Secured connector cannot be pulled through latch');
// Wrong orientation stops at the housing.
app.buildScenario('assembly');p=app.parts[2].ports[1];q=app.parts[3].ports[0];app.select(p);let normal=app.V(0,0,1).applyQuaternion(app.worldQ(q));app.setWorldQuaternion(p.group,app.worldQ(q).multiply(app.Q(0,Math.PI,Math.PI/2)));app.setWorldPosition(p.group,app.worldPos(q).addScaledVector(normal,1.5));app.moveSelected(app.worldPos(q).addScaledVector(normal,-1));assert(!p.joint,'Incorrectly oriented circular does not mate');assert(app.worldPos(p).distanceTo(app.worldPos(q))>.25,'Wrong orientation stops outside the socket');
// A high-displacement drag cannot tunnel through the EM body.
app.buildScenario('assembly');p=app.parts[2].ports[0];q=app.parts[3].ports[0];app.select(p);app.setWorldPosition(p.group,app.V(5.2,1,3));app.moveSelected(app.V(5.2,1,-3));assert(app.worldPos(p).z>.2,'Swept collision prevents tunneling through EM');
assert(!app.cameraSafe(app.parts[3].root.localToWorld(app.V(0,1.2,0))),'Camera cannot occupy EM body');
// Grounding test and order are exercised through the real meter handler.
app.buildScenario('F11');app.meterOn();app.takeProbe({port:app.parts[1].ports[0],n:1});app.takeProbe({port:app.parts[1].ports[1],n:2});assert(app.meterResult==='NO PASA','F11 ground continuity is measurable');
app.buildScenario('F6');app.meterOn();app.takeProbe({port:app.parts[1].ports[0],n:9});app.takeProbe({port:app.parts[1].ports[1],n:3});assert(app.meterResult==='—','Individual segment cannot precede end-to-end test');app.takeProbe({port:app.parts[1].ports[0],n:9});app.takeProbe({port:app.parts[2].ports[1],n:1});assert(app.testStage.lo===1,'Failed end-to-end enables upper segment');app.takeProbe({port:app.parts[1].ports[0],n:9});app.takeProbe({port:app.parts[1].ports[1],n:3});assert(app.testStage.lo===2,'Upper segment enables lower segment');

app.buildScenario('F5');app.select(app.parts[2].ports[1]);for(let i=0;i<3;i++)app.turnThread(1);assert(app.circuit.evaluate().screens[app.parts[0].id]==='normal','Full thread tightening restores communication');assert(app.focus===null,'Completed connection leaves inspection focus');for(let i=0;i<6;i++)app.turnThread(-1);const cp=app.parts[2].ports[1],ep=app.parts[3].ports[0];app.moveSelected(app.worldPos(cp).addScaledVector(app.V(0,0,1).applyQuaternion(app.worldQ(ep)),1.5));assert(!cp.joint&&app.worldPos(cp).distanceTo(app.worldPos(ep))>1.1,'Unscrewed circular can be withdrawn');
assert(!app.cameraSafe(app.V(6.7,.93,4.75)),'Camera cannot occupy multimeter body');
app.buildScenario('healthy');app.meterOn();app.takeProbe({port:app.parts[1].ports[0],n:9});app.takeProbe({port:app.parts[2].ports[1],n:1});assert(app.testStage.lo===3,'Passing end-to-end completes the conductor test');app.takeProbe({port:app.parts[1].ports[0],n:9});app.takeProbe({port:app.parts[1].ports[1],n:3});assert(app.meterResult==='—','Passing end-to-end makes segment tests unnecessary');
