// Supply cable (1.22): key -> cable -> upper harness -> screen. Two pieces:
//  - the fixed part, here: a short free cable from the key box to the start of a cable duct, the taped run inside the
//    duct (only the duct is seen) and the open end of the duct;
//  - the part with the plug (parts.js: makeSupplyCable): the cable from the exit of the duct to the plug that goes
//    into the jack of the upper harness. It can be unplugged, so the harness can be replaced without taking the cable
//    with it, and the circuit only has the supply while it is plugged (electrical.js: Circuit.supplied).
import * as T from "three";
import { material } from "../geometry.js";
import { keyGroup } from "./bench.js";
import { ensureDucts } from "./cable-duct.js";
import { Rope } from "./rope.js";
import { workParts } from "./scenario.js";
import { scene } from "./scene.js";
import { SUPPLY_ROUTE } from "./supply-route.js";
import { V } from "./util.js";

const RADIUS = 0.06,
  BLACK = 0x10191e;
let rope = null;

// Out of the right edge of the key box (its local x is the world x), at mid height.
function keyEnd() {
  keyGroup.updateWorldMatrix(true, false);
  return { point: keyGroup.localToWorld(V(0.8, 0.1, 0)), dir: V(1, 0, 0) };
}
// The taped run: a straight tube per segment and a ball at each corner (all of it inside the duct).
function tapeRun() {
  const mat = material(BLACK);
  for (let i = 1; i < SUPPLY_ROUTE.length; i++) {
    const tube = new T.Mesh(new T.TubeGeometry(new T.LineCurve3(SUPPLY_ROUTE[i - 1], SUPPLY_ROUTE[i]), 64, RADIUS, 8, false), mat);
    tube.castShadow = true;
    tube.raycast = () => {};
    scene.add(tube);
  }
  for (let i = 1; i < SUPPLY_ROUTE.length - 1; i++) {
    const ball = new T.Mesh(new T.SphereGeometry(RADIUS, 12, 8), mat);
    ball.position.copy(SUPPLY_ROUTE[i]);
    ball.castShadow = true;
    ball.raycast = () => {};
    scene.add(ball);
  }
}
function ensure() {
  if (!workParts[1]) return false;
  if (rope) return true;
  const first = SUPPLY_ROUTE[0],
    awayFirst = first.clone().sub(SUPPLY_ROUTE[1]).setY(0).normalize();
  tapeRun();
  // The taped runs are hidden by cable ducts: this cable's own run and the relay bypass pair's (bypass.js: the two
  // runs from x = -7 to 3 along the front edge, z = 4.28 and 4.64).
  ensureDucts(
    SUPPLY_ROUTE.map((p) => ({ x: p.x, z: p.z })),
    [Object.assign([{ x: -7.15, z: 4.46 }, { x: 3.15, z: 4.46 }], { width: 0.56 })],
  );
  rope = new Rope({
    count: 12,
    radius: RADIUS,
    color: BLACK,
    getEnds: () => {
      const a = keyEnd();
      return { a: a.point, aDir: a.dir, b: first.clone(), bDir: awayFirst };
    },
    lengthFor: (d) => Math.min(8, Math.max(1.2, d * 1.06 + 0.3)),
    maxLength: 20,
    floorLayout: true,
    passive: true, // it lies over the other cables; they do not move for it
  });
  scene.add(rope.mesh);
  return true;
}
export const supplyRope = () => rope;
// Called after anything moves: wake the cable so it follows.
export function updateSupplyCable() {
  if (ensure()) rope.wakeIfMoved();
}
// Called every frame by the animation loop.
export function updateSupplyRope(dt) {
  if (ensure()) rope.update(dt);
}
