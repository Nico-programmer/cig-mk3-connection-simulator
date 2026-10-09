// Builds the bench for a scenario: work parts, spares, joints and faults.
import { Circuit } from "../electrical.js";
import { keyLever } from "./bench.js";
import { buildBypass } from "./bypass.js";
import { updateCable } from "./cables.js";
import { refreshColliders } from "./colliders.js";
import { align, attach, mateOffset } from "./connection.js";
import { drawMeter } from "./meter.js";
import { makeEM, makeHarness, makeScreen } from "./parts.js";
import { refreshProbes, resetProbeTools } from "./probes.js";
import { camera, controls, dynamic, lastCamera } from "./scene.js";
import { forward, setWorldPosition, setWorldQuaternion, worldPos } from "./spatial.js";
import { updateLabels, updateSelected } from "./ui.js";
import { Q, V } from "./util.js";
import { S } from "./state.js";

export let workParts = [];
export function buildScenario(code = "assembly", segment = "upper") {
  S.selected = null;
  S.drag = null;
  S.probes = [];
  S.testStage = {
    lo: 0,
    hi: 0,
  };
  S.meterResult = "—";
  S.focus = null;
  S.cameraMotion = null;
  S.returnView = null;
  controls.enabled = true;
  for (const child of [...dynamic.children]) {
    child.traverse((m) => {
      m.geometry?.dispose();
      if (m.material) {
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          mat.map?.dispose();
          mat.dispose();
        }
      }
    });
    dynamic.remove(child);
  }
  S.parts = [];
  S.joints = [];
  S.circuit = new Circuit();
  S.circuit.joints = S.joints;
  S.scenarioCode = code;
  S.idcount = 0;
  const screen = makeScreen(V(-5.7, 0, 0)),
    upper = makeHarness("upper", V(-2.3, 0, 1)),
    lower = makeHarness("lower", V(1.5, 0, 1)),
    em = makeEM(V(5.2, 0, 0));
  workParts = [screen, upper, lower, em];
  makeScreen(V(-8, 0, -5.35), true);
  makeHarness("upper", V(-2.7, 0, -5.3), true);
  makeHarness("lower", V(2.7, 0, -5.3), true);
  makeEM(V(8, 0, -5.35), true);
  if (code !== "assembly") {
    align(upper.ports[0], screen.ports[0]);
    setWorldPosition(upper.ports[1].group, V(-0.55, 0.85, 0));
    setWorldQuaternion(upper.ports[1].group, Q(0, Math.PI / 2, 0));
    align(lower.ports[0], upper.ports[1]);
    align(lower.ports[1], em.ports[0]);
    attach(upper.ports[0], screen.ports[0]);
    attach(lower.ports[0], upper.ports[1]);
    attach(lower.ports[1], em.ports[0]);
    if (["F1", "F6", "F7", "F8"].includes(code)) (segment === "upper" ? upper : lower).fault = code;
    if (["F2", "F3"].includes(code)) em.fault = code;
    if (code === "F9") screen.fault = code;
    if (["F10", "F11"].includes(code)) upper.fault = code;
    if (code === "F12") lower.fault = code;
    if (code === "F4") {
      upper.contactFault = "F4";
      upper.ports[1].joint.secured = false;
      setWorldPosition(
        lower.ports[0].group,
        worldPos(upper.ports[1]).addScaledVector(
          forward(upper.ports[1]),
          mateOffset(lower.ports[0], upper.ports[1]) + 0.12,
        ),
      );
    }
    if (code === "F5") {
      lower.contactFault = "F5";
      const j = lower.ports[1].joint;
      j.secured = false;
      j.thread = 3;
      lower.ports[1].ring.rotation.z = Math.PI;
    }
    S.circuit.key = true;
  }
  S.circuit.parts = S.parts;
  S.circuit.powerUpper = upper;
  S.parts.forEach(updateCable);
  buildBypass();
  refreshColliders();
  S.circuit.evaluate();
  updateSelected();
  resetProbeTools();
  drawMeter();
  refreshProbes();
  refreshColliders();
  keyLever.rotation.z = S.circuit.key ? -0.7 : 0;
  camera.position.set(12, 13, 22);
  controls.target.set(0, 0.6, 0);
  controls.update();
  lastCamera.copy(camera.position);
  updateLabels();
}
