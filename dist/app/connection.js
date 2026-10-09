// Mating rules: compatibility, alignment, attach/detach, connect/disconnect buttons, thread.
import * as T from "three";
import { compatible } from "../electrical.js";
import { refreshCables, updateCable } from "./cables.js";
import { collision } from "./colliders.js";
import { lessonEvents } from "./lessons-bridge.js";
import { selectedPorts } from "./movement.js";
import { forward, setWorldPosition, setWorldQuaternion, worldPos, worldQ } from "./spatial.js";
import { updateSelected } from "./ui.js";
import { Q } from "./util.js";
import { restoreCamera } from "./view.js";
import { S } from "./state.js";

export function attach(a, b, secured = true, thread = 6) {
  const j = {
    a,
    b,
    inserted: true,
    secured,
    thread,
  };
  S.joints.push(j);
  a.mate = b;
  b.mate = a;
  a.joint = j;
  b.joint = j;
  if (a.part?.type === "upper") S.circuit.powerUpper = a.part;
  if (b.part?.type === "upper") S.circuit.powerUpper = b.part;
  if (secured) {
    for (const p of [a, b])
      if (
        (p.kind === "up4" && p.part.contactFault === "F4") ||
        (p.kind === "circular" && p.part.contactFault === "F5")
      )
        p.part.contactFault = null;
  }
  S.circuit.joints = S.joints;
  return j;
}
export function mateOffset(a, b) {
  if (a.part?.type === "bypass" && b.part?.type === "bypass") return 0.14;
  return [a.kind, b.kind].some((k) => ["circular", "em"].includes(k)) ? 0.28 : 0.4;
}
export function align(a, b) {
  setWorldQuaternion(a.group, worldQ(b).multiply(Q(0, Math.PI, 0)));
  setWorldPosition(a.group, worldPos(b).addScaledVector(forward(b), mateOffset(a, b)));
  updateCable(a.part);
}
export function detach(p) {
  const j = p.joint;
  if (!j) return;
  lessonEvents.add("detach:" + p.kind);
  lessonEvents.add("detach:" + p.mate.kind);
  const mate = p.mate;
  p.blockMate = mate;
  mate.blockMate = p;
  p.withdraw = {
    axial: matingInfo(p, mate).axial,
  };
  mate.withdraw = {
    axial: matingInfo(mate, p).axial,
  };
  p.joint = mate.joint = null;
  p.mate = mate.mate = null;
  S.joints.splice(S.joints.indexOf(j), 1);
  S.circuit.joints = S.joints;
}
export function eligibleMate(p, q) {
  if (
    p === q ||
    (p.part === q.part && p.part.type !== "bypass") ||
    p.mate ||
    q.mate ||
    !compatible(p.kind, q.kind)
  )
    return false;
  if (p.blockMate === q || q.blockMate === p) return false;
  return true;
}
export function matingInfo(p, q) {
  const delta = worldPos(p).sub(worldPos(q)),
    normal = forward(q),
    axial = delta.dot(normal),
    lateral = delta.clone().addScaledVector(normal, -axial).length();
  const angle = worldQ(p).angleTo(worldQ(q).multiply(Q(0, Math.PI, 0)));
  return {
    distance: delta.length(),
    axial,
    lateral,
    angle,
  };
}
export function availablePorts() {
  return [...S.parts.flatMap((p) => p.ports), ...S.bypassPorts];
}
export function nearbyPair() {
  if (!S.selected) return null;
  let pair = null,
    closest = 2.4;
  for (const p of selectedPorts(S.selected))
    for (const q of availablePorts()) {
      if (!eligibleMate(p, q)) continue;
      const d = worldPos(p).distanceTo(worldPos(q));
      if (d < closest) {
        closest = d;
        pair = {
          p,
          q,
        };
      }
    }
  return pair;
}
export function trySnap() {
  return false;
} // Connections require an explicit button.
// Connections require an explicit button.
export function connectSelected() {
  const pair = nearbyPair();
  if (!pair) return false;
  let { p, q } = pair;
  if (["screen", "em"].includes(p.kind)) {
    [p, q] = [q, p];
  }
  const entity = p.group,
    oldPos = entity.position.clone(),
    oldQ = entity.quaternion.clone();
  align(p, q);
  const savedPower = S.circuit.powerUpper,
    savedFaults = [p.part.contactFault, q.part.contactFault];
  const temporary = attach(p, q, true, 6);
  refreshCables();
  if (
    collision(entity, {
      port: p,
      part: p.part,
    })
  ) {
    detach(p);
    S.circuit.powerUpper = savedPower;
    p.part.contactFault = savedFaults[0];
    q.part.contactFault = savedFaults[1];
    p.blockMate = q.blockMate = null;
    entity.position.copy(oldPos);
    entity.quaternion.copy(oldQ);
    refreshCables();
    return false;
  }
  if (p.ring) p.ring.rotation.z = Math.PI * 2;
  completeConnection(temporary);
  refreshCables();
  updateSelected();
  return true;
}
export function disconnectSelected() {
  if (!S.selected) return false;
  const port = selectedPorts(S.selected).find((p) => p.joint);
  if (!port) return false;
  const mate = port.mate;
  let p = ["screen", "em"].includes(port.kind) ? mate : port,
    q = p.mate;
  const oldJoint = {
      ...p.joint,
    },
    old = p.group.position.clone(),
    position = worldPos(p).addScaledVector(forward(q), 0.9);
  detach(p);
  p.blockMate = q.blockMate = null;
  setWorldPosition(p.group, position);
  refreshCables();
  if (
    collision(p.group, {
      port: p,
      part: p.part,
    })
  ) {
    p.group.position.copy(old);
    attach(p, q, oldJoint.secured, oldJoint.thread);
    refreshCables();
    return false;
  }
  if (p.ring) p.ring.rotation.z = 0;
  refreshCables();
  updateSelected();
  return true;
}
export function completeConnection(j) {
  for (const p of [j.a, j.b])
    if (
      (p.kind === "up4" && p.part.contactFault === "F4") ||
      (p.kind === "circular" && p.part.contactFault === "F5")
    )
      p.part.contactFault = null;
  if (["vehicleA", "vehicleB"].includes(j.a.kind) && ["vehicleA", "vehicleB"].includes(j.b.kind)) {
    S.circuit.bypassLog.push({
      time: new Date().toISOString(),
      outcome: "bypass",
    });
  }
  restoreCamera();
}
export function turnThread(dir) {
  if (!S.selected) return;
  const p = selectedPorts(S.selected).find((p) => p.joint && ["circular", "em"].includes(p.kind));
  if (!p) return;
  const j = p.joint;
  j.thread = T.MathUtils.clamp(j.thread + dir, 0, 6);
  j.secured = j.thread === 6;
  const cp = [j.a, j.b].find((p) => p.kind === "circular");
  cp.ring.rotation.z = (j.thread * Math.PI) / 3;
  if (j.secured) completeConnection(j);
  updateSelected();
}
