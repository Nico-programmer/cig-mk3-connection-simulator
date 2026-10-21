// Optional realistic connectors: the orange 12-pin of the upper harness (public/connector-12-pin-ligero.glb, a
// Deutsch DT 12 receptacle) and its white 4-pin (public/connector_4pin_top_light.glb), and its female half (public/connector_4pines_hembra_light.glb). Loaded once, before the
// first scenario is built; each one that is not available (tests, file://, ?model=0, load error) keeps its
// procedural body. The model contacts are regular grids (2 x 6 and 2 x 2); the procedural pins are moved onto them.
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

// Real sizes are given in millimetres and converted with the orange 12-pin as the reference: its shell is
// 51.7 mm wide in its GLB (metres) and is drawn CONNECTOR_SCALE x 0.0517 = 0.65 wide, so 1 mm = 0.0125 scene units.
export const UNITS_PER_MM = CONNECTOR_SCALE / 1000;
// The white 4-pin (the "top" one, with the locking tab towards +y) is drawn a little under half as wide as the
// orange one (0.65): 24 mm = 0.30, well over the cable jacket (0.172 across) so it is seen and probed easily.
// Its GLB is 21 mm wide, so it is drawn at CONNECTOR4_WIDTH_MM / 21 of its size (no depth change).
export const CONNECTOR4_WIDTH_MM = 24;
export const CONNECTOR4_SCALE = (CONNECTOR4_WIDTH_MM * UNITS_PER_MM) / 0.021;
export const CONNECTOR4_DEPTH_SCALE = 1;
// Face and shell (z), body width and height range (y: the tab goes up to +0.0093) and contact pitch (2 x 2 grid
// at +-0.0032), in model metres.
export const CONNECTOR4_MODEL = { faceZ: 0.028, shellBackZ: 0.008, width: 0.021, yMin: -0.0077, yMax: 0.0093, pitch: 0.0064 };
export const conn4 = { body: null };
// Its mating half, the white 4-pin of the lower harness (public/connector_4pines_hembra_light.glb): the same body
// and terminals, with the locking latch on the -x side (x from -0.0129 to 0.0105) instead of on top.
export const CONNECTOR4F_MODEL = { faceZ: 0.028, shellBackZ: 0.008, xMin: -0.0129, xMax: 0.0105, yMin: -0.0077, yMax: 0.0077, pitch: 0.0064 };
export const conn4f = { body: null };
// The circular 12-pin of the lower harness (public/connector_circular_12p_light.glb), a 28 mm round plug. Model
// metres -> scene units: 15.2 gives a shell 0.43 across, just over the Expansion Module's connector cylinder (0.40
// across) that it fits over; the hexagonal nut behind it (0.50 across the flats) stays visible around it. The plug is
// stretched 1.5 x along its axis (0.43 long), as the real one is longer than a plain 28 mm cylinder.
export const CONNECTORC_SCALE = 15.2;
export const CONNECTORC_DEPTH_SCALE = 1.5;
export const CONNECTORC_MODEL = {
  faceZ: 0.03,
  shellBackZ: 0.01,
  radius: 0.014,
  contactZ: 0.0249,
  outer: [[0.0018, 0.0054], [-0.0018, 0.0054], [-0.0054, 0.0018], [-0.0054, -0.0018], [-0.0018, -0.0054], [0.0018, -0.0054], [0.0054, -0.0018], [0.0054, 0.0018]],
  inner: [[0.0018, 0.0018], [-0.0018, 0.0018], [-0.0018, -0.0018], [0.0018, -0.0018]],
};
export const connC = { body: null };

const here = (path) => new URL(path, import.meta.url).href;

async function load(file, target) {
  const draco = new DRACOLoader().setDecoderPath(here("../vendor/libs/draco/gltf/"));
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(here("../public/" + file));
  draco.dispose();
  gltf.scene.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = false;
    m.raycast = () => {}; // the invisible pin hit-spheres and the port collider do the picking
    m.userData.sharedModel = true;
  });
  const body = new T.Group();
  body.add(gltf.scene);
  target.body = body;
  return true;
}

// Loads one model, resolving true when it is ready and false when the procedural body stays. Never rejects.
async function loadOptional(name, file, target, timeoutMs) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([load(file, target).catch((e) => (console.warn(name + " model not loaded:", e?.message || e), false)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Resolves true when every connector model is ready. Never rejects.
export async function loadConnectorModel(timeoutMs = 8000) {
  if (!import.meta.url.startsWith("http")) return false;
  try {
    if (new URLSearchParams(location.search).get("model") === "0") return false;
  } catch {}
  const ready = await Promise.all([
    loadOptional("12-pin connector", "connector-12-pin-ligero.glb", conn12, timeoutMs),
    loadOptional("4-pin connector", "connector_4pin_top_light.glb", conn4, timeoutMs),
    loadOptional("4-pin female connector", "connector_4pines_hembra_light.glb", conn4f, timeoutMs),
    loadOptional("circular connector", "connector_circular_12p_light.glb", connC, timeoutMs),
  ]);
  return ready.every(Boolean);
}
