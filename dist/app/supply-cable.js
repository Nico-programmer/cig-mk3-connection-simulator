// Supply cable (1.22): key -> cable -> upper harness -> screen. It is only drawn: the circuit already takes the supply
// at the white 4-pin connector of the upper harness that feeds the screen, with the key as the supply switch.
//
// It is laid tidily, as straight runs taped to the table (like the relay bypass cables): a short free cable from the
// key box to the first corner, the taped run round the outside of the bypass connectors and the MK3, and a short
// free cable from the end of the run to a branch behind the harness's white 4-pin connector, so the last bit follows
// the harness when it is moved. None of its cables is an obstacle to the others: it lies over them.
import * as T from "three";
import { material } from "../geometry.js";
import { keyGroup } from "./bench.js";
import { Rope, groundAt } from "./rope.js";
import { workParts } from "./scenario.js";
import { scene } from "./scene.js";
import { S } from "./state.js";
import { V } from "./util.js";

const RADIUS = 0.06,
  BLACK = 0x10191e,
  TAPE_Y = groundAt() + RADIUS;
// Corners of the taped run (world x, z), traced on the user's capture: from the key box out to the left, down the
// outside of the vehicle cables' anchors (x = -10.7), then across behind the screen towards the harness.
const ROUTE = [
  [-11.0, 3.6],
  [-11.7, 3.4],
  [-12.0, -0.6],
  [-0.4, -2.4],
].map(([x, z]) => V(x, TAPE_Y, z));

let ropes = null;

// The upper harness that carries the supply: the last one that was plugged in, else the work one.
function feeder() {
  return S.circuit?.powerUpper ?? workParts[1] ?? null;
}
// Out of the left edge of the key box (its local x is the world x), at mid height.
function keyEnd() {
  keyGroup.updateWorldMatrix(true, false);
  return { point: keyGroup.localToWorld(V(-0.8, 0.1, 0)), dir: V(-1, 0, 0) };
}
// Branch behind the white 4-pin connector of the harness, dropping straight down so that the cable
// reaches the table behind the connector and never has to wrap around it.
function harnessBranch(upper) {
  const port = upper.ports.find((p) => p.kind === "up4");
  port.group.updateWorldMatrix(true, false);
  const behind = port.group.localToWorld(V(0, 0, (port.jacketZ ?? -0.62) - 0.12)),
    side = V(1, 0, 0).applyQuaternion(port.group.getWorldQuaternion(new T.Quaternion())).setY(0).normalize();
  // Clear of the harness jacket (their radii add up to 0.146): lower and to the side, or the two cables keep
  // pushing each other and never go to sleep.
  return { point: behind.addScaledVector(side, 0.1).add(V(0, -0.25, 0)), dir: V(0, -1, 0) };
}
function makeRope(count, getEnds, lengthFor) {
  const rope = new Rope({ count, radius: RADIUS, color: BLACK, getEnds, lengthFor, maxLength: 20, floorLayout: true, passive: true });
  scene.add(rope.mesh);
  return rope;
}
// The taped run: a straight tube per segment and a ball at each corner.
function tapeRun() {
  const mat = material(BLACK);
  for (let i = 1; i < ROUTE.length; i++) {
    const tube = new T.Mesh(new T.TubeGeometry(new T.LineCurve3(ROUTE[i - 1], ROUTE[i]), 64, RADIUS, 8, false), mat);
    tube.castShadow = true;
    tube.raycast = () => {};
    scene.add(tube);
  }
  for (let i = 1; i < ROUTE.length - 1; i++) {
    const ball = new T.Mesh(new T.SphereGeometry(RADIUS, 12, 8), mat);
    ball.position.copy(ROUTE[i]);
    ball.castShadow = true;
    ball.raycast = () => {};
    scene.add(ball);
  }
}
function ensure() {
  if (!feeder()) return false;
  if (ropes) return true;
  const first = ROUTE[0],
    last = ROUTE[ROUTE.length - 1],
    // Direction into the rope at the clip where the free cable meets the run.
    awayFirst = first.clone().sub(ROUTE[1]).setY(0).normalize(),
    alongLast = last.clone().sub(ROUTE[ROUTE.length - 2]).setY(0).normalize();
  tapeRun();
  ropes = [
    makeRope(
      12,
      () => {
        const a = keyEnd();
        return { a: a.point, aDir: a.dir, b: first.clone(), bDir: awayFirst };
      },
      (d) => Math.min(6, Math.max(1.2, d * 1.06 + 0.3)),
    ),
    makeRope(
      16,
      () => {
        const b = harnessBranch(feeder());
        return { a: last.clone(), aDir: alongLast, b: b.point, bDir: b.dir };
      },
      (d) => Math.min(8, Math.max(1.2, d * 1.06 + 0.3)),
    ),
  ];
  return true;
}
export const supplyRopes = () => ropes ?? [];
// Called after anything moves: wake the cables so they follow.
export function updateSupplyCable() {
  if (ensure()) for (const r of ropes) r.wake();
}
// Called every frame by the animation loop.
export function updateSupplyRope(dt) {
  if (ensure()) for (const r of ropes) r.update(dt);
}
