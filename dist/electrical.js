// Signal mappings transcribed from the supplied MK3 specification, pp. 3–5.
export const PINS={screen:{1:'Ground / Negative',2:'Key Switched Positive',7:'Truck COM CAN LO',8:'Truck COM CAN HI',9:'Expansion COM CAN LO',10:'Expansion COM CAN HI'},orange:{1:'Ground / Negative',2:'Key Switched Positive',7:'Truck COM CAN LO',8:'Truck COM CAN HI',9:'Expansion COM CAN LO',10:'Expansion COM CAN HI'},up4:{1:'Key Switched Positive',2:'Ground / Negative',3:'Expansion COM CAN LO',4:'Expansion COM CAN HI'},low4:{1:'Key Switched Positive',2:'Ground / Negative',3:'Expansion COM CAN LO',4:'Expansion COM CAN HI'},circular:{1:'Expansion CAN LO',2:'Expansion CAN HI',3:'RLY 1 common',4:'RLY 1 normally open',5:'RLY 2 normally open',6:'RLY 2 common',7:'Key Switched Positive',8:'Ground / Negative',9:'Input 1 — Hydraulics',10:'Input 3 — Spare',11:'Input 2 — Traction',12:'Input 4 — Seat'},em:{1:'Expansion CAN LO',2:'Expansion CAN HI',3:'RLY 1 common',4:'RLY 1 normally open',5:'RLY 2 normally open',6:'RLY 2 common',7:'Key Switched Positive',8:'Ground / Negative',9:'Input 1 — Hydraulics',10:'Input 3 — Spare',11:'Input 2 — Traction',12:'Input 4 — Seat'}};
export const SIGNALS={screen:{pos:2,gnd:1,lo:9,hi:10},orange:{pos:2,gnd:1,lo:9,hi:10},up4:{pos:1,gnd:2,lo:3,hi:4},low4:{pos:1,gnd:2,lo:3,hi:4},circular:{pos:7,gnd:8,lo:1,hi:2},em:{pos:7,gnd:8,lo:1,hi:2}};
export const compatible=(a,b)=>({orange:'screen',screen:'orange',up4:'low4',low4:'up4',circular:'em',em:'circular',vehicleA:'relayA',relayA:'vehicleA',vehicleB:'relayB',relayB:'vehicleB'}[a]===b)||((a==='vehicleA'&&b==='vehicleB')||(a==='vehicleB'&&b==='vehicleA'));
export const node=(p,n)=>`${p.id}:${n}`;
export class Circuit{
 constructor(){this.parts=[];this.joints=[];this.key=false;this.powerUpper=null;this.previousPower=new Map();this.bypassLog=[];}
 graph(){const g=new Map();const add=(a,b)=>{if(!g.has(a))g.set(a,new Set());if(!g.has(b))g.set(b,new Set());g.get(a).add(b);g.get(b).add(a);};
 for(const part of this.parts){if(!['upper','lower'].includes(part.type))continue;const [a,b]=part.ports;for(const s of ['pos','gnd','lo','hi']){
 const f=part.fault;if((f==='F1'&&s==='pos')||(['F6','F8'].includes(f)&&s==='lo')||(['F7','F8'].includes(f)&&s==='hi')||(f==='F10'&&s==='pos')||(f==='F11'&&s==='gnd'))continue;
 if((part.contactFault==='F4'||part.contactFault==='F5')&&['lo','hi'].includes(s))continue;
 let bp=SIGNALS[b.kind][s];if(f==='F12'&&s==='hi')bp=12;
 add(node(a,SIGNALS[a.kind][s]),node(b,bp));}}
 for(const j of this.joints){if(!j.inserted)continue;if(!SIGNALS[j.a.kind])continue;for(let n=1;n<=(['up4','low4'].includes(j.a.kind)?4:12);n++){const s=Object.keys(SIGNALS[j.a.kind]).find(k=>SIGNALS[j.a.kind][k]===n);if(!j.secured&&s!=='pos'&&s!=='gnd')continue;add(node(j.a,n),node(j.b,n));}}
 this.g=g;return g;}
 connected(a,b){if(a===b)return true;const seen=new Set([a]),queue=[a];for(let i=0;i<queue.length;i++){for(const x of this.g.get(queue[i])||[]){if(x===b)return true;if(!seen.has(x)){seen.add(x);queue.push(x);}}}return false;}
 source(){const p=this.powerUpper?.ports.find(p=>p.kind==='up4');return p?{pos:this.powerUpper.fault==='F1'?node(this.powerUpper.ports.find(p=>p.kind==='orange'),2):node(p,1),gnd:node(p,2)}:null;}
 voltage(a,b){this.graph();const s=this.source();if(!this.key||!s)return 0;const level=x=>this.connected(x,s.pos)?12:this.connected(x,s.gnd)?0:null;const va=level(a),vb=level(b);return va===null||vb===null?0:va-vb;}
 continuity(a,b){this.graph();return this.connected(a,b);}
 evaluate(){this.graph();const src=this.source(),out={screens:{},ems:{}};const powered=p=>{const sig=SIGNALS[p.kind];return !!(this.key&&src&&this.connected(node(p,sig.pos),src.pos)&&this.connected(node(p,sig.gnd),src.gnd));};
 for(const em of this.parts.filter(p=>p.type==='em')){const p=em.ports[0],on=powered(p);if(on&&!this.previousPower.get(em.id)&&em.fault==='F2'&&em.hasBeenPowered)em.fault=null;if(on)em.hasBeenPowered=true;this.previousPower.set(em.id,on);out.ems[em.id]=!on?'off':['F2','F3'].includes(em.fault)?'steady':'blink';}
 for(const scr of this.parts.filter(p=>p.type==='screen')){const p=scr.ports[0];if(!powered(p)){out.screens[scr.id]='off';continue;}let communicates=false;for(const em of this.parts.filter(p=>p.type==='em')){const ep=em.ports[0];if(out.ems[em.id]==='blink'&&this.connected(node(p,9),node(ep,1))&&this.connected(node(p,10),node(ep,2)))communicates=true;}out.screens[scr.id]=communicates&&scr.fault!=='F9'?'normal':'spinner';}return out;}
}
