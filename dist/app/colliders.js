// Collision volumes and collision queries for parts, cables and probes.
import * as T from "three";
import { bounds, cachedCollider as colliderOf, colliderGrid } from "../drag-performance.js";
import { keyGroup, meter } from "./bench.js";
import { bypassCables } from "./bypass.js";
import { selectedPorts } from "./movement.js";
import { probeGroup, probeTools } from "./probe-tools.js";
import { camera, dynamic } from "./scene.js";
import { ancestorData, isDescendant } from "./spatial.js";
import { V } from "./util.js";
import { S } from "./state.js";

export function refreshColliders() {
  S.allColliders = [];
  S.pinPicks = [];
  for (const root of [dynamic, keyGroup, meter, probeGroup])
    root.traverse((m) => {
      if (m.userData.solid) S.allColliders.push(m);
      if (m.userData.pin) S.pinPicks.push(m);
    });
  for (const mesh of bypassCables)
    mesh.traverse((m) => {
      if (m.userData.solid) S.allColliders.push(m);
    });
}
export function cableVolumes(mesh, owner) {
  const curve = mesh.userData.cableCurve;
  if (!curve) return;
  const radius = mesh.userData.cableRadius,
    segments = Math.max(32, Math.ceil(curve.getLength() / 0.08));
  while (mesh.children.length > segments) mesh.remove(mesh.children.at(-1));
  for (let i = 0; i < segments; i++) {
    const a = curve.getPointAt(i / segments),
      b = curve.getPointAt((i + 1) / segments),
      mid = curve.getPointAt((i + 0.5) / segments),
      pad = radius + mid.distanceTo(a.clone().lerp(b, 0.5)) + 0.002;
    let proxy = mesh.children[i];
    if (!proxy) {
      proxy = new T.Object3D();
      mesh.add(proxy);
    }
    proxy.position.copy(a).lerp(b, 0.5);
    proxy.quaternion.setFromUnitVectors(V(0, 0, 1), b.clone().sub(a).normalize());
    if (!proxy.userData.solid) proxy.userData.solid = V();
    proxy.userData.solid.set(pad, pad, a.distanceTo(b) / 2 + pad);
    proxy.userData.cableOwner = owner;
    proxy.userData.colliderOnly = true;
  }
}

// Physical instruments and documented notices are part of the bench, not side panels.
export function collisionContext(entity, sel) {
  const exemptions = new Set();
  for (const p of selectedPorts(sel)) if (p.mate) p.mate.colliders.forEach((m) => exemptions.add(m));
  const other = S.allColliders
    .filter(
      (m) =>
        !isDescendant(m, entity) &&
        !exemptions.has(m) &&
        m.userData.cableOwner !== sel.part &&
        ancestorData(m, "bypassPort") !== sel.port,
    )
    .map((m) => ({
      m,
      obb: colliderOf(m),
    }));
  return {
    grid: colliderGrid(other),
  };
}
export function exemptPair(m, n, sel) {
  return (
    (m.userData.cableOwner === sel.part &&
      (isDescendant(n, sel.part.root) || sel.part.ports.some((p) => p.mate?.colliders.includes(n)))) ||
    (sel.part.type === "lower" &&
      (m.userData.cableOwner === sel.part || m.userData.port?.kind === "circular") &&
      n.userData.cableOwner === "bypass") ||
    (n.userData.probeTip && probeTools[n.userData.probeIndex - 1].contact?.port === m.userData.port)
  );
}
export function collision(entity, sel, context = null) {
  entity.updateWorldMatrix(true, true);
  const own = S.allColliders.filter((m) => isDescendant(m, entity) || m.userData.cableOwner === sel.part),
    grid = (context || collisionContext(entity, sel)).grid;
  for (const m of own) {
    const a = colliderOf(m);
    if (a.intersectsSphere(new T.Sphere(camera.position, 0.38))) return true;
    const axes = a.rotation.elements,
      yextent =
        Math.abs(axes[1]) * a.halfSize.x +
        Math.abs(axes[4]) * a.halfSize.y +
        Math.abs(axes[7]) * a.halfSize.z;
    if (a.center.y - yextent < -0.115) return true;
    for (const { m: n, obb: b } of grid.query(bounds(a))) {
      if (exemptPair(m, n, sel)) continue;
      if (a.intersectsOBB(b, 1e-5)) return true;
    }
  }
  return false;
}
// One step is safe only if the entire swept bounds are clear. Close to anything,
// retain v12's .025 increments. Deforming harnesses also retain the fine sweep.
// One step is safe only if the entire swept bounds are clear. Close to anything,
// retain v12's .025 increments. Deforming harnesses also retain the fine sweep.
export function clearTranslation(entity, sel, delta, context) {
  if (sel.part.cableGroup && entity !== sel.part.root) return false;
  const cameraBox = new T.Box3().setFromCenterAndSize(camera.position, V(0.76, 0.76, 0.76));
  for (const m of S.allColliders.filter(
    (m) => isDescendant(m, entity) || m.userData.cableOwner === sel.part,
  )) {
    const box = bounds(colliderOf(m)),
      end = box.clone().translate(delta);
    box.union(end);
    if (box.min.y < -0.115 || box.intersectsBox(cameraBox)) return false;
    for (const { m: n } of context.grid.query(box)) if (!exemptPair(m, n, sel)) return false;
  }
  return true;
}
