// Harness cables (1.17). Each harness is a physical rope (rope.js) that leaves the BACK of both
// connectors, where the four coloured wires - red (switched +), black (ground), orange
// (CAN HI), brown (CAN LO) - come out of the shell and enter the cable jacket. The cable never
// touches the pin face. Its length follows the gap between the connectors with slack, up to
// the harness length; a connector dragged further stops (see movement.js).
import * as T from "three";
import { material } from "../geometry.js";
import { updateBypassCables } from "./bypass.js";
import { refreshColliders } from "./colliders.js";
import { refreshProbes } from "./probes.js";
import { Rope } from "./rope.js";
import { S } from "./state.js";

export const HARNESS_MAX = 11,
  HARNESS_SLACK = 1.2,
  HARNESS_EXTRA = 1.0,
  HARNESS_REACH = (HARNESS_MAX - HARNESS_EXTRA) / HARNESS_SLACK;
export const harnessLength = (d) => Math.min(HARNESS_MAX, Math.max(2.5, d * HARNESS_SLACK + HARNESS_EXTRA));

const JACKET_Z = -0.62, // where the cable jacket starts, behind the connector (local z)
  REAR_Z = { circular: -0.32 }, // rear face of the shell; -0.30 for the rectangular shells
  WIRE_COLORS = [0xb33227, 0x17191b, 0xc5722e, 0x755042],
  WIRE_OFFSETS = [
    [-0.035, 0.035],
    [0.035, 0.035],
    [-0.035, -0.035],
    [0.035, -0.035],
  ];

// World position and outward direction of the jacket start behind a connector.
export function jacketEnd(port) {
  port.group.updateWorldMatrix(true, false);
  return {
    point: port.group.localToWorld(new T.Vector3(0, 0, JACKET_Z)),
    dir: new T.Vector3(0, 0, -1).applyQuaternion(port.group.getWorldQuaternion(new T.Quaternion())),
  };
}

// The four wires between the rear of the shell and the jacket; fixed to the connector.
function addWires(port, part) {
  if (port.wires) return;
  const rear = REAR_Z[port.kind] ?? -0.3,
    length = rear - (JACKET_Z - 0.04);
  port.wires = WIRE_OFFSETS.map(([x, y], i) => {
    const wire = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, length, 8), material(WIRE_COLORS[i]));
    wire.rotation.x = Math.PI / 2;
    wire.position.set(x, y, rear - length / 2);
    wire.castShadow = true;
    wire.userData.part = part;
    port.group.add(wire);
    return wire;
  });
}

export function updateCable(p) {
  if (!p.cableGroup) return;
  p.ports.forEach((port) => addWires(port, p));
  if (!p.rope) {
    p.rope = new Rope({
      count: 48,
      radius: 0.086,
      color: 0x0f161a,
      getEnds: () => {
        const a = jacketEnd(p.ports[0]),
          b = jacketEnd(p.ports[1]);
        return { a: a.point, aDir: a.dir, b: b.point, bDir: b.dir };
      },
      lengthFor: harnessLength,
      maxLength: HARNESS_MAX,
    });
    p.rope.mesh.userData.part = p;
    p.cableGroup.add(p.rope.mesh);
    p.rope.render();
  }
  p.rope.wake();
}
// Called every frame by the animation loop.
export function updateHarnesses(dt) {
  for (const p of S.parts) if (p.rope) p.rope.update(dt);
}
export function refreshCables() {
  S.parts.forEach(updateCable);
  updateBypassCables();
  refreshProbes();
  refreshColliders();
}
