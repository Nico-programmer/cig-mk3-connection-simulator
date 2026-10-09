// Harness cable shape (main cable and the four coloured wires) and global cable refresh.
import { curveFor, updateTube } from "../drag-performance.js";
import { cable } from "../geometry.js";
import { updateBypassCables } from "./bypass.js";
import { cableVolumes, refreshColliders } from "./colliders.js";
import { refreshProbes } from "./probes.js";
import { V } from "./util.js";
import { S } from "./state.js";

export function updateCable(p, solidsOnly = false) {
  if (!p.cableGroup) return;
  const key = p.ports
    .map((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray()].join(","))
    .join(";");
  if (p.cableShapeKey === key && (solidsOnly || p.cableRenderKey === key)) return;
  const ends = p.ports.map((p) => p.group.position.clone()),
    backs = p.ports.map((p) => V(0, 0, -0.7).applyQuaternion(p.group.quaternion).add(p.group.position)),
    mid = backs[0].clone().lerp(backs[1], 0.5);
  mid.y = Math.max(0.13, mid.y - 0.65);
  mid.z -= 0.35;
  const points = [ends[0], backs[0], mid, backs[1], ends[1]];
  let mesh = p.cableGroup.children[0];
  if (!mesh) {
    mesh = cable(points, 0x0f161a, 0.086);
    mesh.userData.part = p;
    p.cableGroup.add(mesh);
  }
  if (p.cableShapeKey !== key) {
    mesh.userData.cableCurve = curveFor(points);
    cableVolumes(mesh, p);
    p.cableShapeKey = key;
  }
  if (solidsOnly) return;
  updateTube(mesh, mesh.userData.cableCurve);
  p.cableRenderKey = key;
  for (let e = 0; e < 2; e++)
    for (let i = 0; i < 4; i++) {
      const a = ends[e].clone().lerp(backs[e], 0.22),
        b = ends[e].clone().lerp(backs[e], 0.8);
      a.y += (i - 1.5) * 0.037;
      b.y += (i - 1.5) * 0.037;
      const points = [a, a.clone().lerp(b, 0.5), b];
      let m = p.cableGroup.children[1 + e * 4 + i];
      if (!m) {
        m = cable(points, [0xb33227, 0x17191b, 0xc5722e, 0x755042][i], 0.018);
        m.userData.part = p;
        p.cableGroup.add(m);
      } else updateTube(m, curveFor(points));
    }
}
export function refreshCables() {
  S.parts.forEach(updateCable);
  updateBypassCables();
  refreshProbes();
  refreshColliders();
}
