// Optional realistic 12-pin connector (public/connector-12-pin-ligero.glb, a Deutsch DT 12 receptacle)
// for the orange connector of the upper harness. Loaded once, before the first scenario is built; when
// it is not available (tests, file://, ?model=0, load error) the connector keeps its procedural body.
// The model's 12 contacts are a regular 2 x 6 grid; the procedural pins are moved onto it.
import * as T from "three";
import { DRACOLoader } from "../vendor/loaders/DRACOLoader.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

// Model metres -> scene units. 12.5 makes the shell 0.65 x 0.41: the width between the two locking ears of the
// rectangular recess in the MK3 (measured on public/cara-mk3-pines.png: 146 x 85 px of 706 = 0.65 x 0.39 scene units).
export const CONNECTOR_SCALE = 12.5;
// Depth factor: in the reference photo of the real mated plug its body stands out of the housing by about a third
// of its width (0.65 x 0.35 = 0.23) above the ears of the recess (+0.14): 1.25 gives a shell 0.48 deep, seated 0.10 in.
export const CONNECTOR_DEPTH_SCALE = 1.25;
// Insulator face, shell and contact grid, in model metres (z is the connector axis; the face looks towards +z).
// The shell is 0.0517 wide (with the locking tab) x 0.0325 high and runs from z = 0.007 to the face; behind it is
// only the narrow rubber boot.
export const CONNECTOR_MODEL = { faceZ: 0.0377, shellBackZ: 0.007, width: 0.0517, height: 0.0325, pitch: 0.0065, rowY: 0.007, bootZ: 0 };
// `body` is null until the model has loaded.
export const conn12 = { body: null };

const here = (path) => new URL(path, import.meta.url).href;

async function load() {
  const draco = new DRACOLoader().setDecoderPath(here("../vendor/libs/draco/gltf/"));
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(here("../public/connector-12-pin-ligero.glb"));
  draco.dispose();
  gltf.scene.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = false;
    m.raycast = () => {}; // the invisible pin hit-spheres and the port collider do the picking
    m.userData.sharedModel = true;
  });
  const body = new T.Group();
  body.add(gltf.scene);
  conn12.body = body;
  return true;
}

// Resolves true when the model is ready, false when the procedural body stays. Never rejects.
export async function loadConnectorModel(timeoutMs = 8000) {
  if (!import.meta.url.startsWith("http")) return false;
  try {
    if (new URLSearchParams(location.search).get("model") === "0") return false;
  } catch {}
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([load().catch((e) => (console.warn("Connector model not loaded:", e?.message || e), false)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
