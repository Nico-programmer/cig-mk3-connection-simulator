// Optional realistic multimeter (public/multimeter_light.glb, a UNI-T UT105). Loaded once, before the first scenario is
// built, and put in the bench's `meter` group in place of the procedural body, dial and jacks. The display keeps the
// canvas drawn by meter.js (it is the model's `lcd_screen` plane with that canvas as its texture). When the model is
// not available (tests, file://, ?model=0, load error) the procedural multimeter stays.
import * as T from "three";
import { DRACOLoader } from "../vendor/loaders/DRACOLoader.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { mergeGeometries } from "../vendor/utils/BufferGeometryUtils.js";
import { dialNeedle, meter, meterTexture, plugs } from "./bench.js";

// Model metres -> scene units: the procedural body was 3.45 tall, the model is 0.178 m.
export const METER_SCALE = 3.45 / 0.178;
// Rotation of the selector (about its axis, radians) for each mode. At 0 the pointer is on the continuity symbol; the
// DC volts 20 V range is 136° clockwise from there. The model has no OFF position: the pointer rests between marks.
const DIAL_ANGLE = { continuity: 0, voltage: (-136.4 * Math.PI) / 180, off: (195 * Math.PI) / 180 };
// `dial` is null until the model has loaded.
export const meter3d = { dial: null };

const here = (path) => new URL(path, import.meta.url).href;

// The pieces of the model that never move (everything under `body`) are merged per material: ~30 draw calls become ~10.
// If a group cannot be merged (different attributes) its meshes stay as they are.
function mergeStatic(model) {
  const body = model.getObjectByName("body");
  model.updateMatrixWorld(true);
  const groups = new Map();
  body.traverse((m) => {
    if (m.isMesh) groups.set(m.material, [...(groups.get(m.material) ?? []), m]);
  });
  for (const [material, meshes] of groups) {
    try {
      const geometries = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
      const merged = mergeGeometries(geometries);
      if (!merged) continue;
      const mesh = new T.Mesh(merged, material);
      mesh.raycast = () => {};
      mesh.userData.sharedModel = true;
      model.add(mesh);
      for (const m of meshes) {
        m.parent.remove(m);
        m.geometry.dispose();
      }
    } catch (e) {
      console.warn("Multimeter pieces not merged:", e?.message || e);
    }
  }
}

// Procedural pieces that the model replaces: not drawn and not pickable (their colliders go, the body's is resized).
function retireProcedural(keep) {
  for (const m of [...meter.children]) {
    if (m === keep || plugs.includes(m)) continue;
    m.visible = false;
    m.raycast = () => {};
    if (m.userData.main) m.userData.solid.set(0.0435 * METER_SCALE, 0.089 * METER_SCALE, 0.0225 * METER_SCALE);
    else delete m.userData.solid;
  }
}

async function load() {
  const draco = new DRACOLoader().setDecoderPath(here("../vendor/libs/draco/gltf/"));
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(here("../public/multimeter_light.glb"));
  draco.dispose();
  const model = gltf.scene;
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = false;
    m.raycast = () => {}; // only the dial and the display are picked, below
    m.userData.sharedModel = true;
  });
  // The model's own collision box and empty jack markers are not drawn.
  const hide = (name) => {
    const n = model.getObjectByName(name);
    if (n) n.visible = false;
  };
  hide("collider_body");
  const wrapper = new T.Group();
  wrapper.scale.setScalar(METER_SCALE);
  wrapper.add(model);
  mergeStatic(model);
  // Display: the model's glass plane takes the canvas of meter.js. Its 61 x 47 mm window is a bit taller than the
  // canvas (720 x 440), so the plane is shortened to the canvas proportions.
  const lcd = model.getObjectByName("lcd_screen");
  // (its own texture coordinates point at one texel of the model's texture: a plain plane with 0..1 ones instead)
  lcd.geometry.dispose();
  lcd.geometry = new T.PlaneGeometry(0.061, 0.061 / (720 / 440));
  lcd.material = new T.MeshBasicMaterial({ map: meterTexture });
  lcd.raycast = T.Mesh.prototype.raycast;
  lcd.userData.action = "meterFocus";
  // Selector: a coarse invisible cylinder picks it (the visible dial has 19k triangles).
  const dial = model.getObjectByName("selector_dial");
  const pick = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.008, 16), new T.MeshBasicMaterial({ visible: false }));
  pick.rotation.x = Math.PI / 2;
  pick.position.z = 0.003;
  pick.userData.action = "meter";
  dial.add(pick);
  meter3d.dial = dial;
  meter.add(wrapper);
  // Banana plugs: into the VΩ and COM jacks of the model.
  const jack = (name) => model.getObjectByName(name).position.clone().multiplyScalar(METER_SCALE);
  const red = jack("jack_VOhm"),
    black = jack("jack_COM");
  plugs[0].position.set(red.x, red.y, 0.03);
  plugs[0].rotation.z = 0; // straight down: it does not cross the black plug
  plugs[1].position.set(black.x, black.y, 0.03);
  retireProcedural(wrapper);
  turnDial("off");
  return true;
}

// Resolves true when the model is ready, false when the procedural multimeter stays. Never rejects.
export async function loadMeterModel(timeoutMs = 8000) {
  if (!import.meta.url.startsWith("http")) return false;
  try {
    if (new URLSearchParams(location.search).get("model") === "0") return false;
  } catch {}
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([load().catch((e) => (console.warn("Multimeter model not loaded:", e?.message || e), false)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Turns the selector to a mode ("off" | "voltage" | "continuity"): the model's dial, or the procedural needle.
export function turnDial(mode) {
  if (meter3d.dial) meter3d.dial.rotation.z = DIAL_ANGLE[mode] ?? 0;
  else dialNeedle.rotation.z = mode === "voltage" ? -0.8 : mode === "continuity" ? -1.6 : 0;
}
