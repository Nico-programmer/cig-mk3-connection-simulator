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
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS',msg);};
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
// ---- global invariant: no two rigid bodies overlap (mated hulls and a measuring probe tip excepted) ----
function bodyOf(m){
  for(let o=m;o;o=o.parent){
    if(o.userData.probeIndex!==undefined&&o.parent===app.probeTools[o.userData.probeIndex-1].group.parent)return o;
    if(o.userData.port&&o.userData.port.group===o)return ['screen','em'].includes(o.userData.port.kind)?o.userData.port.part.root:o;
    if(o.userData.part&&o.userData.part.root===o)return o;
    if(o.parent===app.scene)return o;
  }
  return m;
}
function exemptPair(a,b){
  const pa=a.userData.port,pb=b.userData.port;
  if(pa&&pb&&pa.mate===pb)return true;
  for(const [tip,o] of [[a,pb],[b,pa]]){if(!tip.userData.probeTip||!o)continue;const c=app.probeTools[tip.userData.probeIndex-1].contact;if(c&&(o===c.port||o===c.port.mate))return true;}
  return false;
}
function overlaps(){
  app.scene.updateMatrixWorld(true);
  const solids=app.allColliders.filter(m=>!m.userData.cableOwner&&m.userData.probeLead===undefined).map(m=>({m,b:bodyOf(m),obb:app.colliderOf(m)})),found=[];
  for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){
    const A=solids[i],B=solids[j];
    if(A.b===B.b||exemptPair(A.m,B.m))continue;
    if(A.obb.intersectsOBB(B.obb,-1e-4))found.push((A.m.userData.port?.id||A.b.userData.part?.id||A.m.userData.probeIndex||'bench')+' x '+(B.m.userData.port?.id||B.b.userData.part?.id||B.m.userData.probeIndex||'bench'));
  }
  return found;
}
const floorOK=()=>app.allColliders.every(m=>{const o=app.colliderOf(m),e=o.rotation.elements;return o.center.y-(Math.abs(e[1])*o.halfSize.x+Math.abs(e[4])*o.halfSize.y+Math.abs(e[7])*o.halfSize.z)>=-0.115-1e-3;});
for(const code of ['assembly','healthy','F4','F5','F9'])app.buildScenario(code),assert(overlaps().length===0,'No overlapping rigid bodies at start of '+code+' '+overlaps().join(','));

// ---- the two bugs found in 1.0 ----
app.buildScenario('assembly');
let [screen,upper,lower,em]=app.workParts;
app.selectPart(screen);
for(let k=0;k<60;k++)app.moveSelected(screen.root.getWorldPosition(app.V()).add(app.V(.2,0,.02)));
assert(screen.root.position.x<-4&&overlaps().length===0,'MK3 dragged by its housing stops at the upper harness (1.0 crossed it)');
app.buildScenario('assembly');[screen,upper,lower,em]=app.workParts;
app.selectPart(em);
for(let k=0;k<60;k++)app.moveSelected(em.root.getWorldPosition(app.V()).add(app.V(-.2,0,0)));
assert(em.root.position.x>3&&overlaps().length===0,'EM dragged by its housing stops at the lower harness (1.0 ended inside it)');
app.buildScenario('assembly');
for(const part of app.parts){
  for(const sel of [{part,port:null},...part.ports.filter(p=>!['screen','em'].includes(p.kind)).map(port=>({part,port}))]){
    if(sel.port)app.select(sel.port);else app.selectPart(part);
    for(const axis of ['x','y','z'])for(const dir of [1,-1])for(let k=0;k<6;k++){
      app.rotateSelected(axis,dir);
      check(overlaps().length===0&&floorOK(),'Rotation left an overlap: '+part.id+' '+(sel.port?.kind||'body')+' '+axis+dir+' '+overlaps().join(','));
    }
  }
}
assert(true,'Rotating every part and connector on every axis never throws, never overlaps and never enters the table');
app.buildScenario('assembly');[screen,upper,lower,em]=app.workParts;
app.selectPart(screen);const q0=screen.root.quaternion.clone();app.rotateSelected('x',1);
assert(screen.root.quaternion.angleTo(q0)>0.2&&screen.root.position.y>0,'Tilting the MK3 lifts it onto the table instead of refusing');

// ---- sliding ----
app.buildScenario('assembly');[screen,upper,lower,em]=app.workParts;
const c=lower.ports[1];app.select(c);app.setWorldPosition(c.group,app.V(5.2,1,3));app.refreshColliders();
app.moveSelected(app.V(6.2,1,-3));
assert(app.worldPos(c).z>.2&&app.worldPos(c).x>6&&overlaps().length===0,'A connector pushed diagonally into the EM slides along its face');

// ---- probes ----
app.buildScenario('assembly');[screen,upper,lower,em]=app.workParts;
const front=upper.ports[1];
app.probeTools[0].contact=null;
const pose=app.probePose({port:front,n:3},.24);app.probeTools[0].group.position.copy(pose.position);app.probeTools[0].group.quaternion.copy(pose.quaternion);
app.refreshProbes();app.refreshColliders();
assert(app.placeProbe(0,{port:front,n:3}),'Probe connects to a free 4-pin connector');
const before=app.worldPos(front);app.select(front);app.moveSelected(before.clone().add(app.V(0,0,.6)));
assert(app.worldPos(front).distanceTo(before)>.5&&app.probeTools[0].contact?.port===front,'A connector carrying a measuring probe moves and the probe follows it');
assert(overlaps().length===0,'Probe that follows its connector does not overlap anything');

// ---- randomized stress ----
let seed=12345;const rnd=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
let moves=0;
for(const code of ['assembly','healthy']){
  app.buildScenario(code);
  for(let k=0;k<160;k++){
    const part=app.parts[Math.floor(rnd()*app.parts.length)],ports=part.ports.filter(p=>!['screen','em'].includes(p.kind));
    const usePort=ports.length&&rnd()<.6,port=usePort?ports[Math.floor(rnd()*ports.length)]:null;
    if(port)app.select(port);else app.selectPart(part);
    if(rnd()<.25)app.rotateSelected(['x','y','z'][Math.floor(rnd()*3)],rnd()<.5?1:-1);
    else{const ent=port?port.group:part.root,at=ent.getWorldPosition(app.V());app.moveSelected(at.add(app.V((rnd()-.5)*4,(rnd()-.4)*2,(rnd()-.5)*4)));}
    moves++;
    const o=overlaps();check(o.length===0&&floorOK(),`Stress move ${k} (${code}) left overlap: ${o.join(',')}`);
  }
}
assert(true,`Randomized stress: ${moves} drags/rotations of bodies and connectors, never an overlap or table penetration`);

// ---- performance (CPU, generous bounds) ----
const time=(f,n)=>{f();const s=performance.now();for(let i=0;i<n;i++)f();return (performance.now()-s)/n;};
app.buildScenario('assembly');[screen,upper,lower,em]=app.workParts;
app.select(upper.ports[1]);
const portMs=time(()=>app.moveSelected(app.worldPos(upper.ports[1]).add(app.V(0,0,.05))),10);
app.selectPart(screen);
const bodyMs=time(()=>app.moveSelected(screen.root.getWorldPosition(app.V()).add(app.V(0,0,.05))),10);
assert(portMs<20&&bodyMs<20,`Drag step cost: connector ${portMs.toFixed(2)} ms, MK3 body ${bodyMs.toFixed(2)} ms`);
assert(app.allColliders.length<120,`Rigid solids registered: ${app.allColliders.length} (1.0: 906)`);
console.log('Collision rebuild (1.14) checks passed.');
