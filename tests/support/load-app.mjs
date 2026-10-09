// Shared test loader. Works with both the original single-file app.js and the
// modular dist/app/ layout. It rewires the bare 'three' specifier for Node,
// swaps WebGLRenderer for globalThis.FakeRenderer, and returns an object that
// exposes the application internals the test suites read.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const API = ['probePose', 'meter', 'refreshProbes', 'refreshColliders', 'probeBlocked', 'probeObstacles', 'leadPath', 'refreshVoltageReading', 'animate', 'updatePinGuidance', 'highlightedPins', 'pinHighlightGroup', 'lessonMeasurement', 'workParts', 'lessonCheck', 'prepareLesson', 'swapParts', 'bypassPorts', 'align', 'attach', 'refreshCables', 'learning', 'drawMeter', 'updateLabels', 'buildScenario', 'parts', 'circuit', 'collision', 'selected', 'moveSelected', 'trySnap', 'rotateSelected', 'worldPos', 'worldQ', 'setWorldPosition', 'setWorldQuaternion', 'scene', 'V', 'Q', 'joints', 'compatible', 'allColliders', 'colliderOf', 'cameraSafe', 'camera', 'guardCamera', 'renderer', 'releaseDrag', 'drag', 'lastCamera', 'moveProbe', 'sceneCursor', 'hits', 'meterMode', 'nearbyProbeContact', 'updateMeterControls', 'turnThread', 'focus', 'connectSelected', 'disconnectSelected', 'probeTools', 'placeProbe', 'updateHitboxes', 'hitboxGroup', 'takeProbe', 'testStage', 'meterResult'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

export async function loadApp(temp) {
  const dist = path.join(temp, 'dist');
  const three = path.join(dist, 'vendor', 'three.module.js');
  for (const file of walk(dist)) {
    if (!file.endsWith('.js') || /vendor[\\/]three\./.test(file)) continue;
    let s = fs.readFileSync(file, 'utf8');
    let spec = path.relative(path.dirname(file), three).split(path.sep).join('/');
    if (!spec.startsWith('.')) spec = './' + spec;
    if (s.includes('new T.WebGLRenderer'))
      s = s.replace(
        /import \* as T from ['"]three['"];/,
        `import * as ActualT from ${JSON.stringify(spec)}; const T={...ActualT,WebGLRenderer:globalThis.FakeRenderer};`,
      );
    s = s.replace(/from ['"]three['"]/g, 'from ' + JSON.stringify(spec));
    fs.writeFileSync(file, s);
  }
  const entry = fs.readFileSync(path.join(dist, 'app.js'), 'utf8');
  if (entry.includes('new T.WebGLRenderer')) {
    // Original single-file layout (v16 and earlier).
    const s =
      entry +
      `\nexport {${API.join(',')}};\nexport function select(p){selected={port:p,part:p.part};} export function selectPart(p){selected={part:p,port:null};} export function meterOn(){meterMode="continuity";}\n`;
    fs.writeFileSync(path.join(dist, 'check-app.mjs'), s);
    return import(pathToFileURL(path.join(dist, 'check-app.mjs')).href);
  }
  // Modular layout: start the entry, then expose module exports and shared state.
  await import(pathToFileURL(path.join(dist, 'app.js')).href);
  const modules = await Promise.all(
    walk(path.join(dist, 'app'))
      .filter((f) => f.endsWith('.js'))
      .sort()
      .map((f) => import(pathToFileURL(f).href)),
  );
  const { S } = await import(pathToFileURL(path.join(dist, 'app', 'state.js')).href);
  const api = {};
  // Names the suites read that are imported helpers, not app/ exports.
  const { cachedCollider } = await import(pathToFileURL(path.join(dist, 'drag-performance.js')).href);
  const { compatible } = await import(pathToFileURL(path.join(dist, 'electrical.js')).href);
  Object.assign(api, { colliderOf: cachedCollider, compatible });
  for (const ns of modules)
    for (const key of Object.keys(ns))
      if (!(key in api)) Object.defineProperty(api, key, { get: () => ns[key], enumerable: true });
  for (const key of API)
    if (!(key in api)) Object.defineProperty(api, key, { get: () => S[key], enumerable: true });
  api.select = (p) => (S.selected = { port: p, part: p.part });
  api.selectPart = (p) => (S.selected = { part: p, port: null });
  api.meterOn = () => (S.meterMode = 'continuity');
  return api;
}
