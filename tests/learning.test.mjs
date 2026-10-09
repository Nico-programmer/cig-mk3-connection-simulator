import assert from 'node:assert/strict';
import {LearningFlow,lessons} from '../dist/learning.js';
const flow=new LearningFlow();
assert.deepEqual(flow.steps.filter(s=>['end','upper','lower'].includes(s.id)).map(s=>s.id),['end','upper','lower']);
flow.observe({mode:'voltage',segment:0,signal:'lo',sameSignal:true,passes:true});assert.deepEqual(flow.end,{});
flow.observe({mode:'continuity',segment:0,signal:'lo',sameSignal:false,passes:true});assert.deepEqual(flow.end,{});
flow.observe({mode:'continuity',segment:0,signal:'lo',sameSignal:true,passes:true});assert.equal(flow.steps.length,12);
flow.observe({mode:'continuity',segment:0,signal:'hi',sameSignal:true,passes:false});assert.equal(flow.steps.length,12);
flow.observe({mode:'continuity',segment:0,signal:'hi',sameSignal:true,passes:true});assert.equal(flow.steps.length,10);
flow.setMode('practice');flow.reset();assert.equal(flow.mode,'practice');assert.equal(flow.steps.length,12);
for(const lesson of lessons){assert.ok(lesson.body.es.length>100&&lesson.body.en.length>100);assert.doesNotMatch(JSON.stringify(lesson),/\bF(?:[1-9]|1[0-2])\b/);}
assert.throws(()=>flow.setMode('wrong'));
console.log('Learning order, continuity skip, reset, translations and scenario-independent content passed.');
