// Camera focus animation and the spring-arm camera that keeps the view outside solids.
import * as T from "three";
import { cachedCollider as colliderOf } from "../drag-performance.js";
import { availablePorts, eligibleMate } from "./connection.js";
import { selectedPorts } from "./movement.js";
import { camera, controls, lastCamera } from "./scene.js";
import { forward, worldPos } from "./spatial.js";
import { V } from "./util.js";
import { S } from "./state.js";

export function considerFocus() {
  if (!S.selected) return;
  let nearest = null,
    min = 2.0;
  for (const p of selectedPorts(S.selected))
    for (const q of availablePorts()) {
      if (p.joint?.secured) continue;
      if (!eligibleMate(p, q) && p.mate !== q) continue;
      const d = worldPos(p).distanceTo(worldPos(q));
      if (d < min) {
        min = d;
        nearest = q;
      }
    }
  if (nearest && S.focus !== nearest) {
    if (!S.returnView)
      S.returnView = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };
    S.focus = nearest;
    const target = worldPos(nearest),
      normal = forward(nearest);
    const pos = target
      .clone()
      .addScaledVector(normal, 4.2)
      .add(V(0, 1.9, 0));
    if (pos.y < 1.1) pos.y = 1.1;
    startCamera(pos, target);
  } else if (!nearest && S.focus && min === 2.0) restoreCamera();
}
// Length of every camera transition: focus on a connector, return with Esc, view display.
export const CAMERA_TRANSITION_MS = 1000;
export function startCamera(position, target) {
  S.cameraMotion = {
    from: camera.position.clone(),
    to: position,
    startTarget: controls.target.clone(),
    target,
    start: performance.now(),
    duration: CAMERA_TRANSITION_MS,
  };
}
export function restoreCamera() {
  if (S.returnView) {
    startCamera(S.returnView.position, S.returnView.target);
    S.returnView = null;
  }
  S.focus = null;
}
export function cameraSafe(position) {
  const sphere = new T.Sphere(position, 0.38);
  if (position.y < 0.25) return false;
  for (const m of S.allColliders) {
    const obb = colliderOf(m);
    if (obb.intersectsSphere(sphere)) return false;
  }
  return true;
}
// ---- Camera guard (1.15) ----
// The orbit controls own the *desired* camera position. The rendered camera goes exactly
// there unless that point is inside a solid (each solid widened by the camera radius);
// then it slides along the line towards the orbit target until it is just outside.
// Solids merely hiding the target do not move the camera. One ray per frame, no stepping,
// no stored state besides the desired position, no teleport.
export const ARM_RADIUS = 0.38,
  ARM_MARGIN = 0.03,
  ARM_MIN_Y = 0.25;
let arm = null; // { desired, placed }

// Call before controls.update(): gives the controls back the unobstructed position so the
// zoom distance never drifts. If anything else moved the camera meanwhile, start over.
export function restoreCameraDesired() {
  if (arm && camera.position.equals(arm.placed)) camera.position.copy(arm.desired);
  else arm = null;
}

// Interval [enter, exit] of the ray inside the OBB widened by `pad` on every axis (a box
// slightly larger than the true sphere sweep at its corners), or null. Used as a bracket.
function boxInterval(origin, dir, obb, pad) {
  const inverse = obb.rotation.clone().transpose(),
    o = origin.clone().sub(obb.center).applyMatrix3(inverse),
    d = dir.clone().applyMatrix3(inverse);
  let enter = -Infinity,
    exit = Infinity;
  for (const axis of ["x", "y", "z"]) {
    const size = obb.halfSize[axis] + pad;
    if (Math.abs(d[axis]) < 1e-12) {
      if (Math.abs(o[axis]) > size) return null;
      continue;
    }
    let t0 = (-size - o[axis]) / d[axis],
      t1 = (size - o[axis]) / d[axis];
    if (t0 > t1) [t0, t1] = [t1, t0];
    enter = Math.max(enter, t0);
    exit = Math.min(exit, t1);
    if (enter > exit) return null;
  }
  return exit > 0 ? [enter, exit] : null;
}
// Exact interval of the ray where a sphere of radius `pad` touches the OBB, or null.
// Distance to a box is convex along a line, so the touching set is one interval.
function rayInterval(origin, dir, obb, pad) {
  const bracket = boxInterval(origin, dir, obb, pad);
  if (!bracket) return null;
  const inverse = obb.rotation.clone().transpose(),
    o = origin.clone().sub(obb.center).applyMatrix3(inverse),
    d = dir.clone().applyMatrix3(inverse),
    h = obb.halfSize,
    excess = (t) => {
      const x = Math.max(Math.abs(o.x + d.x * t) - h.x, 0),
        y = Math.max(Math.abs(o.y + d.y * t) - h.y, 0),
        z = Math.max(Math.abs(o.z + d.z * t) - h.z, 0);
      return Math.sqrt(x * x + y * y + z * z) - pad;
    };
  let [lo, hi] = bracket;
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3,
      m2 = hi - (hi - lo) / 3;
    if (excess(m1) < excess(m2)) hi = m2;
    else lo = m1;
  }
  const deepest = (lo + hi) / 2;
  if (excess(deepest) > 0) return null;
  const crossing = (a, b) => {
    // excess(a) > 0 >= excess(b) or the reverse; returns the boundary
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (excess(m) > 0 === excess(a) > 0) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const enter = excess(bracket[0]) > 0 ? crossing(bracket[0], deepest) : bracket[0],
    exit = excess(bracket[1]) > 0 ? crossing(bracket[1], deepest) : bracket[1];
  return exit > 0 ? [enter, exit] : null;
}

// Distance along `dir` (from `target`) where the camera goes when it asks for `length`.
export function armLength(target, dir, length) {
  const spans = [];
  for (const m of S.allColliders) {
    const span = rayInterval(target, dir, colliderOf(m), ARM_RADIUS);
    if (span) spans.push(span);
  }
  // Blocked stretches of the line; gaps too narrow for the camera count as blocked.
  spans.sort((p, q) => p[0] - q[0]);
  const blocked = [];
  for (const [enter, exit] of spans) {
    const last = blocked.at(-1);
    if (last && enter <= last[1] + 2 * ARM_MARGIN) last[1] = Math.max(last[1], exit);
    else blocked.push([enter, exit]);
  }
  for (const [enter, exit] of blocked)
    if (enter - ARM_MARGIN < length && length < exit + ARM_MARGIN)
      return enter - ARM_MARGIN > 0 ? enter - ARM_MARGIN : exit + ARM_MARGIN;
  return length;
}

export function guardCamera() {
  const target = controls.target,
    desired = camera.position.clone(),
    offset = desired.clone().sub(target),
    length = offset.length();
  if (length < 1e-6) return;
  const dir = offset.divideScalar(length),
    placed = target.clone().addScaledVector(dir, armLength(target, dir, length));
  if (placed.y < ARM_MIN_Y) placed.y = ARM_MIN_Y;
  camera.position.copy(placed);
  lastCamera.copy(placed);
  camera.lookAt(target);
  arm = { desired, placed: placed.clone() };
}
