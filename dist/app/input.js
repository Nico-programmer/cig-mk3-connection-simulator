// Pointer, wheel, double-click and orientation-panel input on the 3D canvas.
import * as T from "three";
import { PINS, node } from "../electrical.js";
import { keyGroup, keyLever, meter } from "./bench.js";
import { connectSelected, disconnectSelected, turnThread } from "./connection.js";
import { drawMeter, inspectMeter, setMeterMode, updateMeterControls } from "./meter.js";
import { moveSelected, rotateSelected, selectedEntity, selectedPorts } from "./movement.js";
import { partName, portName } from "./names.js";
import { probeGroup, probeTools } from "./probe-tools.js";
import { hoveredProbeContact, moveProbe, probePose, selectProbe } from "./probes.js";
import { camera, controls, dynamic, renderer } from "./scene.js";
import { ancestorData, forward, worldPos } from "./spatial.js";
import { updateSelected } from "./ui.js";
import { $, V, tr } from "./util.js";
import { startCamera } from "./view.js";
import { S } from "./state.js";

export const ray = new T.Raycaster(),
  pointer = new T.Vector2(),
  plane = new T.Plane(),
  up = V(0, 1, 0);
export function setRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
}
export function hits(e) {
  setRay(e);
  return ray.intersectObjects([dynamic, keyGroup, meter, probeGroup], true);
}
export function sceneCursor(e, hit = null) {
  let kind = "default";
  if (S.drag || e.buttons) kind = "grabbing";
  else if (hit) {
    const pin = ancestorData(hit.object, "pin"),
      probe = ancestorData(hit.object, "probeIndex"),
      action = ancestorData(hit.object, "action"),
      port = ancestorData(hit.object, "port"),
      part = ancestorData(hit.object, "part");
    kind = pin ? "crosshair" : action ? "pointer" : probe || port || part ? "grab" : "default";
  }
  renderer.domElement.setAttribute("data-cursor", kind);
  $("sceneCursor").setAttribute("data-kind", kind);
  if (e.pointerType !== "touch") {
    $("sceneCursor").hidden = false;
    $("sceneCursor").style.left = e.clientX + "px";
    $("sceneCursor").style.top = e.clientY + "px";
  }
  return kind;
}
export function releaseDrag() {
  if (!S.drag) return;
  const pointerId = S.drag.pointerId;
  if (S.drag.probeIndex !== undefined) updateMeterControls();
  S.drag = null;
  controls.enabled = true;
  if (pointerId !== undefined) {
    try {
      renderer.domElement.releasePointerCapture(pointerId);
    } catch {}
  }
  renderer.domElement.setAttribute("data-cursor", "default");
  $("sceneCursor").setAttribute("data-kind", "default");
}
renderer.domElement.addEventListener(
  "pointerdown",
  (e) => {
    if (e.button !== 0) return;
    const hit = hits(e)[0];
    if (!hit) {
      S.selected = null;
      updateSelected();
      return;
    }
    const probeIndex = ancestorData(hit.object, "probeIndex");
    if (probeIndex) {
      e.stopImmediatePropagation();
      e.preventDefault();
      const i = probeIndex - 1,
        tool = probeTools[i];
      selectProbe(i);
      if (tool.contact) return;
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(V()), tool.group.position);
      S.drag = {
        pointerId: e.pointerId,
        probeIndex: i,
        contact: null,
        offset: tool.group.position.clone().sub(ray.ray.intersectPlane(plane, V()) || hit.point),
      };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      return;
    }
    const pin = ancestorData(hit.object, "pin"),
      action = ancestorData(hit.object, "action"),
      latch = ancestorData(hit.object, "latch");
    if (action) {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (action === "key") {
        S.circuit.key = !S.circuit.key;
        keyLever.rotation.z = S.circuit.key ? -0.7 : 0;
        S.circuit.evaluate();
        if (S.meterMode === "voltage" && S.probes.length === 2) {
          S.meterResult = `${S.circuit.voltage(node(S.probes[0].port, S.probes[0].n), node(S.probes[1].port, S.probes[1].n)).toFixed(1)} V`;
          drawMeter();
        }
      }
      if (action === "meter")
        setMeterMode(
          {
            off: "voltage",
            voltage: "continuity",
            continuity: "off",
          }[S.meterMode],
        );
      if (action === "meterFocus") inspectMeter();
      return;
    }
    if (pin && S.selectedProbe !== null && !probeTools[S.selectedProbe].contact) {
      e.stopImmediatePropagation();
      e.preventDefault();
      const target = pin.port.pins.find((m) => m.userData.pin.n === pin.n);
      moveProbe(S.selectedProbe, probePose(pin, 0.24).position, pin);
      return;
    }
    const port = ancestorData(hit.object, "port"),
      part = ancestorData(hit.object, "part");
    if (!port && !part) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    S.selected = {
      port: port || null,
      part: port?.part || part,
    };
    updateSelected();
    const entity = selectedEntity(S.selected);
    setRay(e);
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(V()), hit.point);
    const intersect = ray.ray.intersectPlane(plane, V());
    S.drag = {
      pointerId: e.pointerId,
      startPosition: entity.getWorldPosition(V()),
      offset: entity.getWorldPosition(V()).sub(intersect || hit.point),
      startX: e.clientX,
      startY: e.clientY,
      point: hit.point.clone(),
    };
    controls.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
    renderer.domElement.style.cursor = "grabbing";
  },
  true,
);
renderer.domElement.addEventListener("pointermove", (e) => {
  sceneCursor(e, S.drag ? null : hits(e)[0]);
  if (S.drag) {
    e.preventDefault();
    setRay(e);
    const at = ray.ray.intersectPlane(plane, V());
    if (S.drag.probeIndex !== undefined) {
      const contact = hoveredProbeContact(e);
      let desired = at?.add(S.drag.offset);
      if (contact) {
        const pin = contact.port.pins.find((p) => p.userData.pin.n === contact.n);
        desired = probePose(contact, 0.24).position;
      }
      if (desired) moveProbe(S.drag.probeIndex, desired, contact);
    } else if (at) {
      const desired = at.add(S.drag.offset);
      moveSelected(S.drag.startPosition.clone().add(desired.sub(S.drag.startPosition).multiplyScalar(1.35)));
    }
    return;
  }
  const h = hits(e)[0];
  const tip = $("tooltip");
  if (!h) {
    tip.style.display = "none";
    return;
  }
  const pin = ancestorData(h.object, "pin"),
    port = ancestorData(h.object, "port"),
    part = ancestorData(h.object, "part"),
    action = ancestorData(h.object, "action");
  let text = "";
  if (pin && PINS[pin.port.kind]?.[pin.n]) text = `${pin.n} · ${PINS[pin.port.kind][pin.n]}`;
  else if (h.object.userData.tooltip) text = h.object.userData.tooltip();
  else if (port) text = portName(port);
  else if (part) text = partName(part) || "";
  else if (action === "key") text = tr("Girar llave", "Turn key");
  else if (action === "meter") text = tr("Girar selector", "Turn selector");
  else if (action === "meterFocus") text = tr("Acercar multímetro", "Inspect multimeter");
  tip.textContent = text;
  tip.style.display = text ? "block" : "none";
  tip.style.left = Math.min(innerWidth - 275, e.clientX + 15) + "px";
  tip.style.top = Math.min(innerHeight - 90, e.clientY + 18) + "px";
});
renderer.domElement.addEventListener("pointerleave", () => {
  $("sceneCursor").hidden = true;
  if (!S.drag) renderer.domElement.setAttribute("data-cursor", "default");
});
renderer.domElement.addEventListener("lostpointercapture", releaseDrag);
renderer.domElement.addEventListener("pointerup", releaseDrag);
renderer.domElement.addEventListener("pointercancel", releaseDrag);
window.addEventListener("blur", releaseDrag);
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (!S.drag) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const entity =
        S.drag.probeIndex !== undefined ? probeTools[S.drag.probeIndex].group : selectedEntity(S.selected),
      direction = camera.getWorldDirection(V());
    const delta = direction.multiplyScalar(T.MathUtils.clamp(e.deltaY, -100, 100) * 0.016);
    if (S.drag.probeIndex !== undefined) {
      moveProbe(S.drag.probeIndex, entity.position.clone().add(delta));
      plane.translate(delta);
      return;
    }
    moveSelected(entity.getWorldPosition(V()).add(delta));
    plane.translate(delta);
    setRay(e);
    const at = ray.ray.intersectPlane(plane, V());
    if (at) S.drag.offset = entity.getWorldPosition(V()).sub(at);
  },
  {
    capture: true,
    passive: false,
  },
);
renderer.domElement.addEventListener("dblclick", (e) => {
  if (S.drag) releaseDrag();
  const hit = hits(e)[0];
  if (!hit) return;
  const p = ancestorData(hit.object, "port");
  if (!p) return;
  if (!S.returnView)
    S.returnView = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
  S.focus = p;
  startCamera(
    worldPos(p)
      .addScaledVector(forward(p), 3.3)
      .add(V(0, 1.2, 0)),
    worldPos(p),
  );
});
$("orient").addEventListener("pointerdown", (e) => e.stopPropagation());
$("orient").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "connectAction") {
    selectedPorts(S.selected).some((p) => p.joint) ? disconnectSelected() : connectSelected();
    return;
  }
  if (b.dataset.axis) rotateSelected(b.dataset.axis, Number(b.dataset.dir));
  if (b.dataset.thread) turnThread(Number(b.dataset.thread));
  if (b.dataset.depth && S.selected) {
    const g = selectedEntity(S.selected);
    moveSelected(
      g.getWorldPosition(V()).addScaledVector(camera.getWorldDirection(V()), -Number(b.dataset.depth) * 0.45),
    );
  }
});
