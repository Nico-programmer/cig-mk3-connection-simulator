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
 addEventListener(t,fn){(this.listeners[t]??=[]).push(fn);} removeEventListener(){} setPointerCapture(){}releasePointerCapture(){}getRootNode(){return document;}appendChild(c){this.children.push(c);return c;}replaceChildren(...c){this.children=c;this.options=c;}querySelector(){return new Element();}querySelectorAll(){return [];}getBoundingClientRect(){return{left:0,top:0,width:1280,height:800};}getContext(){return new Proxy({},{get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});}setAttribute(k,v){this[k]=v;}showModal(){this.open=true;}close(){this.open=false;}}
const els={};globalThis.document={createElement:t=>new Element(t),getElementById:id=>els[id]??(els[id]=new Element()),documentElement:{},addEventListener(){},removeEventListener(){}};els.segment=new Element();els.segment.options=[{},{}];els.segment.value='upper';globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.innerWidth=1280;globalThis.innerHeight=800;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=()=>{};globalThis.FakeRenderer=class{constructor(){this.domElement=new Element('canvas');this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}};
let s=fs.readFileSync(path.join(temp,'dist/app.js'),'utf8').replace("import * as T from 'three';","import * as ActualT from './vendor/three.module.js'; const T={...ActualT,WebGLRenderer:globalThis.FakeRenderer};");
s+='\nexport {buildScenario,parts,circuit,collision,selected,moveSelected,trySnap,rotateSelected,worldPos,worldQ,setWorldPosition,setWorldQuaternion,scene,V,Q,joints,compatible,allColliders,colliderOf,cameraSafe,camera,guardCamera,renderer,releaseDrag,drag,meterMode,nearbyProbeContact,updateMeterControls,turnThread,focus,connectSelected,disconnectSelected,probeTools,placeProbe,updateHitboxes,hitboxGroup,takeProbe,testStage,meterResult};\nexport function select(p){selected={port:p,part:p.part};} export function selectPart(p){selected={part:p,port:null};} export function meterOn(){meterMode="continuity";}\n';fs.writeFileSync(path.join(temp,'dist/check-app.mjs'),s);const app=await import(path.join(temp,'dist/check-app.mjs'));console.log('Runtime initialized',app.parts.length,'parts;',app.allColliders.length,'solids');globalThis.app=app;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
app.buildScenario('assembly');
assert(app.probeTools.length===2,'Two physical probes exist before measurement');
for(const [ai,ap,bi,bp] of [[1,0,0,0],[2,0,1,1],[2,1,3,0]]){
 const p=app.parts[ai].ports[ap],q=app.parts[bi].ports[bp];app.select(p);app.setWorldPosition(p.group,app.worldPos(q).add(app.V(0,1.5,0)));assert(!p.joint,'Approach does not auto-connect');assert(app.connectSelected(),'Button connects '+p.kind);assert(p.joint.secured,'Button secures connection');assert(!app.collision(p.group,{port:p,part:p.part}),'Connected connector clears host casing');assert(app.disconnectSelected(),'Button disconnects '+p.kind);assert(!p.joint,'Disconnected connector is free');assert(!app.collision(p.group,{port:p,part:p.part}),'Disconnect ends outside solids');}
app.buildScenario('assembly');
for(const p of app.parts.flatMap(p=>p.ports)){const entity=['screen','em'].includes(p.kind)?p.part.root:p.group;assert(!app.collision(entity,{port:p,part:p.part}),'No initial overlap '+p.kind);}
let p=app.parts[2].ports[0];app.select(p);app.setWorldPosition(p.group,app.V(5.2,1,3));app.moveSelected(app.V(5.2,1,-3));assert(app.worldPos(p).z>.2,'Fast drag cannot tunnel through EM');
assert(!app.cameraSafe(app.parts[3].root.localToWorld(app.V(0,1.2,0))),'Camera stays outside EM');
app.buildScenario('F11');app.meterOn();app.placeProbe(0,{port:app.parts[1].ports[0],n:1});app.placeProbe(1,{port:app.parts[1].ports[1],n:2});assert(app.meterResult==='NO PASA','Physical probes measure F11 ground');app.placeProbe(0,null);assert(app.meterResult==='—','Lifting a probe clears reading');
app.buildScenario('F6');app.meterOn();app.placeProbe(0,{port:app.parts[1].ports[0],n:9});app.placeProbe(1,{port:app.parts[2].ports[1],n:1});assert(app.testStage.lo===1,'End-to-end failure enables segment tests');app.placeProbe(1,{port:app.parts[1].ports[1],n:3});assert(app.testStage.lo===2,'Upper segment follows end-to-end');
for(const code of ['healthy','F4','F5']){app.buildScenario(code);for(const p of app.parts.flatMap(p=>p.ports)){const entity=['screen','em'].includes(p.kind)?p.part.root:p.group;assert(!app.collision(entity,{port:p,part:p.part}),'Assembled solids clear '+code+' '+p.kind);}}
console.log('Interaction checks completed.');

app.buildScenario('assembly');app.camera.updateMatrixWorld(true);app.scene.updateMatrixWorld(true);
const screenPoint=v=>v.clone().project(app.camera);
const pos=app.probeTools[0].group.localToWorld(app.V(0,0,.65)),uv=screenPoint(pos);
const event={button:0,pointerId:1,clientX:(uv.x+1)*640,clientY:(1-uv.y)*400,preventDefault(){},stopImmediatePropagation(){}};
app.renderer.domElement.listeners.pointerdown.at(-1)(event);
assert(app.drag?.probeIndex===0,'Ray-picked red handle starts physical probe drag');
const before=app.probeTools[0].group.position.clone();
app.renderer.domElement.listeners.pointermove.at(-1)({...event,clientX:event.clientX+40});
assert(before.distanceTo(app.probeTools[0].group.position)>.1,'Pointer movement moves probe');app.releaseDrag();
els.hitboxes.onclick();app.updateHitboxes();assert(app.hitboxGroup.visible&&app.hitboxGroup.children.length===app.allColliders.length,'Hitbox button draws every collider');

for(const [code,pi,porti] of [['F4',1,1],['F5',2,1]]){app.buildScenario(code);const p=app.parts[pi].ports[porti];app.select(p);assert(app.disconnectSelected(),'Button releases '+code);assert(app.connectSelected(),'Button reconnects '+code);assert(app.circuit.evaluate().screens[app.parts[0].id]==='normal','Reconnecting restores '+code);}

// Complete visible-control workflow, using the same DOM button handlers as the page.
app.buildScenario('healthy');els.modeVoltage.onclick();assert(app.meterMode==='voltage','Visible Voltage button chooses V DC');
function approachAndConnect(index,port,n){els['selectProbe'+index].onclick();const pin=port.pins.find(p=>p.userData.pin.n===n);app.probeTools[index].group.position.copy(pin.getWorldPosition(app.V()).addScaledVector(app.V(0,0,1).applyQuaternion(app.worldQ(port)),.18));app.updateMeterControls();assert(!els.probeConnect.hidden,'Connect probe button appears near valid contact');assert(!app.probeTools[index].contact,'Approach alone does not attach');els.probeConnect.onclick();assert(app.probeTools[index].contact?.n===n,'Visible button connects selected probe');}
approachAndConnect(0,app.parts[3].ports[0],7);approachAndConnect(1,app.parts[3].ports[0],8);assert(app.meterResult==='12.0 V','Both connected probes produce voltage in instrument display');assert(!els.removeProbe0.disabled&&!els.removeProbe1.disabled,'Both removal buttons enabled');els.inspectMeter.onclick();assert(app.focus==='meter','View display button focuses instrument');els.modeContinuity.onclick();assert(app.meterMode==='continuity'&&app.meterResult==='NO PASA','Continuity mode updates the same contacts');els.removeProbe0.onclick();assert(!app.probeTools[0].contact&&app.meterResult==='—','Remove red clears electrical reading');els.removeProbe1.onclick();assert(!app.probeTools[1].contact&&els.removeProbe1.disabled,'Remove black frees second probe');
els.modeContinuity.onclick();approachAndConnect(0,app.parts[1].ports[0],1);approachAndConnect(1,app.parts[1].ports[1],2);assert(app.meterResult==='PASA','Repositioned probes read intact ground continuity');els.removeProbe0.onclick();els.removeProbe1.onclick();assert(app.meterResult==='—'&&app.probeTools.every(p=>!p.contact),'Complete measurement ends with both probes removed');els.modeOff.onclick();assert(app.meterMode==='off','Visible OFF button turns instrument off');
