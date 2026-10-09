// Animation loop: circuit evaluation, screens/LEDs, guidance, render. Window resize.
import { node } from "../electrical.js";
import { updatePinGuidance } from "./guidance.js";
import { updateHitboxes } from "./hitboxes.js";
import { plane, pointer, ray } from "./input.js";
import { learning } from "./learning-mount.js";
import { drawMeter, refreshVoltageReading } from "./meter.js";
import { selectedEntity } from "./movement.js";
import { camera, controls, renderer, scene } from "./scene.js";
import { updateLeads } from "./probes.js";
import { updateHarnesses } from "./cables.js";
import { paintScreen } from "./screens.js";
import { V, tr } from "./util.js";
import { guardCamera, restoreCameraDesired } from "./view.js";
import { S } from "./state.js";

let lastFrameMs = null;
export let lastEval = 0,
  states = {
    screens: {},
    ems: {},
  };
export function animate(ms) {
  requestAnimationFrame(animate);
  S.clock = ms / 1000;
  restoreCameraDesired();
  controls.update();
  if (S.cameraMotion) {
    const motion = S.cameraMotion,
      t = Math.min(1, (ms - motion.start) / motion.duration),
      s = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: gentle start and stop
    camera.position.lerpVectors(motion.from, motion.to, s);
    controls.target.lerpVectors(motion.startTarget, motion.target, s);
    camera.lookAt(controls.target);
    if (t >= 1) S.cameraMotion = null;
  }
  guardCamera();
  const dt = lastFrameMs === null ? 1 / 60 : Math.max(0, ms - lastFrameMs) / 1000;
  updateLeads(dt);
  updateHarnesses(dt);
  lastFrameMs = ms;
  if (S.drag && S.cameraMotion) {
    ray.setFromCamera(pointer, camera);
    const at = ray.ray.intersectPlane(plane, V());
    if (at) S.drag.offset = selectedEntity(S.selected).getWorldPosition(V()).sub(at);
  }
  if (ms - lastEval > 90) {
    states = S.circuit.evaluate();
    const previous = S.meterResult;
    refreshVoltageReading();
    if (S.meterMode === "continuity" && S.probes.length === 2 && S.meterResult !== "—") {
      const [a, b] = S.probes;
      S.meterResult = S.circuit.continuity(node(a.port, a.n), node(b.port, b.n))
        ? tr("PASA", "PASS")
        : tr("NO PASA", "NO PASS");
    }
    if (S.meterResult !== previous) drawMeter();
    lastEval = ms;
  }
  for (const p of S.parts) {
    if (p.type === "screen") paintScreen(p, states.screens[p.id] || "off", S.clock);
    if (p.type === "em") {
      const s = states.ems[p.id];
      const on = s === "steady" || (s === "blink" && Math.sin(S.clock * Math.PI) > 0);
      p.led.material.color.setHex(on ? 0x36e876 : 0x0c2118);
      p.led.material.emissiveIntensity = on ? 1.8 : 0;
    }
  }
  learning.tick();
  updatePinGuidance();
  updateHitboxes();
  renderer.render(scene, camera);
}
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
