// Multimeter logic: readings, display, mode selector and the meter control panel.
import { PINS, SIGNALS, node } from "../electrical.js";
import { dialNeedle, meter, meterCanvas, meterTexture } from "./bench.js";
import { updatePinGuidance } from "./guidance.js";
import { releaseDrag } from "./input.js";
import { learning } from "./learning-mount.js";
import { portName } from "./names.js";
import { probeTools } from "./probe-tools.js";
import {
  connectProbe,
  nearbyProbeContact,
  placeProbe,
  refreshProbes,
  removeProbe,
  selectProbe,
} from "./probes.js";
import { camera, controls } from "./scene.js";
import { $, V, tr } from "./util.js";
import { restoreCamera, startCamera } from "./view.js";
import { S } from "./state.js";

export function updateMeterExample() {
  const example = $("meterExample"),
    active = learning.active?.id === "voltage";
  example.hidden = !active;
  if (active)
    example.textContent =
      S.scenarioCode === "F1"
        ? tr("Ejemplo: alimentación del EM interrumpida", "Example: interrupted EM supply")
        : tr("Ejemplo: cadena sin falla de alimentación", "Example: no supply fault in the chain");
}
export function refreshVoltageReading() {
  if (S.meterMode !== "voltage") return;
  // Probe contacts are authoritative; never depend on a previously displayed value.
  S.probes = probeTools.filter((p) => p.contact).map((p) => p.contact);
  if (S.probes.length !== 2) {
    S.meterResult = "—";
    S.lessonMeasurement = null;
    return;
  }
  const [a, b] = probeTools.map((p) => p.contact),
    volts = S.circuit.voltage(node(a.port, a.n), node(b.port, b.n));
  S.meterResult = `${volts.toFixed(1)} V`;
  S.lessonMeasurement = {
    mode: "voltage",
    segment: pairSegment(a, b),
    signal: signalFor(a),
    sameSignal: signalFor(a) === signalFor(b),
    passes: S.circuit.continuity(node(a.port, a.n), node(b.port, b.n)),
    pins: [a, b],
    reading: S.meterResult,
  };
}
export function drawMeter() {
  refreshVoltageReading();
  updateMeterExample();
  const ctx = meterCanvas.getContext("2d");
  ctx.fillStyle = S.meterMode === "off" ? "#657b6e" : "#adc5ad";
  ctx.fillRect(0, 0, 720, 440);
  if (S.meterMode === "off") {
    meterTexture.needsUpdate = true;
    return;
  }
  ctx.fillStyle = "#172e26";
  ctx.textAlign = "left";
  ctx.font = "bold 33px monospace";
  ctx.fillText(S.meterMode === "voltage" ? "V DC" : tr("CONTINUIDAD", "CONTINUITY"), 30, 45);
  ctx.textAlign = "right";
  ctx.fillText("MK3", 690, 45);
  ctx.textAlign = "center";
  ctx.font = "bold 76px monospace";
  ctx.fillText(S.meterResult, 360, 150);
  ctx.font = "26px monospace";
  S.probes.forEach((p, i) => {
    ctx.fillStyle = i ? "#233c33" : "#69342a";
    ctx.fillText(`${i ? "COM" : "VΩ"}: ${p.port.kind} · ${p.n}`, 360, 220 + i * 42);
  });
  ctx.fillStyle = "#233c33";
  ctx.font = "24px monospace";
  if (S.meterMode === "continuity" && learning.flow.mode === "learning") {
    const steps = tr(
      ["EXTREMO A EXTREMO", "PANTALLA — MEDIO", "EM — MEDIO", "EXTREMO A EXTREMO"],
      ["END TO END", "SCREEN — MIDDLE", "EM — MIDDLE", "END TO END"],
    );
    const signal = S.probes[0] ? signalFor(S.probes[0]) : "lo";
    ctx.fillText(
      `${tr("SIG.", "NEXT")}: ${((S.testStage[signal] || 0) % 3) + 1} · ${steps[S.testStage[signal] || 0]}`,
      360,
      361,
    );
  } else if (learning.flow.mode === "learning")
    ctx.fillText(tr("Apoya las dos puntas", "Place both probes"), 360, 361);
  ctx.font = "23px monospace";
  if (learning.flow.mode === "learning")
    ctx.fillText(
      tr("Girar selector: OFF / V DC / continuidad", "Turn selector: OFF / V DC / continuity"),
      360,
      411,
    );
  meterTexture.needsUpdate = true;
}
export function signalFor(p) {
  return Object.keys(SIGNALS[p.port.kind] || {}).find((k) => SIGNALS[p.port.kind][k] === p.n);
}
export function pairSegment(a, b) {
  const kinds = [a.port.kind, b.port.kind];
  const has = (k) => kinds.includes(k);
  if ((has("orange") || has("screen")) && (has("circular") || has("em"))) return 0;
  if ((has("orange") || has("screen")) && has("up4")) return 1;
  if ((has("circular") || has("em")) && has("low4")) return 2;
  return -1;
}
export function takeProbe(pin) {
  if (!PINS[pin.port.kind]?.[pin.n]) return;
  if (S.probes.length === 2) S.probes = [];
  S.probes.push(pin);
  S.meterResult = "—";
  if (S.probes.length === 2) {
    const [a, b] = S.probes,
      an = node(a.port, a.n),
      bn = node(b.port, b.n);
    if (S.meterMode === "voltage") S.meterResult = `${S.circuit.voltage(an, bn).toFixed(1)} V`;
    else {
      const as = signalFor(a),
        bs = signalFor(b),
        s = ["lo", "hi"].includes(as) ? as : ["lo", "hi"].includes(bs) ? bs : as,
        segment = pairSegment(a, b);
      if (["lo", "hi"].includes(s) && segment >= 0) {
        const expected = S.testStage[s] || 0;
        if (segment === 0 || (segment === expected && expected < 3)) {
          const passes = S.circuit.continuity(an, bn);
          S.meterResult = passes ? tr("PASA", "PASS") : tr("NO PASA", "NO PASS");
          S.testStage[s] = segment === 0 ? (passes ? 3 : 1) : segment === 1 ? 2 : 0;
        }
      } else if (!["lo", "hi"].includes(s) || segment === -1) {
        S.meterResult = S.circuit.continuity(an, bn) ? tr("PASA", "PASS") : tr("NO PASA", "NO PASS");
      }
    }
  }
  if (S.probes.length === 2 && S.meterResult !== "—") {
    const [a, b] = S.probes;
    S.lessonMeasurement = {
      mode: S.meterMode,
      segment: pairSegment(a, b),
      signal: signalFor(a),
      sameSignal: signalFor(a) === signalFor(b),
      passes: S.circuit.continuity(node(a.port, a.n), node(b.port, b.n)),
      pins: [a, b],
      reading: S.meterResult,
    };
  }
  drawMeter();
  refreshProbes();
}
export function setMeterMode(mode) {
  if (!["off", "voltage", "continuity"].includes(mode)) return;
  S.meterMode = mode;
  S.measuring = mode !== "off";
  S.probes = [];
  S.meterResult = "—";
  dialNeedle.rotation.z = mode === "voltage" ? -0.8 : mode === "continuity" ? -1.6 : 0;
  if (probeTools.every((p) => p.contact) && S.measuring) placeProbe(0, probeTools[0].contact);
  else {
    S.probes = probeTools.filter((p) => p.contact).map((p) => p.contact);
    drawMeter();
  }
  updateMeterControls();
}
export function inspectMeter() {
  if (S.focus === "meter") {
    restoreCamera();
    return;
  }
  if (!S.returnView)
    S.returnView = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
  S.focus = "meter";
  const target = meter.localToWorld(V(0, 0.4, 0));
  startCamera(target.clone().add(V(0, 5, 5)), target);
}
export function updateMeterControls() {
  updatePinGuidance();
  $("meterTitle").textContent = tr("Multímetro", "Multimeter");
  $("modeVoltage").textContent = tr("Voltaje · V DC", "Voltage · V DC");
  $("modeContinuity").textContent = tr("Continuidad", "Continuity");
  $("modeOff").textContent = "OFF";
  for (const [id, mode] of [
    ["modeVoltage", "voltage"],
    ["modeContinuity", "continuity"],
    ["modeOff", "off"],
  ])
    $(id).setAttribute("aria-pressed", String(S.meterMode === mode));
  $("inspectMeter").textContent = tr("Ver display", "View display");
  for (let i = 0; i < 2; i++) {
    const name = i ? tr("Punta negra · COM", "Black probe · COM") : tr("Punta roja · VΩ", "Red probe · VΩ"),
      contact = probeTools[i].contact;
    $("selectProbe" + i).textContent = name;
    $("selectProbe" + i).setAttribute("aria-pressed", String(S.selectedProbe === i));
    $("removeProbe" + i).textContent = tr("Retirar", "Remove");
    $("removeProbe" + i).disabled = !contact;
    $("probeStatus" + i).textContent = contact
      ? `${portName(contact.port)} · pin ${contact.n}`
      : probeTools[i].blocked
        ? tr("Superficie: movimiento detenido", "Surface: movement stopped")
        : tr("Libre", "Free");
  }
  const candidate = nearbyProbeContact(S.selectedProbe);
  $("probeConnect").hidden = !candidate;
  $("probeConnect").textContent = tr("Conectar punta", "Connect probe");
  $("probeTarget").textContent = candidate
    ? `${portName(candidate.port)} · pin ${candidate.n} · ${PINS[candidate.port.kind][candidate.n]}${candidate.port.mate ? tr(" · acceso posterior", " · rear access") : ""}`
    : S.selectedProbe !== null && probeTools[S.selectedProbe].contact
      ? tr("Usa Retirar para cambiar de punto.", "Use Remove to change contact.")
      : tr(
          "Selecciona roja o negra. Arrástrala cerca de un pin, o pulsa el pin para acercarla.",
          "Select red or black. Drag near a pin, or click the pin to approach it.",
        );
}
$("modeVoltage").onclick = () => setMeterMode("voltage");
$("modeContinuity").onclick = () => setMeterMode("continuity");
$("modeOff").onclick = () => setMeterMode("off");
$("inspectMeter").onclick = inspectMeter;
$("probeConnect").onclick = () => {
  releaseDrag();
  connectProbe();
};
for (let i = 0; i < 2; i++) {
  $("selectProbe" + i).onclick = () => selectProbe(i);
  $("removeProbe" + i).onclick = () => removeProbe(i);
}
