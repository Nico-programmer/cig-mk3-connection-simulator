// Moving and rotating the selected part or connector.
import { updateBypassCables } from "./bypass.js";
import { HARNESS_REACH, jacketEnd, refreshCables, updateCable } from "./cables.js";
import { moveWithSlide, refreshColliders, rotateChecked } from "./colliders.js";
import { matingInfo } from "./connection.js";
import { refreshProbes } from "./probes.js";
import { worldPos } from "./spatial.js";
import { updateSelected } from "./ui.js";
import { V } from "./util.js";
import { S } from "./state.js";

export function selectedEntity(s) {
  if (s.port && ["screen", "em"].includes(s.port.kind)) return s.port.part.root;
  return s.port ? s.port.group : s.part.root;
}
export function selectedPorts(s) {
  return s.port && !["screen", "em"].includes(s.port.kind) ? [s.port] : s.part.ports;
}
export function moveSelected(desired) {
  if (!S.selected) return;
  const entity = selectedEntity(S.selected),
    ports = selectedPorts(S.selected);
  if (ports.some((p) => p.joint)) return;
  const from = entity.getWorldPosition(V()),
    before = entity.position.clone(),
    harnessEnd = S.selected.port && S.selected.part.cableGroup && entity === S.selected.port.group,
    other = harnessEnd && S.selected.part.ports.find((q) => q !== S.selected.port),
    exitOffset = harnessEnd && jacketEnd(S.selected.port).point.sub(from),
    beyondReach = () =>
      harnessEnd &&
      entity.getWorldPosition(V()).add(exitOffset).distanceTo(jacketEnd(other).point) > HARNESS_REACH + 1e-6;
  let target = desired.clone();
  // A harness connector stops where its cable runs out: the cable never stretches.
  if (harnessEnd) {
    const anchor = jacketEnd(other).point,
      exit = target.clone().add(exitOffset);
    if (exit.distanceTo(anchor) > HARNESS_REACH)
      target = anchor.add(exit.sub(anchor).setLength(HARNESS_REACH)).sub(exitOffset);
  }
  const delta = target.sub(from);
  if (delta.length() > 10) delta.setLength(10);
  let moved = moveWithSlide(entity, from, delta);
  if (moved && beyondReach()) {
    // sliding along a surface carried it past the reach: stay put this time
    entity.position.copy(before);
    entity.updateWorldMatrix(true, true);
    moved = false;
  }
  if (moved) {
    for (const p of ports) {
      if (p.blockMate && p.withdraw) p.withdraw.axial = matingInfo(p, p.blockMate).axial;
      if (p.blockMate && worldPos(p).distanceTo(worldPos(p.blockMate)) > 1.1) {
        p.blockMate.blockMate = null;
        p.blockMate = null;
      }
    }
    updateCable(S.selected.part);
    updateBypassCables();
    refreshProbes();
    refreshColliders();
  }
  updateSelected();
}
// Each button press or arrow key turns 15° in five 3° checked increments.
export function rotateSelected(axis, dir) {
  if (!S.selected) return;
  const ports = selectedPorts(S.selected);
  if (ports.some((p) => p.joint)) return;
  const entity = selectedEntity(S.selected),
    worldAxis = V(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  rotateChecked(entity, 5, (e) => e.rotateOnWorldAxis(worldAxis, (dir * Math.PI) / 60));
  refreshCables();
  updateSelected();
}
