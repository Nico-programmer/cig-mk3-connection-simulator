// Builders for the MK3 screen, Expansion Module and both harnesses.
import * as T from "three";
import { box, cylinder, label, makePort, material, palette } from "../geometry.js";
import { updateCable } from "./cables.js";
import { MK3_SCALE, MK3_SCREEN, mk3 } from "./model-mk3.js";
import { em3d } from "./model-em.js";
import { CONNECTOR_DEPTH_SCALE, CONNECTOR_MODEL, CONNECTOR_SCALE, conn12 } from "./model-connector.js";

// Realistic 12-pin connector: where its face sits in its own frame (the mating distance is measured to it) and how
// far behind the MK3 port origin that face ends up: just above the floor of the recess (measured: floor -0.125,
// back plate -0.03, side ears +0.14), so the plug is seated in it and no gap shows.
const CONNECTOR_FACE = 0.19,
  CONNECTOR_SEAT = -0.1;
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
  const hull = box(p.root, 3.15, 2.12, 0.52, palette.dark, 0, 1.15, 0);
  const front = box(p.root, 3.02, 1.98, 0.06, 0x131b22, 0, 1.15, 0.29);
  const back = box(p.root, 3.1, 2.02, 0.07, palette.metal, 0, 1.15, -0.295);
  const screws = [];
  for (const x of [-1.37, 1.37])
    for (const y of [0.32, 1.99]) screws.push(cylinder(p.root, 0.045, 0.02, 0x89949d, x, y, 0.331));
  // The realistic model uses an 800x480 screen (the login image's size).
  const real = !!mk3.body;
  p.realistic = real;
  const c = document.createElement("canvas");
  c.width = real ? 800 : 768;
  c.height = real ? 480 : 440;
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
  const fleet = label(p.root, "FLEET iQ360", 1, 0.15, V(0, 0.27, 0.336), {
    bg: "#131b22",
    fg: "#aebbc4",
    size: 30,
    height: 64,
  });
  const port = makePort(p, "screen", p.id + "-main", V(0.4, 0.86, -0.6), Q(0, Math.PI, 0), p.root);
  const cam = cylinder(p.root, 0.25, 0.14, palette.dark, -1, 0.8, -0.4);
  cam.userData.tooltip = () => tr("cámara · sin función", "camera · no function");
  const camPins = [];
  for (let i = 0; i < 6; i++)
    camPins.push(
      cylinder(
        p.root,
        0.025,
        0.07,
        palette.gold,
        -1 + Math.cos((i * Math.PI) / 3) * 0.13,
        0.8 + Math.sin((i * Math.PI) / 3) * 0.13,
        -0.51,
      ),
    );
  const cameraLabel = label(p.root, tr("cámara", "camera"), 0.7, 0.14, V(-1, 0.36, -0.345), {
    bg: "#aab6bf",
    fg: "#17222b",
    size: 27,
    height: 64,
  });
  cameraLabel.rotation.y = Math.PI;
  p.cameraLabel = cameraLabel;
  const feet = [];
  for (const x of [-1.1, 1.1]) {
    feet.push(box(p.root, 0.25, 0.22, 0.8, palette.dark, x, 0.04, 0.08));
  }
  if (real) dressRealistic(p, { hull, port, cam, camPins, hidden: [hull, front, back, ...feet, ...screws, display, fleet, cameraLabel, ...camPins] });
  finishPart(p);
  return p;
}
// Swaps the visible procedural body for the loaded model. Colliders, pins and ports stay the same
// procedural objects (the model has no usable pins); only their visuals are hidden or moved.
function dressRealistic(p, { hull, port, cam, camPins, hidden }) {
  for (const m of hidden) m.visible = false;
  hull.userData.solid.z = 0.515; // the model is 1.03 deep, the old body 0.52
  const model = mk3.body.clone(true);
  model.scale.setScalar(MK3_SCALE);
  model.rotation.y = Math.PI; // the model's screen faces -z, the simulator's faces +z
  model.position.set(0, 1.15, 0);
  p.root.add(model);
  const s = MK3_SCREEN;
  const screen = new T.Mesh(
    new T.PlaneGeometry(s.w, s.w / s.aspect),
    new T.MeshBasicMaterial({
      map: p.screenTexture,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  screen.position.set(s.x, s.y, s.z);
  screen.rotation.y = Math.PI;
  screen.raycast = () => {};
  model.add(screen);
  // 12-pin connector: centred on the recess in the rear photo (cara-mk3-pines.png) and flush with
  // the model's rear face (z = -0.512), as the procedural connector was with the old back plate.
  // The connector is not drawn, so the mating partner (the orange one) must end up touching the rear
  // face (z = -0.515). It is placed 0.4 outwards from this port and faces it, so its front is 0.19
  // from its origin: port z = -0.515 + 0.19 + 0.4 - 0.03 (clearance) = -0.32.
  // The MK3 port is drawn at the scale that gives it the same contact pitch as the connector that mates with it.
  const PORT_SCALE = conn12.body ? (CONNECTOR_MODEL.pitch * CONNECTOR_SCALE) / 0.215 : 0.6;
  port.group.scale.setScalar(PORT_SCALE);
  port.group.position.set(0.027, 0.96, -0.32);
  if (conn12.body) {
    port.mateOffset = CONNECTOR_FACE + CONNECTOR_SEAT; // seats the realistic connector in the recess (see align)
    // Same width and height as the connector that mates with it (this group is scaled by PORT_SCALE).
    const proxy = port.colliders[0];
    proxy.userData.solid.x = (CONNECTOR_MODEL.width * CONNECTOR_SCALE) / PORT_SCALE / 2;
    proxy.userData.solid.y = (CONNECTOR_MODEL.height * CONNECTOR_SCALE) / PORT_SCALE / 2;
  }
  // The 12-pin connector is not drawn: the photographed recess is used as is. Pins, ports and
  // colliders stay (invisible) so probes and mating keep working.
  port.group.traverse((m) => {
    if (m.isMesh) m.visible = false;
  });
  // Camera port: directly above it. Hidden, it keeps the tooltip and a smaller solid.
  cam.position.set(-0.008, 1.485, -0.5);
  // Thin along its axis: the taller realistic orange connector must not touch this invisible solid.
  cam.scale.set(0.5, 0.3, 0.5);
  cam.visible = false; // the model already has its own camera nut
  for (const m of camPins) m.position.add(V(0.992, 0.685, -0.1));
  // Hidden and with no function: they must not block the orange connector.
  for (const m of camPins) delete m.userData.solid;
}
export function makeEM(position, spare = false) {
  const p = addPart("em", spare);
  p.root.position.copy(position);
  const hull = box(p.root, 1.75, 2.48, 0.55, 0xbec9cb, 0, 1.25, 0);
  const plates = [];
  for (const y of [0.15, 2.36]) plates.push(box(p.root, 1.9, 0.23, 0.65, 0xcdd5d6, 0, y, 0));
  const names = [
    label(p.root, "Expansion Module", 1.54, 0.22, V(0, 2.08, 0.286), {
      bg: "#bec9cb",
      fg: "#26333b",
      size: 30,
    }),
    label(p.root, "FLEET iQ360", 1.3, 0.2, V(0, 1.82, 0.286), {
      bg: "#bec9cb",
      fg: "#26333b",
      size: 30,
    }),
  ];
  const port = makePort(p, "em", p.id + "-em", V(0, 1.13, 0.58), Q(), p.root);
  const leds = [];
  for (let i = 0; i < 3; i++) {
    const lm = material(0x0b1715, 0.1, 0.3);
    const m = cylinder(p.root, 0.066, 0.055, lm, 0.61, 0.36 + i * 0.18, 0.31);
    leds.push(m);
    if (i === 0) {
      p.led = m;
      lm.emissive = new T.Color(0x00ff69);
      lm.emissiveIntensity = 0;
    }
  }
  if (em3d.body) dressRealisticEM(p, { hull, plates, names, port, leds });
  finishPart(p);
  return p;
}
// Swaps the visible procedural body for the loaded model. Pins, port and the hull collider stay
// procedural (the model contacts are not the real layout); only their visuals are hidden or moved.
function dressRealisticEM(p, { hull, plates, names, port, leds }) {
  for (const m of [hull, ...plates, ...names, ...leds]) m.visible = false;
  for (const m of plates) delete m.userData.solid; // hidden: the model has no flanges that wide
  const model = em3d.body.clone(true);
  model.position.set(0, 1.25, 0);
  p.root.add(model);
  const size = em3d.box.getSize(new T.Vector3());
  // Collider: the shell (its front face is at the shell top), not the connector barrel.
  hull.userData.solid.set(size.x / 2, size.y / 2, 0.3);
  hull.userData.solidCenter = new T.Vector3(0, 0, -0.1);
  // The model's green LED drives the same material the procedural LED used.
  model.traverse((m) => {
    if (m.isMesh && /^15[ _]LED[ _]Green/.test(m.name)) {
      m.material = m.material.clone();
      m.material.emissive = new T.Color(0x00ff69);
      m.material.emissiveIntensity = 0;
      p.led = m;
    }
  });
  // Port: pins on the insulator face, scaled to sit inside the barrel. Only pins and their numbers are drawn.
  const PORT_SCALE = 0.4;
  port.group.scale.setScalar(PORT_SCALE);
  port.group.position.set(em3d.port.x, em3d.port.y + 1.25, em3d.port.z + 0.11 * PORT_SCALE);
  port.group.traverse((m) => {
    if (m.isMesh) m.visible = !!(m.userData.pin || m.userData.setText);
  });
}
// Swaps the visible procedural orange shell for the loaded 12-pin connector. The pins, their numbers,
// the port and its collider stay procedural: the pins are moved onto the model's contact grid.
function dressRealisticConnector(port) {
  const k = CONNECTOR_SCALE,
    FACE = CONNECTOR_FACE,
    kz = k * CONNECTOR_DEPTH_SCALE,
    BACK = FACE - CONNECTOR_MODEL.faceZ * kz; // the rubber boot, behind the shell
  const xPitch = (CONNECTOR_MODEL.pitch * k) / 0.215, // procedural pitch -> model pitch
    yRow = (CONNECTOR_MODEL.rowY * k) / 0.2;
  port.group.traverse((m) => {
    if (!m.isMesh || m.userData.colliderOnly) return;
    const isPin = !!m.userData.pin;
    if (isPin || m.userData.setText) {
      m.position.x *= xPitch;
      m.position.y *= yRow;
      if (m.userData.setText) m.position.z = FACE + 0.01; // numbers lie on the face
      else if (m.position.z > 0 && m.position.z < FACE) m.position.z = FACE - 0.07; // contacts sit inside the face
      else if (m.position.z < -0.2) m.position.z = BACK - 0.03; // rear access points, behind the boot
    }
    // Only the pin numbers stay drawn; the rest is the model.
    if (!m.userData.setText) m.visible = false;
  });
  const model = conn12.body.clone(true);
  model.scale.set(k, k, kz);
  model.position.set(0, 0, BACK);
  port.group.add(model);
  // The cable leaves the rear of the boot.
  port.rearZ = BACK;
  port.jacketZ = BACK - 0.32;
  // Collider: the shell only (the boot is a thin tube behind it), so the box hugs what is drawn.
  const depth = (CONNECTOR_MODEL.faceZ - CONNECTOR_MODEL.shellBackZ) * kz;
  const proxy = port.colliders[0];
  proxy.userData.solid.set((CONNECTOR_MODEL.width * k) / 2, (CONNECTOR_MODEL.height * k) / 2, depth / 2);
  proxy.position.set(0, 0, FACE - depth / 2);
}
export function makeHarness(type, position, spare = false) {
  const p = addPart(type, spare);
  p.root.position.copy(position);
  if (type === "upper") {
    const orange = makePort(p, "orange", p.id + "-orange", V(-1, 0.95, 0), Q(0, 0.4, Math.PI / 2), p.root);
    if (conn12.body) dressRealisticConnector(orange);
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
