// Builders for the MK3 screen, Expansion Module and both harnesses.
import * as T from "three";
import { box, cylinder, label, makePort, material, palette } from "../geometry.js";
import { updateCable } from "./cables.js";
import { dynamic } from "./scene.js";
import { Q, V, tr } from "./util.js";
import { S } from "./state.js";

export function addPart(type, spare = false) {
  const p = {
    id: `${type}-${++S.idcount}`,
    type,
    root: new T.Group(),
    ports: [],
    fault: null,
    spare,
    colliders: [],
    screenCanvas: null,
    led: null,
    cableMesh: null,
  };
  dynamic.add(p.root);
  p.root.userData.part = p;
  S.parts.push(p);
  return p;
}
export function finishPart(p) {
  p.root.traverse((m) => {
    if (m.isMesh && !m.userData.pin && !m.userData.latch) m.userData.part = p;
    if (m.userData.solid) p.colliders.push(m);
  });
}
export function makeScreen(position, spare = false) {
  const p = addPart("screen", spare);
  p.root.position.copy(position);
  p.root.rotation.y = -0.6;
  box(p.root, 3.15, 2.12, 0.52, palette.dark, 0, 1.15, 0);
  box(p.root, 3.02, 1.98, 0.06, 0x131b22, 0, 1.15, 0.29);
  box(p.root, 3.1, 2.02, 0.07, palette.metal, 0, 1.15, -0.295);
  for (const x of [-1.37, 1.37])
    for (const y of [0.32, 1.99]) cylinder(p.root, 0.045, 0.02, 0x89949d, x, y, 0.331);
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 440;
  p.screenCanvas = c;
  p.screenTexture = new T.CanvasTexture(c);
  p.screenTexture.colorSpace = T.SRGBColorSpace;
  const display = new T.Mesh(
    new T.PlaneGeometry(2.67, 1.53),
    new T.MeshBasicMaterial({
      map: p.screenTexture,
    }),
  );
  display.position.set(0, 1.19, 0.335);
  p.root.add(display);
  label(p.root, "FLEET iQ360", 1, 0.15, V(0, 0.27, 0.336), {
    bg: "#131b22",
    fg: "#aebbc4",
    size: 30,
    height: 64,
  });
  const port = makePort(p, "screen", p.id + "-main", V(0.4, 0.86, -0.6), Q(0, Math.PI, 0), p.root);
  const cam = cylinder(p.root, 0.25, 0.14, palette.dark, -1, 0.8, -0.4);
  cam.userData.tooltip = () => tr("cámara · sin función", "camera · no function");
  for (let i = 0; i < 6; i++)
    cylinder(
      p.root,
      0.025,
      0.07,
      palette.gold,
      -1 + Math.cos((i * Math.PI) / 3) * 0.13,
      0.8 + Math.sin((i * Math.PI) / 3) * 0.13,
      -0.51,
    );
  const cameraLabel = label(p.root, tr("cámara", "camera"), 0.7, 0.14, V(-1, 0.36, -0.345), {
    bg: "#aab6bf",
    fg: "#17222b",
    size: 27,
    height: 64,
  });
  cameraLabel.rotation.y = Math.PI;
  p.cameraLabel = cameraLabel;
  for (const x of [-1.1, 1.1]) {
    box(p.root, 0.25, 0.22, 0.8, palette.dark, x, 0.04, 0.08);
  }
  finishPart(p);
  return p;
}
export function makeEM(position, spare = false) {
  const p = addPart("em", spare);
  p.root.position.copy(position);
  box(p.root, 1.75, 2.48, 0.55, 0xbec9cb, 0, 1.25, 0);
  for (const y of [0.15, 2.36]) box(p.root, 1.9, 0.23, 0.65, 0xcdd5d6, 0, y, 0);
  label(p.root, "Expansion Module", 1.54, 0.22, V(0, 2.08, 0.286), {
    bg: "#bec9cb",
    fg: "#26333b",
    size: 30,
  });
  label(p.root, "FLEET iQ360", 1.3, 0.2, V(0, 1.82, 0.286), {
    bg: "#bec9cb",
    fg: "#26333b",
    size: 30,
  });
  makePort(p, "em", p.id + "-em", V(0, 1.13, 0.58), Q(), p.root);
  for (let i = 0; i < 3; i++) {
    const lm = material(0x0b1715, 0.1, 0.3);
    const m = cylinder(p.root, 0.066, 0.055, lm, 0.61, 0.36 + i * 0.18, 0.31);
    if (i === 0) {
      p.led = m;
      lm.emissive = new T.Color(0x00ff69);
      lm.emissiveIntensity = 0;
    }
  }
  finishPart(p);
  return p;
}
export function makeHarness(type, position, spare = false) {
  const p = addPart(type, spare);
  p.root.position.copy(position);
  if (type === "upper") {
    makePort(p, "orange", p.id + "-orange", V(-1, 0.95, 0), Q(0, 0.4, Math.PI / 2), p.root);
    makePort(p, "up4", p.id + "-up4", V(1, 0.62, 0), Q(0, 0, Math.PI / 2), p.root);
  } else {
    makePort(p, "low4", p.id + "-low4", V(-1, 0.62, 0), Q(0, Math.PI, Math.PI / 2), p.root);
    makePort(p, "circular", p.id + "-circular", V(1, 0.7, 0), Q(0, 0, Math.PI / 2), p.root);
  }
  p.cableGroup = new T.Group();
  p.root.add(p.cableGroup);
  updateCable(p);
  finishPart(p);
  return p;
}
