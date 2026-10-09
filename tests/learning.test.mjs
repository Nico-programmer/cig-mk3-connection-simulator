import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lessons,pinTargets} from '../dist/learning.js';
assert.deepEqual(lessons.map(l=>l.id),['assembly','led','voltage','seating','wires','continuity','swap','bypass']);
for(const l of lessons){assert.ok(l.title.es&&l.title.en&&l.scenario&&l.steps.length);for(const step of l.steps){assert.ok(step.text.es&&step.text.en&&step.check);assert.ok(step.text.es.length<390,'Compact instruction '+step.id);}}
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
assert.doesNotMatch(html,/<dialog|instructor|practiceMode|trainingModes/);assert.doesNotMatch(app,/openInstructor|set_training_scenario|Math.random/);
const c=lessons.find(l=>l.id==='continuity').steps.map(s=>s.id);assert.deepEqual(c,['off','endLo','endHi','skip','failed','upper','lower','isolate']);
console.log('Eight ordered bilingual lessons, compact content, continuity order and removed instructor/evaluator passed.');

assert.deepEqual(pinTargets('voltage','mode').map(p=>[p.kind,p.n,p.tone]),[['circular',7,'red'],['circular',8,'black']]);
assert.deepEqual(pinTargets('continuity','upper').map(p=>[p.kind,p.n]),[['orange',9],['up4',3]]);
assert.deepEqual(pinTargets('continuity','lower').map(p=>[p.kind,p.n]),[['circular',1],['low4',3]]);
assert.deepEqual(pinTargets('wires','circular').map(p=>p.n),[1,2,12]);assert.deepEqual(pinTargets('led','normal'),[]);
