// Camera focus animation and camera collision guard.
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
export function startCamera(position, target) {
  S.cameraMotion = {
    from: camera.position.clone(),
    to: position,
    startTarget: controls.target.clone(),
    target,
    start: performance.now(),
    duration: 420,
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
export function ejectCamera(position) {
  let safe = position.clone();
  for (let pass = 0; pass < 20 && !cameraSafe(safe); pass++) {
    safe.y = Math.max(0.45, safe.y);
    let moved = false;
    for (const m of S.allColliders) {
      const obb = colliderOf(m);
      if (!obb.intersectsSphere(new T.Sphere(safe, 0.38))) continue;
      const inv = obb.rotation.clone().transpose(),
        local = safe.clone().sub(obb.center).applyMatrix3(inv),
        half = obb.halfSize.clone().addScalar(0.4);
      let axis = "x",
        dist = Infinity;
      for (const key of ["x", "y", "z"]) {
        const d = half[key] - Math.abs(local[key]);
        if (d < dist) {
          dist = d;
          axis = key;
        }
      }
      local[axis] = (local[axis] >= 0 ? 1 : -1) * half[axis];
      safe.copy(local.applyMatrix3(obb.rotation).add(obb.center));
      moved = true;
    }
    if (!moved) break;
  }
  if (!cameraSafe(safe)) safe.set(12, 13, 22);
  return safe;
}
export function guardCamera() {
  const desired = camera.position.clone(),
    from = cameraSafe(lastCamera) ? lastCamera.clone() : ejectCamera(lastCamera),
    distance = desired.distanceTo(from);
  const steps = Math.max(1, Math.ceil(distance / 0.08));
  let safe = from.clone();
  for (let i = 1; i <= steps; i++) {
    const candidate = from.clone().lerp(desired, i / steps);
    if (!cameraSafe(candidate)) {
      S.cameraMotion = null;
      break;
    }
    safe.copy(candidate);
  }
  camera.position.copy(safe);
  lastCamera.copy(safe);
  camera.lookAt(controls.target);
}
