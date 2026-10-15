// Optional realistic MK3 body (public/mk3-ligero.glb) and login image. Loaded once, before the
// first scenario is built. When it is not available (tests, file://, ?model=0, load error) the
// MK3 keeps its procedural body, so nothing else in the app depends on it.
import * as T from "three";
import { DRACOLoader } from "../vendor/loaders/DRACOLoader.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

// Model units -> scene units: the model is 1.28 high, the procedural body was 2.12.
export const MK3_SCALE = 2.12 / 1.28;
// The screen plane, in model units (calibrated in model-test.html). It faces -z, like the display.
export const MK3_SCREEN = { x: 0, y: 0, z: -0.312, w: 1.74, aspect: 800 / 480 };
// Shared by every MK3 clone; `body` is null until the model has loaded.
export const mk3 = { body: null, login: null };

// Triangles kept per MK3 (the raw model has ~480k and the bench shows two of them).
export const MK3_TARGET_TRIANGLES = 90000;
const CELLS = [0.002, 0.003, 0.004, 0.006, 0.008, 0.012, 0.018, 0.025];

// Vertex clustering: snaps vertices to a grid of `cell` units, merges the ones in the same cell
// (the first one keeps its attributes) and drops the triangles that collapse.
function cluster(geometry, cell) {
  const pos = geometry.attributes.position;
  const src = geometry.index ? geometry.index.array : null;
  const count = src ? src.length : pos.count;
  const map = new Map();
  const keep = [];
  const remap = new Uint32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = (Math.round(pos.getX(i) / cell) + 4096) + (Math.round(pos.getY(i) / cell) + 4096) * 8192 + (Math.round(pos.getZ(i) / cell) + 4096) * 67108864;
    let id = map.get(key);
    if (id === undefined) {
      id = keep.length;
      map.set(key, id);
      keep.push(i);
    }
    remap[i] = id;
  }
  const idx = [];
  for (let t = 0; t < count; t += 3) {
    const a = remap[src ? src[t] : t], b = remap[src ? src[t + 1] : t + 1], c = remap[src ? src[t + 2] : t + 2];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { keep, idx };
}

// Replaces the mesh geometries by simplified ones until the model is under `target` triangles.
export function simplifyModel(root, target = MK3_TARGET_TRIANGLES) {
  const meshes = [];
  root.traverse((m) => m.isMesh && m.geometry && m.geometry.attributes.position && meshes.push(m));
  const total = (cell) => meshes.reduce((n, m) => n + cluster(m.geometry, cell).idx.length / 3, 0);
  let cell = CELLS[CELLS.length - 1];
  for (const c of CELLS) {
    if (total(c) <= target) {
      cell = c;
      break;
    }
  }
  for (const m of meshes) {
    const old = m.geometry;
    const { keep, idx } = cluster(old, cell);
    const g = new T.BufferGeometry();
    for (const name of Object.keys(old.attributes)) {
      const a = old.attributes[name];
      const out = new a.array.constructor(keep.length * a.itemSize);
      for (let i = 0; i < keep.length; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.array[keep[i] * a.itemSize + k];
      g.setAttribute(name, new T.BufferAttribute(out, a.itemSize, a.normalized));
    }
    g.setIndex(new T.BufferAttribute(keep.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    m.geometry = g;
    old.dispose();
  }
  return cell;
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
  simplifyModel(model);
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
