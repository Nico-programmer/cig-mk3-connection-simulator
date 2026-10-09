// Scene-graph helpers: world position/orientation of ports, ancestry lookups.
import * as T from "three";
import { V } from "./util.js";

export function worldPos(port) {
  return port.group.getWorldPosition(V());
}
export function worldQ(port) {
  return port.group.getWorldQuaternion(new T.Quaternion());
}
export function forward(port) {
  return V(0, 0, 1).applyQuaternion(worldQ(port));
}
export function setWorldPosition(group, p) {
  group.position.copy(group.parent.worldToLocal(p.clone()));
  group.updateWorldMatrix(true, true);
}
export function setWorldQuaternion(group, q) {
  const parentq = group.parent.getWorldQuaternion(new T.Quaternion());
  group.quaternion.copy(parentq.invert().multiply(q));
  group.updateWorldMatrix(true, true);
}
export function ancestorData(obj, key) {
  while (obj) {
    if (obj.userData[key]) return obj.userData[key];
    obj = obj.parent;
  }
  return null;
}
export function isDescendant(m, parent) {
  for (let p = m; p; p = p.parent) if (p === parent) return true;
  return false;
}
