// Moving and rotating the selected part or connector.
import { updateBypassCables } from "./bypass.js";
import { refreshCables, updateCable } from "./cables.js";
import { clearTranslation, collision, collisionContext, refreshColliders } from "./colliders.js";
import { matingInfo } from "./connection.js";
import { refreshProbes } from "./probes.js";
import { isDescendant, setWorldPosition, worldPos } from "./spatial.js";
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
export function movingSolids(entity) {
  return S.allColliders.filter((m) => isDescendant(m, entity));
}
export function moveSelected(desired) {
  if (!S.selected) return;
  const entity = selectedEntity(S.selected),
    ports = selectedPorts(S.selected);
  if (ports.some((p) => p.joint)) return;
  const from = entity.getWorldPosition(V()),
    delta = desired.clone().sub(from);
  if (delta.length() > 10) delta.setLength(10);
  const context = collisionContext(entity, S.selected),
    steps = clearTranslation(entity, S.selected, delta, context)
      ? 1
      : Math.max(1, Math.ceil(delta.length() / 0.025));
  let moved = false;
  for (let i = 1; i <= steps; i++) {
    const previous = entity.position.clone();
    setWorldPosition(entity, from.clone().addScaledVector(delta, i / steps));
    if (S.selected.part.cableGroup) {
      updateCable(S.selected.part, true);
      refreshColliders();
    }
    if (collision(entity, S.selected, context)) {
      entity.position.copy(previous);
      entity.updateWorldMatrix(true, true);
      if (S.selected.part.cableGroup) {
        updateCable(S.selected.part);
        refreshColliders();
      }
      break;
    }
    moved = true;
    for (const p of ports) {
      if (p.blockMate && p.withdraw) p.withdraw.axial = matingInfo(p, p.blockMate).axial;
      if (p.blockMate && worldPos(p).distanceTo(worldPos(p.blockMate)) > 1.1) {
        p.blockMate.blockMate = null;
        p.blockMate = null;
      }
    }
  }
  if (moved) {
    updateCable(S.selected.part);
    updateBypassCables();
    refreshProbes();
    refreshColliders();
  }
  updateSelected();
}
export function rotateSelected(axis, dir) {
  if (!S.selected) return;
  const ports = selectedPorts(S.selected);
  if (ports.some((p) => p.joint)) return;
  const entity = selectedEntity(S.selected),
    before = entity.quaternion.clone();
  for (let i = 0; i < 5; i++) {
    entity.rotateOnWorldAxis(
      V(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0),
      (dir * Math.PI) / 60,
    );
    entity.updateWorldMatrix(true, true);
    if (S.selected.part.cableGroup) {
      updateCable(S.selected.part, true);
      refreshColliders();
    }
    if (collision(entity, S.selected, context)) {
      entity.quaternion.copy(before);
      entity.updateWorldMatrix(true, true);
      refreshCables();
      return;
    }
  }
  refreshCables();
  updateSelected();
}
