import assert from 'node:assert/strict';
import {Circuit,node,PINS} from '../dist/electrical.js';
function fixture(fault,segment='upper'){
 const c=new Circuit();let id=0;const part=(type,kinds)=>{const p={id:type,type,ports:[],fault:null};p.ports=kinds.map(kind=>({id:kind+(++id),kind,part:p}));c.parts.push(p);return p;};
 const screen=part('screen',['screen']),upper=part('upper',['orange','up4']),lower=part('lower',['low4','circular']),em=part('em',['em']);
 for(const [a,b] of [[screen.ports[0],upper.ports[0]],[upper.ports[1],lower.ports[0]],[lower.ports[1],em.ports[0]]])c.joints.push({a,b,inserted:true,secured:true,thread:6});
 c.key=true;c.powerUpper=upper;if(['F1','F6','F7','F8'].includes(fault))(segment==='upper'?upper:lower).fault=fault;
 if(['F2','F3'].includes(fault))em.fault=fault;if(fault==='F9')screen.fault=fault;if(['F10','F11'].includes(fault))upper.fault=fault;if(fault==='F12')lower.fault=fault;if(fault==='F4'){upper.contactFault='F4';c.joints[1].secured=false;}if(fault==='F5'){lower.contactFault='F5';c.joints[2].secured=false;c.joints[2].thread=3;}
 return {c,screen,upper,lower,em};
}
let checks=0;function eq(a,b,msg){assert.equal(a,b,msg);checks++;}
for(const code of ['healthy',...Array.from({length:12},(_,i)=>'F'+(i+1))])for(const segment of ['upper','lower']){
 const {c,screen,upper,lower,em}=fixture(code,segment);const s=c.evaluate();eq(s.screens.screen,code==='healthy'?'normal':['F10','F11'].includes(code)?'off':'spinner',code+' screen');eq(s.ems.em,code==='F1'?'off':['F2','F3'].includes(code)?'steady':'blink',code+' LED');
 if(['F1','F6','F7','F8'].includes(code)){const owner=segment==='upper'?upper:lower;const good=segment==='upper'?lower:upper;good.fault=null;eq(c.evaluate().screens.screen,'spinner','Wrong replacement must preserve symptom');owner.fault=null;eq(c.evaluate().screens.screen,'normal','Correct harness replacement');}
 if(['F2','F3'].includes(code)){c.key=false;c.evaluate();c.key=true;eq(c.evaluate().ems.em,code==='F2'?'blink':'steady','Reboot behavior');}
 if(code==='F12'){eq(c.continuity(node(upper.ports[0],10),node(lower.ports[1],12)),true,'Wrong pin passes continuity');eq(c.continuity(node(upper.ports[0],10),node(lower.ports[1],2)),false,'Correct CAN HI pin open');lower.fault=null;eq(c.evaluate().screens.screen,'normal','Lower harness replacement fixes F12');}
 if(code==='F4'){upper.contactFault=null;c.joints[1].secured=true;eq(c.evaluate().screens.screen,'normal','Reseat F4');}
 if(code==='F5'){lower.contactFault=null;c.joints[2].secured=true;c.joints[2].thread=6;eq(c.evaluate().screens.screen,'normal','Tighten F5');}
 if(['F6','F7','F8'].includes(code)){const f=fixture(code,segment);const pin=code==='F7'?10:9,mp=code==='F7'?4:3,ep=code==='F7'?2:1;eq(f.c.continuity(node(f.upper.ports[0],pin),node(f.lower.ports[1],ep)),false,'End-to-end failure');eq(f.c.continuity(node(f.upper.ports[0],pin),node(f.upper.ports[1],mp)),segment!=='upper','Upper localization');eq(f.c.continuity(node(f.lower.ports[0],mp),node(f.lower.ports[1],ep)),segment!=='lower','Lower localization');}
}
{const {c,lower}=fixture('healthy');eq(c.voltage(node(lower.ports[1],7),node(lower.ports[1],8)),12,'Supply');eq(c.voltage(node(lower.ports[1],8),node(lower.ports[1],7)),-12,'Polarity');c.key=false;eq(c.voltage(node(lower.ports[1],7),node(lower.ports[1],8)),0,'Key off');}
for(const code of ['F9','F10','F11','F3']){const f=fixture(code);f.c.evaluate();if(code==='F9')f.screen.fault=null;else if(code==='F3')f.em.fault=null;else f.upper.fault=null;eq(f.c.evaluate().screens.screen,'normal',code+' replacement');}
for(const n of [3,4,5,6,11,12])eq(PINS.screen[n],undefined,'Undocumented pins');
console.log(`${checks} electrical assertions passed across F1–F12, both configurable harness segments, voltage polarity, reboot, continuity and replacements.`);
