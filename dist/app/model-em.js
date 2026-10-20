// Optional realistic Expansion Module (public/Expansion_Module_FLEET.glb). Loaded once, before the
// first scenario is built. When it is not available (tests, file://, ?model=0, load error) the EM keeps
// its procedural body. The model's own contacts and thread cap are hidden: its 11+1 contact layout is
// not the real 8+4 one, so the procedural pins (numbered as in the connector diagram) stay on top.
import * as T from "three";
import { DRACOLoader } from "../vendor/loaders/DRACOLoader.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

// Model metres -> scene units (the model is 0.07 x 0.15 x 0.04; the procedural body was 1.75 x 2.48).
export const EM_SCALE = 20;
// Pieces that are not drawn: 11 = thread (a closed cap that covers the pins), 13 = the model's contacts.
const HIDDEN = /^(11|13)[ _]/;
// `body` is null until the model has loaded; `port` is the insulator face (centre and z) in body units.
export const em3d = { body: null, port: null, box: null };

const here = (path) => new URL(path, import.meta.url).href;

async function load() {
  const draco = new DRACOLoader().setDecoderPath(here("../vendor/libs/draco/gltf/"));
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(here("../public/Expansion_Module_FLEET.glb"));
  draco.dispose();
  const model = gltf.scene;
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = false;
    m.raycast = () => {};
    m.userData.sharedModel = true;
    if (HIDDEN.test(m.name)) m.visible = false;
  });
  // The GLB is Z-up in metres: stand it up (face towards +z, label end up) and centre it.
  const wrapper = new T.Group();
  wrapper.add(model);
  wrapper.rotation.x = Math.PI / 2;
  wrapper.scale.setScalar(EM_SCALE);
  const body = new T.Group();
  body.add(wrapper);
  body.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(wrapper);
  wrapper.position.sub(box.getCenter(new T.Vector3()));
  body.updateMatrixWorld(true);
  const centred = new T.Box3().setFromObject(wrapper);
  let insulator = null;
  model.traverse((m) => /^10[ _]/.test(m.name) && (insulator = m));
  const face = new T.Box3().setFromObject(insulator);
  const c = face.getCenter(new T.Vector3());
  em3d.port = { x: c.x, y: c.y, z: face.max.z };
  em3d.box = centred;
  em3d.body = body;
  return true;
}

// Resolves true when the model is ready, false when the procedural body stays. Never rejects.
export async function loadEmModel(timeoutMs = 8000) {
  if (!import.meta.url.startsWith("http")) return false;
  try {
    if (new URLSearchParams(location.search).get("model") === "0") return false;
  } catch {}
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([load().catch((e) => (console.warn("Expansion Module model not loaded:", e?.message || e), false)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
