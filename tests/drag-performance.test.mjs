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
let s=fs.readFileSync(path.join(temp,'dist/app.js'),'utf8').replace("import * as T from 'three';","import * as ActualT from './vendor/three.module.js'; const T={...ActualT,WebGLRenderer:globalThis.FakeRenderer};");
s+='\nexport {probePose,meter,refreshProbes,refreshColliders,probeBlocked,probeObstacles,leadPath,refreshVoltageReading,animate,updatePinGuidance,highlightedPins,pinHighlightGroup,lessonMeasurement,workParts,lessonCheck,prepareLesson,swapParts,bypassPorts,align,attach,refreshCables,learning,drawMeter,updateLabels,buildScenario,parts,circuit,collision,selected,moveSelected,trySnap,rotateSelected,worldPos,worldQ,setWorldPosition,setWorldQuaternion,scene,V,Q,joints,compatible,allColliders,colliderOf,cameraSafe,camera,guardCamera,renderer,releaseDrag,drag,lastCamera,moveProbe,sceneCursor,hits,meterMode,nearbyProbeContact,updateMeterControls,turnThread,focus,connectSelected,disconnectSelected,probeTools,placeProbe,updateHitboxes,hitboxGroup,takeProbe,testStage,meterResult};\nexport function select(p){selected={port:p,part:p.part};} export function selectPart(p){selected={part:p,port:null};} export function meterOn(){meterMode="continuity";}\n';fs.writeFileSync(path.join(temp,'dist/check-app.mjs'),s);const app=await import(path.join(temp,'dist/check-app.mjs'));console.log('Runtime initialized',app.parts.length,'parts;',app.allColliders.length,'solids');globalThis.app=app;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};

app.buildScenario('assembly');
const active=app.parts[2],untouched=app.parts[1];
const original=active.cableGroup.children.map(m=>({mesh:m,geometry:m.geometry,material:m.material,positions:m.geometry.attributes.position.array}));
const unmodified=untouched.cableGroup.children.map(m=>m.geometry.attributes.position.version);
app.select(active.ports[0]);const start=app.worldPos(active.ports[0]);app.moveSelected(start.clone().add(app.V(.1,0,0)));
assert(active.cableGroup.children.every((m,i)=>m===original[i].mesh&&m.geometry===original[i].geometry&&m.material===original[i].material&&m.geometry.attributes.position.array===original[i].positions),'Dragging reuses all harness meshes, materials and GPU arrays');
assert(untouched.cableGroup.children.every((m,i)=>m.geometry.attributes.position.version===unmodified[i]),'Unmoved harness buffers are never rewritten');
app.buildScenario('assembly');const mover=app.parts[0],target=app.parts[3];mover.root.position.set(-5,3,0);target.root.position.set(0,3,0);app.refreshCables();app.select(mover.ports[0]);app.moveSelected(app.V(5,3,0));assert(mover.root.position.x<0,'Large body drag stops before passing through another body');assert(!app.collision(mover.root,{part:mover,port:mover.ports[0]}),'Stopped body has no penetration');
const stopped=mover.root.position.clone();app.moveSelected(app.V(5,3,0));assert(mover.root.position.distanceTo(stopped)<.026,'Continued pressure preserves contact');
console.log('Persistent meshes, untouched buffers and body-to-body collision checks passed.');

const T=await import(path.join(temp,'dist/vendor/three.module.js'));
const {updateTube,curveFor}=await import(path.join(temp,'dist/drag-performance.js'));
for(const linear of [false,true]){
 const points=[new T.Vector3(0,1,0),new T.Vector3(1,.3,.2),new T.Vector3(3,.8,.5)];
 const curve=curveFor(points,linear),segments=linear?Math.max(60,Math.ceil(curve.getLength()/.04)):60;
 const mesh=new T.Mesh(new T.TubeGeometry(curve,segments,.086,8,false),new T.MeshStandardMaterial());mesh.userData.cableRadius=.086;
 for(let j=0;j<6;j++){
  points[1].y+=.03;const updated=curveFor(points,linear);updateTube(mesh,updated,linear);
  const expected=new T.TubeGeometry(updated,linear?Math.max(60,Math.ceil(updated.getLength()/.04)):60,.086,8,false);
  for(const name of ['position','normal','uv']){const actual=mesh.geometry.attributes[name].array,wanted=expected.attributes[name].array;assert(actual.length===wanted.length&&actual.every((v,i)=>Math.abs(v-wanted[i])<1e-6),'Reused '+name+' matches original TubeGeometry ('+linear+')');}
  assert(mesh.geometry.index.array.every((v,i)=>v===expected.index.array[i]),'Triangle topology is unchanged');expected.dispose();
 }
 mesh.geometry.dispose();mesh.material.dispose();
}
console.log('Tube vertices, normals, UVs and topology match the original model generation.');
