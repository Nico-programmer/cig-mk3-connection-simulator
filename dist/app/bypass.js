// Relay-1 bypass connectors and their cables (cables rebuilt as physical ropes in 1.18).
import * as T from "three";
import { box, material } from "../geometry.js";
import { attach } from "./connection.js";
import { workParts } from "./scenario.js";
import { dynamic, scene } from "./scene.js";
import { forward, setWorldPosition, setWorldQuaternion, worldPos, worldQ } from "./spatial.js";
import { Q, V } from "./util.js";
import { Rope, groundAt } from "./rope.js";
import { S } from "./state.js";

export function buildBypass() {
  S.bypassPorts = [];
  const bp = {
    id: "bypass",
    type: "bypass",
    root: new T.Group(),
    ports: [],
    fault: null,
  };
  dynamic.add(bp.root);
  bp.root.userData.part = bp;
  for (let i = 0; i < 4; i++) {
    const kind = ["vehicleA", "relayA", "vehicleB", "relayB"][i],
      g = new T.Group();
    g.position.set(-9 + (i % 2) * 0.43, 0.5, -0.2 + Math.floor(i / 2) * 1.1);
    g.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
    bp.root.add(g);
    const p = {
      id: kind,
      kind,
      part: bp,
      group: g,
      pins: [],
      colliders: [],
    };
    g.userData.port = p;
    box(g, 0.32, 0.32, 0.47, i % 2 ? 0x3288aa : 0x3881ad, 0, 0, -0.1);
    const latch = box(g, 0.18, 0.07, 0.21, 0x7db9d0, 0, 0.185, -0.08);
    latch.userData.latch = p;
    g.traverse((m) => {
      if (m.isMesh) m.userData.port = p;
      if (m.userData.solid) p.colliders.push(m);
    });
    bp.ports.push(p);
    S.bypassPorts.push(p);
  }
  alignBypass(S.bypassPorts[0], S.bypassPorts[1]);
  alignBypass(S.bypassPorts[2], S.bypassPorts[3]);
  attach(S.bypassPorts[0], S.bypassPorts[1]);
  attach(S.bypassPorts[2], S.bypassPorts[3]);
  updateBypassCables();
}
export function alignBypass(a, b) {
  setWorldQuaternion(a.group, worldQ(b).multiply(Q(0, Math.PI, 0)));
  setWorldPosition(a.group, worldPos(b).addScaledVector(forward(b), 0.14));
}
// ---- Bypass cables (1.18): physical ropes, never through a connector ----
// Relay-1 pair (relayA black, relayB black/white): from the back of each relay connector the
// cable runs to a clip on the front edge of the table, is taped along that edge, and from a
// second clip it reaches the lower harness, branching out *behind* its circular connector
// next to the harness jacket. Vehicle pair (vehicleA, vehicleB): from the back of each
// connector to the vehicle harness leaving at the table edge.
const RADIUS = 0.045,
  BLACK = 0x10191e,
  TAPE_Y = groundAt() + RADIUS;
let stripeMaterial = null;
// Black cable with a white stripe along its length (UV u runs along the cable, v around it).
function striped() {
  if (stripeMaterial) return stripeMaterial;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#10191e";
  ctx.fillRect(0, 0, 4, 64);
  ctx.fillStyle = "#d8dcde";
  ctx.fillRect(0, 26, 4, 12);
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  stripeMaterial = material(0xffffff);
  stripeMaterial.map = map;
  return stripeMaterial;
}
const clips = (i) => ({
  a: V(-7, TAPE_Y, 4.1 + i * 0.18),
  b: V(3, TAPE_Y, 4.1 + i * 0.18),
});
// Back of a bypass connector (just inside its shell, so the cable emerges from the back face).
function connectorEnd(port) {
  port.group.updateWorldMatrix(true, false);
  return {
    point: port.group.localToWorld(V(0, 0, -0.25)),
    dir: V(0, 0, -1).applyQuaternion(port.group.getWorldQuaternion(new T.Quaternion())),
  };
}
// Branch point of a relay wire: out of the harness jacket behind the lower harness's circular
// connector, dropping straight down, so the wire reaches the table behind the connector and
// never has to wrap around it.
function harnessBranch(i) {
  const port = workParts[2]?.ports[1];
  port.group.updateWorldMatrix(true, false);
  const behind = port.group.localToWorld(V(0, 0, -0.78)),
    side = V(1, 0, 0).applyQuaternion(port.group.getWorldQuaternion(new T.Quaternion())).setY(0).normalize();
  return { point: behind.addScaledVector(side, i === 1 ? -0.07 : 0.07).add(V(0, -0.12, 0)), dir: V(0, -1, 0) };
}
// Thin cables: little slack, so short runs do not curl up into small loops.
const slack = (extra, max) => (d) => Math.min(max, Math.max(1.2, d * 1.06 + extra));
export const bypassRopes = [];
const tapes = [];
function rope(getEnds, lengthFor, stripe, maxLength) {
  const r = new Rope({ count: 32, radius: RADIUS, color: BLACK, getEnds, lengthFor, maxLength });
  if (stripe) r.mesh.material = striped();
  scene.add(r.mesh);
  bypassRopes.push(r);
  return r;
}
function ensureBypassCables() {
  if (bypassRopes.length) return;
  for (let i = 0; i < 4; i++) {
    const stripe = i === 3,
      port = () => S.bypassPorts[i];
    if (i % 2) {
      const { a, b } = clips(i);
      rope(() => {
        const e = connectorEnd(port());
        return { a: e.point, aDir: e.dir, b: a.clone(), bDir: V(-1, 0, 0) };
      }, slack(0.3, 16), stripe, 16);
      // taped section along the front edge of the table
      const tape = new T.Mesh(new T.TubeGeometry(new T.LineCurve3(a, b), 64, RADIUS, 8, false), stripe ? striped() : material(BLACK));
      tape.castShadow = true;
      tape.raycast = () => {};
      scene.add(tape);
      tapes.push(tape);
      rope(() => {
        const e = harnessBranch(i);
        return { a: b.clone(), aDir: V(1, 0, 0), b: e.point, bDir: e.dir };
      }, (d) => Math.min(20, Math.max(1.5, d * 1.12 + 0.6)), stripe, 20);
    } else {
      const anchor = V(-10.7, TAPE_Y, i < 2 ? -0.4 : 0.8);
      rope(() => {
        const e = connectorEnd(port());
        return { a: e.point, aDir: e.dir, b: anchor.clone(), bDir: V(1, 0, 0) };
      }, slack(0.25, 6), false, 6);
    }
  }
}
// Called after anything moves: wake the bypass cables so they follow.
export function updateBypassCables() {
  if (!S.bypassPorts.length || !workParts[2]) return;
  ensureBypassCables();
  for (const r of bypassRopes) r.wake();
}
// Called every frame by the animation loop.
export function updateBypassRopes(dt) {
  if (!S.bypassPorts.length || !workParts[2]) return;
  ensureBypassCables();
  for (const r of bypassRopes) r.update(dt);
}
