// Lesson pin highlights and floating pin/probe labels.
import * as T from "three";
import { PINS } from "../electrical.js";
import { pinTargets } from "../learning.js";
import { learning } from "./learning-mount.js";
import { portName } from "./names.js";
import { pinHighlightGroup } from "./overlays.js";
import { probeTools } from "./probe-tools.js";
import { nearbyProbeContact, probePose } from "./probes.js";
import { workParts } from "./scenario.js";
import { camera, renderer } from "./scene.js";
import { $, V, tr } from "./util.js";
import { S } from "./state.js";

export let highlightedPins = [],
  highlightKey = "",
  highlightParts = null;
export function positionPinLabel(element, world, dx = 12, dy = -24) {
  camera.updateMatrixWorld();
  const view = world.clone().applyMatrix4(camera.matrixWorldInverse),
    p = world.clone().project(camera),
    r = renderer.domElement.getBoundingClientRect();
  element.hidden = view.z >= 0 || p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
  if (!element.hidden) {
    element.style.left = r.left + ((p.x + 1) * r.width) / 2 + dx + "px";
    element.style.top = r.top + ((1 - p.y) * r.height) / 2 + dy + "px";
  }
}
export function updatePinGuidance() {
  const lesson = learning.active,
    current = lesson?.steps[learning.index],
    targets = pinTargets(lesson?.id, current?.id),
    key = JSON.stringify(targets);
  if (key !== highlightKey || highlightParts !== S.parts) {
    for (const h of highlightedPins) {
      h.ring.geometry.dispose();
      h.ring.material.dispose();
      pinHighlightGroup.remove(h.ring);
    }
    highlightedPins = [];
    const labels = [];
    for (const target of targets) {
      const installedUpper = workParts[0]?.ports[0].mate?.part;
      const pinParts =
        installedUpper?.type === "upper" ? [workParts[0], installedUpper, ...workParts.slice(2)] : workParts;
      const port = pinParts.flatMap((p) => p.ports).find((p) => p.kind === target.kind),
        pin = port?.pins.find((p) => p.userData.pin.n === target.n);
      if (!pin) continue;
      const color = {
        red: 0xff7668,
        black: 0xf3f7fa,
        can: 0x42e8df,
        warning: 0xffc15b,
      }[target.tone];
      const ring = new T.Mesh(
        new T.RingGeometry(0.075, 0.115, 32),
        new T.MeshBasicMaterial({
          color,
          side: T.DoubleSide,
          depthTest: false,
          depthWrite: false,
        }),
      );
      ring.renderOrder = 1200;
      ring.raycast = () => {};
      pinHighlightGroup.add(ring);
      const badge = document.createElement("span");
      badge.className = "pinNumberLabel " + target.tone;
      badge.textContent = "Pin " + target.n;
      badge.title = portName(port) + " · " + PINS[port.kind][target.n];
      labels.push(badge);
      highlightedPins.push({
        port,
        pin,
        n: target.n,
        ring,
        badge,
      });
    }
    $("pinGuidance").replaceChildren(...labels);
    highlightKey = key;
    highlightParts = S.parts;
  }
  highlightedPins.forEach((h, i) => {
    const pose = probePose(
        {
          port: h.port,
          n: h.n,
        },
        0.08,
      ),
      world = pose.position;
    h.ring.position.copy(world);
    h.ring.quaternion.copy(pose.quaternion);
    positionPinLabel(h.badge, world, 12, -25 - (i % 2) * 25);
    h.badge.textContent = "Pin " + h.n;
    h.badge.title = portName(h.port) + " · " + PINS[h.port.kind][h.n];
  });
  for (let i = 0; i < 2; i++) {
    const badge = $("probePin" + i),
      contact = lesson ? probeTools[i].contact || nearbyProbeContact(i) : null;
    badge.hidden = !contact;
    if (!contact) continue;
    const pin = contact.port.pins.find((p) => p.userData.pin.n === contact.n);
    badge.textContent = `${i ? tr("Negra", "Black") : tr("Roja", "Red")} · Pin ${contact.n} · ${PINS[contact.port.kind][contact.n]}`;
    badge.setAttribute("data-probe", String(i));
    positionPinLabel(badge, pin.getWorldPosition(V()), 24, i ? 30 : 5);
  }
}
