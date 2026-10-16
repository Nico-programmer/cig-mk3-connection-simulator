// Optional realistic MK3 body (public/mk3-ligero.glb) and login image. Loaded once, before the
// first scenario is built. When it is not available (tests, file://, ?model=0, load error) the
// MK3 keeps its procedural body, so nothing else in the app depends on it.
import * as T from "three";
import { DRACOLoader } from "../vendor/loaders/DRACOLoader.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { MeshoptSimplifier } from "../vendor/meshopt_simplifier.module.js";

// Model units -> scene units: the model is 1.28 high, the procedural body was 2.12.
export const MK3_SCALE = 2.12 / 1.28;
// The screen plane, in model units (calibrated in model-test.html). It faces -z, like the display.
export const MK3_SCREEN = { x: 0, y: 0, z: -0.312, w: 1.74, aspect: 800 / 480 };
// Shared by every MK3 clone; `body` is null until the model has loaded.
export const mk3 = { body: null, login: null };

// Triangles kept per MK3 (the raw model has ~480k and the bench shows two of them).
export const MK3_TARGET_TRIANGLES = 90000;

// Quadric edge-collapse simplification (meshoptimizer). It keeps the original vertices, so UVs and
// normals are untouched, and it weighs UV and normal error so the label and the shading survive.
// Replaces the geometry of every mesh under `root` until the whole model has ~`target` triangles.
export async function simplifyModel(root, target = MK3_TARGET_TRIANGLES) {
  await MeshoptSimplifier.ready;
  MeshoptSimplifier.useExperimentalFeatures = true;
  const meshes = [];
  root.traverse((m) => m.isMesh && m.geometry && m.geometry.attributes.position && meshes.push(m));
  let triangles = 0;
  for (const m of meshes) triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const ratio = Math.min(1, target / Math.max(1, triangles));
  for (const m of meshes) {
    const old = m.geometry;
    const pos = old.attributes.position, uv = old.attributes.uv, nor = old.attributes.normal;
    const n = pos.count;
    const positions = new Float32Array(n * 3);
    const attrs = new Float32Array(n * 5); // uv (2) + normal (3)
    for (let v = 0; v < n; v++) {
      positions.set([pos.getX(v), pos.getY(v), pos.getZ(v)], v * 3);
      if (uv) attrs.set([uv.getX(v), uv.getY(v)], v * 5);
      if (nor) attrs.set([nor.getX(v), nor.getY(v), nor.getZ(v)], v * 5 + 2);
    }
    let indices;
    if (old.index) indices = Uint32Array.from(old.index.array);
    else indices = Uint32Array.from({ length: n }, (_, k) => k);
    const wanted = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
    const [simple] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attrs, 5, [1, 1, 0.5, 0.5, 0.5], null, wanted, 1);
    // Compact: keep only the vertices the new triangles use.
    const remap = new Int32Array(n).fill(-1);
    const keep = [];
    const idx = new Uint32Array(simple.length);
    for (let k = 0; k < simple.length; k++) {
      const v = simple[k];
      if (remap[v] < 0) {
        remap[v] = keep.length;
        keep.push(v);
      }
      idx[k] = remap[v];
    }
    const g = new T.BufferGeometry();
    for (const name of Object.keys(old.attributes)) {
      const a = old.attributes[name];
      const out = new a.array.constructor(keep.length * a.itemSize);
      for (let k = 0; k < keep.length; k++) for (let c = 0; c < a.itemSize; c++) out[k * a.itemSize + c] = a.array[keep[k] * a.itemSize + c];
      g.setAttribute(name, new T.BufferAttribute(out, a.itemSize, a.normalized));
    }
    g.setIndex(new T.BufferAttribute(keep.length > 65535 ? idx : new Uint16Array(idx), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    m.geometry = g;
    old.dispose();
  }
}

const here = (path) => new URL(path, import.meta.url).href;

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function load() {
  const draco = new DRACOLoader().setDecoderPath(here("../vendor/libs/draco/gltf/"));
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const [gltf, login] = await Promise.all([loader.loadAsync(here("../public/mk3-ligero.glb")), loadImage(here("../public/logo-login-mk3.png"))]);
  draco.dispose();
  const model = gltf.scene;
  await simplifyModel(model);
  const center = new T.Box3().setFromObject(model).getCenter(new T.Vector3());
  model.position.sub(center);
  model.traverse((m) => {
    if (!m.isMesh) return;
    // 480k triangles: never cast shadows, never raycast (an invisible box picks the part), and
    // never dispose (scenario rebuilds dispose everything else; the clones share this geometry).
    m.castShadow = m.receiveShadow = false;
    m.raycast = () => {};
    m.userData.sharedModel = true;
  });
  const body = new T.Group();
  body.add(model);
  mk3.body = body;
  mk3.login = login;
  return true;
}

// Resolves true when the model is ready, false when the procedural body stays. Never rejects.
export async function loadMk3Model(timeoutMs = 8000) {
  if (!import.meta.url.startsWith("http")) return false;
  try {
    if (new URLSearchParams(location.search).get("model") === "0") return false;
  } catch {}
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([load().catch(() => false), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
