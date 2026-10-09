// Bench side of the lessons: prepares each lesson scenario and answers its step checks.
import { label } from "../geometry.js";
import { keyLever } from "./bench.js";
import { refreshCables } from "./cables.js";
import { align, attach } from "./connection.js";
import { releaseDrag } from "./input.js";
import { learning } from "./learning-mount.js";
import { setMeterMode } from "./meter.js";
import { probeTools } from "./probe-tools.js";
import { buildScenario, workParts } from "./scenario.js";
import { staticLabels } from "./scene.js";
import { setWorldPosition, setWorldQuaternion } from "./spatial.js";
import { updateLabels } from "./ui.js";
import { Q, V, tr } from "./util.js";
import { S } from "./state.js";

export let lessonEvents = new Set(),
  swapParts = null;
export function prepareLesson(code, variant = "screen") {
  releaseDrag();
  S.lessonMeasurement = null;
  lessonEvents.clear();
  swapParts = null;
  const swap = code === "swap",
    middleExample = code === "continuityFault";
  buildScenario(
    swap
      ? variant === "vehicle"
        ? "F3"
        : "F9"
      : middleExample
        ? variant === "middleUnsecured"
          ? "F4"
          : "healthy"
        : code,
    "lower",
  );
  if (middleExample) {
    const upper = workParts[1];
    if (variant === "middleUnsecured") upper.contactFault = null;
    else upper.ports[1].openContactPins = new Set([3]);
  }
  setMeterMode("off");
  S.circuit.key = false;
  keyLever.rotation.z = 0;
  S.circuit.evaluate();
  if (code === "F2") {
    for (const p of S.parts.filter((p) => p.type === "em")) p.hasBeenPowered = false;
    S.circuit.previousPower.clear();
  }
  staticLabels[0].es = swap ? "VEHÍCULO DE REFERENCIA" : "REPUESTOS";
  staticLabels[0].en = swap ? "REFERENCE VEHICLE" : "SPARE PARTS";
  if (swap) {
    const [suspect, upper, lower, em, good, refUpper, refLower, refEM] = S.parts;
    align(refUpper.ports[0], good.ports[0]);
    setWorldPosition(refUpper.ports[1].group, V(-0.55, 0.85, -5.3));
    setWorldQuaternion(refUpper.ports[1].group, Q(0, Math.PI / 2, 0));
    align(refLower.ports[0], refUpper.ports[1]);
    align(refLower.ports[1], refEM.ports[0]);
    attach(refUpper.ports[0], good.ports[0]);
    attach(refLower.ports[0], refUpper.ports[1]);
    attach(refLower.ports[1], refEM.ports[0]);
    S.circuit.supplyUppers = [upper, refUpper];
    swapParts = {
      suspect,
      good,
      upper,
      refUpper,
    };
    for (const [p, es, en] of [
      [suspect, "PANTALLA SOSPECHOSA", "SUSPECT SCREEN"],
      [good, "PANTALLA CONOCIDA BUENA", "KNOWN-GOOD SCREEN"],
    ]) {
      const m = label(p.root, tr(es, en), 3, 0.27, V(0, 2.45, 0.35), {
        bg: "#102330",
        fg: "#ffbd85",
        size: 27,
      });
      p.lessonLabel = {
        m,
        es,
        en,
      };
    }
    refreshCables();
  }
  S.circuit.evaluate();
  updateLabels();
  learning.tick();
}
export function lessonCheck(check) {
  const [screen, upper, lower, em] = workParts;
  if (!screen) return false;
  const joined = (p) => !!p.joint?.secured,
    open = (p) => !p.joint;
  const end = (signal) =>
    S.lessonMeasurement?.mode === "continuity" &&
    S.lessonMeasurement.sameSignal &&
    S.lessonMeasurement.signal === signal;
  const reading = (segment, signal, passes) =>
    end(signal) && S.lessonMeasurement.segment === segment && S.lessonMeasurement.passes === passes;
  const voltage = (value) =>
    S.lessonMeasurement?.mode === "voltage" &&
    S.lessonMeasurement.reading === value &&
    S.lessonMeasurement.pins.every((p) => p.port === em.ports[0] || p.port === lower.ports[1]) &&
    S.lessonMeasurement.pins.some((p) => p.n === 7) &&
    S.lessonMeasurement.pins.some((p) => p.n === 8);
  switch (check) {
    case "observe":
      return true;
    case "keyOn":
      return S.circuit.key;
    case "keyOff":
      return !S.circuit.key;
    case "restarted":
      return S.circuit.key && S.circuit.evaluate().ems[em.id] === "blink";
    case "screenJoint":
      return joined(upper.ports[0]);
    case "middleJoint":
      return joined(lower.ports[0]);
    case "emJoint":
      return joined(lower.ports[1]);
    case "allJoints":
      return upper.ports.every(joined) && lower.ports.every(joined);
    case "screenOpen":
      return open(upper.ports[0]);
    case "middleOpen":
      return open(lower.ports[0]);
    case "emOpen":
      return open(lower.ports[1]);
    case "voltage12":
      return voltage("12.0 V");
    case "voltage0":
      return voltage("0.0 V");
    case "probesFree":
      return probeTools.every((p) => !p.contact);
    case "continuityMode":
      return !S.circuit.key && S.meterMode === "continuity";
    case "endLoPass":
      return !S.circuit.key && reading(0, "lo", true);
    case "endHiPass":
      return !S.circuit.key && reading(0, "hi", true);
    case "endLoFail":
      return !S.circuit.key && reading(0, "lo", false);
    case "upperLoPass":
      return !S.circuit.key && reading(1, "lo", true);
    case "lowerLoPass":
      return !S.circuit.key && reading(2, "lo", true);
    case "lowerLoFail":
      return !S.circuit.key && reading(2, "lo", false);
    case "inspectOrange":
      return S.focus === upper.ports[0] && open(upper.ports[0]);
    case "inspectUpper":
      return S.focus === upper.ports[1] && open(upper.ports[1]);
    case "inspectLower":
      return S.focus === lower.ports[0] && open(lower.ports[0]);
    case "inspectCircular":
      return S.focus === lower.ports[1] && open(lower.ports[1]);
    case "swapOpen":
      return (
        !!swapParts &&
        !S.circuit.key &&
        probeTools.every((p) => !p.contact) &&
        open(swapParts.upper.ports[0]) &&
        open(swapParts.refUpper.ports[0])
      );
    case "screensMoved":
      return !!swapParts && swapParts.good.root.position.z > -2 && swapParts.suspect.root.position.z < -3;
    case "swapGood":
      return !!swapParts && swapParts.upper.ports[0].mate === swapParts.good.ports[0];
    case "swapSuspect":
      return !!swapParts && swapParts.refUpper.ports[0].mate === swapParts.suspect.ports[0];
    case "bypassBlack":
      return open(S.bypassPorts[0]) && open(S.bypassPorts[1]);
    case "bypassStripe":
      return open(S.bypassPorts[2]) && open(S.bypassPorts[3]);
    case "bypassJoined":
      return S.bypassPorts[0].mate === S.bypassPorts[2] && joined(S.bypassPorts[0]);
    default:
      return false;
  }
}
