// Probe placement, probe leads and probe movement.
import * as T from "three";
import { routeLead, segmentHitsSolid } from "../collision.js";
import { cachedCollider as colliderOf, curveFor, pathKey, updateTube } from "../drag-performance.js";
import { PINS } from "../electrical.js";
import { cable } from "../geometry.js";
import { meter } from "./bench.js";
import { refreshColliders } from "./colliders.js";
import { hits } from "./input.js";
import { drawMeter, takeProbe, updateMeterControls } from "./meter.js";
import { probeTools, probeWires } from "./probe-tools.js";
import { camera } from "./scene.js";
import { ancestorData, forward, isDescendant, worldQ } from "./spatial.js";
import { updateSelected } from "./ui.js";
import { V } from "./util.js";
import { S } from "./state.js";

export function resetProbeTools() {
  S.selectedProbe = null;
  probeTools.forEach((p, i) => {
    p.contact = null;
    p.blocked = false;
    p.leadPoints = null;
    p.group.position.set(4.2 + i * 1.1, 0.22, 4.8);
    p.group.rotation.set(-Math.PI / 2, 0, 0);
  });
}
// Position of probePose() without its approach-direction search. With the default
// clearance (0.04) the direction is scaled by zero, so the position never depends on
// it: this returns exactly probePose(contact).position at a fraction of the cost.
export function probeTargetPosition(contact, clearance = 0.04) {
  const { port, n } = contact;
  if (port.mate && clearance !== 0.04) return probePose(contact, clearance).position;
  const pin = port.pins.find((p) => p.userData.pin.n === n);
  if (!port.mate) return pin.getWorldPosition(V()).addScaledVector(forward(port), clearance);
  const access = ["screen", "em"].includes(port.kind) ? port.mate : port,
    local = access.group.worldToLocal(pin.getWorldPosition(V()));
  local.z = -0.35;
  return access.group.localToWorld(local.clone());
}
// Closed joints are measured at the harness's rear terminals (back-probing),
// never by putting the probe handle inside the connected counterpart.
export function probePose(contact, clearance = 0.04) {
  const { port, n } = contact,
    pin = port.pins.find((p) => p.userData.pin.n === n);
  if (!port.mate)
    return {
      position: pin.getWorldPosition(V()).addScaledVector(forward(port), clearance),
      quaternion: worldQ(port),
    };
  const access = ["screen", "em"].includes(port.kind) ? port.mate : port,
    local = access.group.worldToLocal(pin.getWorldPosition(V()));
  local.z = -0.35;
  const position = access.group.localToWorld(local.clone()),
    base = worldQ(access),
    candidates = [V(local.x, local.y, -0.35).normalize(), V(0, 0, -1)];
  for (let i = 0; i < 16; i++)
    candidates.push(V(Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8), -0.08).normalize());
  // Every tested segment stays within 1.08 of `position` and is swept with radius <= 0.17,
  // so a solid farther than reach + its half-diagonal can never block a candidate.
  // Skipping those solids does not change which direction is chosen.
  const reach = 1.08 + 0.17 * Math.sqrt(3) + 1e-3,
    obstacles = S.allColliders
      .filter((m) => m.userData.probeIndex === undefined && m.userData.probeLead === undefined)
      .map(colliderOf)
      .filter((o) => o.center.distanceTo(position) <= reach + o.halfSize.length());
  let direction = candidates[0].clone().applyQuaternion(base);
  for (const c of candidates) {
    const d = c.clone().applyQuaternion(base),
      a = position.clone().addScaledVector(d, 0.3),
      b = position.clone().addScaledVector(d, 1.08);
    if (!obstacles.some((o) => segmentHitsSolid(position, a, o, 0.066) || segmentHitsSolid(a, b, o, 0.17))) {
      direction = d;
      break;
    }
  }
  return {
    position: position.addScaledVector(direction, clearance - 0.04),
    quaternion: new T.Quaternion().setFromUnitVectors(V(0, 0, 1), direction),
  };
}
export function probeObstacles(index) {
  return S.allColliders
    .filter(
      (m) =>
        m.userData.probeLead === undefined &&
        !isDescendant(m, probeTools[index].group) &&
        !m.userData.cableOwner,
    )
    .map((m) => ({
      mesh: m,
      obb: colliderOf(m),
    }));
}
export function leadPath(index, obstacles = probeObstacles(index)) {
  const g = probeTools[index].group,
    start = meter.localToWorld(V(index ? -0.63 : 0.63, -1.44, 0.4)),
    end = g.localToWorld(V(0, 0, 1.1));
  const boxes = obstacles.map((o) => o.obb),
    previous = probeTools[index].leadPoints;
  if (previous) {
    const points = previous.map((p) => p.clone());
    points[0] = start;
    points[points.length - 1] = end;
    if (points.slice(1).every((p, j) => !boxes.some((o) => segmentHitsSolid(points[j], p, o, 0.042))))
      return points;
  }
  return routeLead(start, end, boxes, 0.042);
}
export function refreshProbes() {
  probeTools.forEach((tool, i) => {
    if (tool.contact) {
      const { port, n } = tool.contact,
        pin = port.pins.find((m) => m.userData.pin.n === n);
      if (pin) {
        const pose = probePose(tool.contact);
        tool.group.position.copy(pose.position);
        tool.group.quaternion.copy(pose.quaternion);
      }
    }
    const points = leadPath(i);
    if (!points) {
      tool.leadBlocked = true;
      if (tool.wire) {
        tool.wire.geometry.dispose();
        tool.wire.material.dispose();
        probeWires.remove(tool.wire);
        tool.wire = null;
        tool.wireKey = null;
      }
      return;
    }
    tool.leadBlocked = false;
    tool.leadPoints = points;
    const key = pathKey(points);
    if (tool.wire && tool.wireKey === key) {
      tool.wire.visible = true;
      return;
    }
    let wire = tool.wire;
    if (!wire) {
      wire = cable(points, i ? 0x10151b : 0xd84132, 0.038, true);
      wire.raycast = () => {};
      probeWires.add(wire);
      tool.wire = wire;
    } else updateTube(wire, curveFor(points, true), true);
    wire.visible = true;
    tool.wireKey = key;
    wire.traverse((m) => {
      m.userData.probeLead = i;
    });
  });
}
export function placeProbe(index, contact) {
  const tool = probeTools[index],
    previousContact = tool.contact;
  tool.contact = null;
  if (contact) {
    const target = probePose(contact).position;
    moveProbe(index, target, contact);
    if (tool.group.position.distanceTo(target) > 0.012) {
      tool.contact = previousContact;
      refreshProbes();
      return false;
    }
  }
  tool.contact = contact;
  S.probes = [];
  S.meterResult = "—";
  if (probeTools.every((p) => p.contact) && S.meterMode !== "off") {
    takeProbe(probeTools[0].contact);
    takeProbe(probeTools[1].contact);
  } else {
    S.probes = probeTools.filter((p) => p.contact).map((p) => p.contact);
    drawMeter();
  }
  refreshProbes();
  refreshColliders();
  updateMeterControls();
  return true;
}
export function probeBlocked(index, contact, obstacles) {
  const group = probeTools[index].group;
  for (const own of S.allColliders.filter((m) => isDescendant(m, group))) {
    const obb = colliderOf(own),
      axes = obb.rotation.elements,
      yextent =
        Math.abs(axes[1]) * obb.halfSize.x +
        Math.abs(axes[4]) * obb.halfSize.y +
        Math.abs(axes[7]) * obb.halfSize.z;
    if (obb.center.y - yextent < -0.115 || obb.intersectsSphere(new T.Sphere(camera.position, 0.38)))
      return true;
    for (const { mesh: other, obb: otherOBB } of obstacles) {
      if (
        own.userData.probeTip &&
        contact &&
        (other.userData.port === contact.port || other.userData.port === contact.port.mate)
      )
        continue;
      if (obb.intersectsOBB(otherOBB, 1e-5)) return true;
    }
  }
  return false;
}
export function moveProbe(index, desired, contact = null) {
  const tool = probeTools[index],
    group = tool.group,
    from = group.position.clone(),
    fromQ = group.quaternion.clone(),
    targetQ = contact ? probePose(contact).quaternion : fromQ.clone();
  const obstacles = S.allColliders
      .filter((m) => !isDescendant(m, group) && m.userData.probeLead === undefined)
      .map((m) => ({
        mesh: m,
        obb: colliderOf(m),
      })),
    leadObstacles = probeObstacles(index);
  const count = Math.max(
    1,
    Math.ceil(from.distanceTo(desired) / 0.025),
    Math.ceil(fromQ.angleTo(targetQ) / 0.025),
  );
  let accepted = false;
  tool.blocked = false;
  for (let i = 1; i <= count; i++) {
    const old = group.position.clone(),
      oldQ = group.quaternion.clone();
    group.position.copy(from).lerp(desired, i / count);
    group.quaternion.copy(fromQ).slerp(targetQ, i / count);
    const points = leadPath(index, leadObstacles),
      otherIndex = 1 - index,
      otherPoints = leadPath(otherIndex);
    if (probeBlocked(index, contact, obstacles) || !points || !otherPoints) {
      tool.blocked = true;
      group.position.copy(old);
      group.quaternion.copy(oldQ);
      break;
    }
    tool.leadPoints = points;
    probeTools[otherIndex].leadPoints = otherPoints;
    accepted = true;
  }
  refreshProbes();
  refreshColliders();
  updateMeterControls();
  return accepted;
}
export function hoveredProbeContact(e) {
  for (const h of hits(e)) {
    if (ancestorData(h.object, "probeIndex")) continue;
    const pin = ancestorData(h.object, "pin");
    return pin && PINS[pin.port.kind]?.[pin.n] ? pin : null;
  }
  return null;
}
export function nearbyProbeContact(index) {
  if (index === null || probeTools[index].contact) return null;
  const tip = probeTools[index].group.position;
  let result = null,
    min = 0.34;
  for (const part of S.parts)
    for (const port of part.ports)
      for (const pin of port.pins) {
        const n = pin.userData.pin.n;
        if (!PINS[port.kind]?.[n]) continue;
        const target = probeTargetPosition({
            port,
            n,
          }),
          d = tip.distanceTo(target);
        if (d < min) {
          min = d;
          result = {
            port,
            n,
          };
        }
      }
  return result;
}
export function selectProbe(index) {
  S.selectedProbe = index;
  S.selected = null;
  updateSelected();
  updateMeterControls();
}
export function connectProbe() {
  const contact = nearbyProbeContact(S.selectedProbe);
  if (!contact) return false;
  placeProbe(S.selectedProbe, contact);
  return true;
}
export function removeProbe(index) {
  const tool = probeTools[index];
  if (!tool.contact) return false;
  tool.contact = null;
  tool.group.position.set(4.2 + index * 1.1, 0.22, 4.8);
  tool.group.rotation.set(-Math.PI / 2, 0, 0);
  placeProbe(index, null);
  S.selectedProbe = index;
  updateMeterControls();
  return true;
}
