// Camera focus animation and the spring-arm camera that keeps the view outside solids.
import * as T from "three";
import { cachedCollider as colliderOf } from "../drag-performance.js";
import { camera, controls, lastCamera } from "./scene.js";
import { S } from "./state.js";

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

// ---- Free flight (W/A/S/D move, Q down, E up) ----
// Moves camera and orbit target together, so the mouse keeps orbiting around the new point.
// The camera is kept inside FLY_LIMITS; the camera guard still keeps the camera out of solids.
export const FLY_SPEED = 9; // units per second
export const FLY_LIMITS = { x: 28, z: 28, yMin: -0.1, yMax: 18 };
// While a key is held the heading is locked (taken when the first key goes down) and the
// mouse looks around from where the camera is: the camera does not orbit away from its path.
const flyKeys = new Set();
const FLY_CODES = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"];
let flyHeading = null; // unit vector on the horizontal plane
let flyAnchor = null; // camera position this frame, restored after the orbit controls
window.addEventListener("keydown", (e) => {
  if (!FLY_CODES.includes(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  flyKeys.add(e.code);
});
window.addEventListener("keyup", (e) => {
  flyKeys.delete(e.code);
  if (!flyKeys.size) flyHeading = null;
});
window.addEventListener("blur", () => {
  flyKeys.clear();
  flyHeading = null;
});

export function flyCamera(dt) {
  flyAnchor = null;
  if (!flyKeys.size || S.cameraMotion) return;
  if (!flyHeading) {
    flyHeading = controls.target.clone().sub(camera.position);
    flyHeading.y = 0;
    if (flyHeading.lengthSq() < 1e-8) flyHeading.set(0, 0, -1);
    flyHeading.normalize();
  }
  const forward = flyHeading;
  const right = new T.Vector3().crossVectors(forward, new T.Vector3(0, 1, 0));
  const move = new T.Vector3();
  if (flyKeys.has("KeyW")) move.add(forward);
  if (flyKeys.has("KeyS")) move.sub(forward);
  if (flyKeys.has("KeyD")) move.add(right);
  if (flyKeys.has("KeyA")) move.sub(right);
  if (flyKeys.has("KeyE")) move.y += 1;
  if (flyKeys.has("KeyQ")) move.y -= 1;
  if (move.lengthSq() === 0) return;
  move.normalize().multiplyScalar(FLY_SPEED * Math.min(dt, 1 / 20));
  const next = camera.position.clone().add(move);
  next.x = Math.max(-FLY_LIMITS.x, Math.min(FLY_LIMITS.x, next.x));
  next.z = Math.max(-FLY_LIMITS.z, Math.min(FLY_LIMITS.z, next.z));
  next.y = Math.max(FLY_LIMITS.yMin, Math.min(FLY_LIMITS.yMax, next.y));
  const applied = next.sub(camera.position);
  controls.target.add(applied);
  camera.position.add(applied);
  flyAnchor = camera.position.clone();
  S.returnView = null;
}

// Call right after controls.update(): the orbit moved the camera around the target; put the
// camera back on its path and carry the target along, so the mouse only changes where it looks.
export function holdFlyPosition() {
  if (!flyAnchor) return;
  controls.target.add(flyAnchor.clone().sub(camera.position));
  camera.position.copy(flyAnchor);
  camera.lookAt(controls.target);
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
