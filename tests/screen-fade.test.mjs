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
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);console.log("PASS",msg);};
// A stand-in for the login image and a canvas context that records what is drawn and how opaque.
app.mk3.login={};
let log={boot:[],login:[],window:[]};
let alpha=1;
const ctx=new Proxy({},{get:(t,k)=>{
  if(k==="globalAlpha")return alpha;
  if(k==="drawImage")return()=>log.login.push(alpha);
  if(k==="measureText")return(text)=>({width:text.length*10});
  if(k==="createLinearGradient")return()=>({addColorStop(){}});
  if(k==="fillText")return(text)=>{if(/loading|cargando/.test(text))log.boot.push({alpha,dots:(/\.+$/.exec(text)||[""])[0].length});else if(!/^(FLEET|iQ|360)$/.test(text))log.window.push(alpha);};
  return()=>{};
},set:(t,k,v)=>{if(k==="globalAlpha")alpha=v;return true;}});
const part={realistic:true,screenCanvas:{width:800,height:480,getContext:()=>ctx},screenTexture:{}};
let t=1;
function run(state,seconds){log={boot:[],login:[],window:[]};for(let i=0;i<Math.round(seconds*60);i++){t+=1/60;app.paintScreen(part,state,t);}return {boot:[...log.boot],login:[...log.login],window:[...log.window]};}
const maxStep=(a)=>a.reduce((m,v,i)=>i?Math.max(m,Math.abs(v-a[i-1])):m,0);
const alphas=(a)=>a.map((x)=>x.alpha);
let r=run("off",0.5);
assert(r.boot.length===0&&r.login.length===0&&r.window.length===0,"Off: black, nothing drawn on top");
// Switching on: boot screen first.
r=run("normal",0.5);
assert(r.boot.length>10&&r.boot[0].alpha<0.1,"Switching on: the boot screen starts almost transparent");
assert(maxStep(alphas(r.boot))<0.12,"Switching on: the boot screen fades in without jumps");
assert(r.login.length===0,"Switching on: the login is not shown while the system is loading");
assert(r.boot[0].dots===1,"The loading message starts with one dot");
// The dots follow . .. ... . ... .. . and repeat (collapse the per-frame repeats).
const seq=[];for(const b of r.boot.map((x)=>x.dots)){if(seq[seq.length-1]!==b)seq.push(b);}
r=run("normal",app.BOOT_SECONDS-0.5+1);
for(const b of r.boot.map((x)=>x.dots)){if(seq[seq.length-1]!==b)seq.push(b);}
assert(seq.slice(0,7).join(",")==="1,2,3,1,3,2,1","The dots go . .. ... . ... .. . (got "+seq.slice(0,7).join(",")+")");
assert(r.login.length>0,"After the boot time the login appears");
assert(maxStep(r.login)<0.12,"The login fades in without jumps (max step "+maxStep(r.login).toFixed(3)+")");
r=run("normal",1);
assert(r.boot.length===0,"The boot screen is gone once the login is up");
r=run("normal",0.5);
assert(r.login.length===0,"Settled login is not repainted every frame");
// Error: the window fades in over the login.
r=run("spinner",1);
assert(r.window.length>0&&r.window[0]<0.1,"Error: the window starts almost transparent");
assert(maxStep(r.window.filter((_,i)=>i%3===0))<0.2,"Error: the window fades in smoothly");
assert(r.login.every((v)=>v>0.99),"Error: the login stays opaque behind the window");
r=run("spinner",0.3);
assert(r.window.length>0,"The window keeps spinning while the error lasts");
r=run("normal",1);
assert(r.window.length>0&&r.window[r.window.length-1]<r.window[0],"Solved: the window fades out");
r=run("normal",0.5);
assert(r.window.length===0&&r.login.length===0,"Solved: the window is gone and the screen is settled");
// Switching off, then on again with an error: the boot screen comes first, the window after it.
r=run("off",1);
assert(r.login.length>0&&r.login[r.login.length-1]<r.login[0],"Switching off: the login fades back to black");
r=run("spinner",0.8);
assert(r.boot.length>0&&r.window.length===0,"Switching on with an error: boot screen first, no window yet");
r=run("spinner",app.BOOT_SECONDS+0.5);
assert(r.window.length>0&&r.login.length>0,"Switching on with an error: then the login and the window");
// A new screen that starts powered does not boot.
const fresh={realistic:true,screenCanvas:part.screenCanvas,screenTexture:{}};
log={boot:[],login:[],window:[]};app.paintScreen(fresh,"normal",t+1);
assert(log.boot.length===0&&log.login.length>0,"A new powered screen starts settled, without the boot screen");
console.log("Screen fade checks passed.");
