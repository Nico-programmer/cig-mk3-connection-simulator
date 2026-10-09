// Selection panel, language switch, keyboard shortcuts and label refresh.
import { keyTitle } from "./bench.js";
import { nearbyPair } from "./connection.js";
import { hitboxesVisible } from "./hitboxes.js";
import { releaseDrag } from "./input.js";
import { learning } from "./learning-mount.js";
import { drawMeter, updateMeterControls } from "./meter.js";
import { rotateSelected, selectedPorts } from "./movement.js";
import { partName, portName } from "./names.js";
import { staticLabels } from "./scene.js";
import { $, tr } from "./util.js";
import { restoreCamera } from "./view.js";
import { S } from "./state.js";

export function updateSelected() {
  const orient = $("orient");
  orient.hidden = !S.selected;
  if (!S.selected) {
    $("connectAction").hidden = true;
    return;
  }
  $("selectionName").textContent = S.selected.port ? portName(S.selected.port) : partName(S.selected.part);
  const ports = selectedPorts(S.selected),
    connected = ports.some((p) => p.joint);
  orient.querySelector(".axes").style.display = connected ? "none" : "flex";
  orient.querySelector(".thread").classList.toggle("active", false);
  orient.querySelectorAll("[data-axis]").forEach((b) => (b.disabled = connected));
  $("depthText").textContent = tr("Arrastrar + rueda: profundidad", "Drag + wheel: depth");
  const pair = nearbyPair();
  $("connectAction").hidden = !connected && !pair;
  $("connectAction").textContent = connected ? tr("Desconectar", "Disconnect") : tr("Conectar", "Connect");
}
export function updateLabels() {
  learning.render();
  document.documentElement.lang = S.lang;
  $("lang").innerHTML = S.lang === "es" ? "ES <span>/ EN</span>" : "<span>ES /</span> EN";
  $("hitboxes").textContent = hitboxesVisible
    ? tr("Ocultar hitboxes", "Hide hitboxes")
    : tr("Mostrar hitboxes", "Show hitboxes");
  $("controlsText").textContent = tr(
    "Arrastrar: mover · Rueda al arrastrar: profundidad · Doble clic: inspeccionar · Esc: volver",
    "Drag: move · Wheel while dragging: depth · Double-click: inspect · Esc: return",
  );
  $("modeLabel").textContent = tr("LECCIONES DE APRENDIZAJE", "LEARNING LESSONS");
  staticLabels.forEach(({ m, es, en }) => m.userData.setText(tr(es, en)));
  keyTitle.userData.setText(tr("LLAVE", "KEY"));
  S.parts
    .filter((p) => p.lessonLabel)
    .forEach((p) => p.lessonLabel.m.userData.setText(tr(p.lessonLabel.es, p.lessonLabel.en)));
  S.parts.filter((p) => p.cameraLabel).forEach((p) => p.cameraLabel.userData.setText(tr("cámara", "camera")));
  updateSelected();
  drawMeter();
  updateMeterControls();
}
$("lang").onclick = () => {
  S.lang = S.lang === "es" ? "en" : "es";
  updateLabels();
};
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    releaseDrag();
    restoreCamera();
    S.selected = null;
    updateSelected();
  }
  if (S.selected && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
    const sign = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1;
    const threaded = selectedPorts(S.selected).some((p) => p.joint && ["circular", "em"].includes(p.kind));
    if (!threaded)
      rotateSelected(e.shiftKey ? "z" : e.key === "ArrowUp" || e.key === "ArrowDown" ? "x" : "y", sign);
  }
});
