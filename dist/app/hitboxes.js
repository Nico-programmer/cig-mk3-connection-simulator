// Debug display of the registered collision volumes.
import * as T from "three";
import { hitboxGroup, hitboxMap } from "./overlays.js";
import { scene } from "./scene.js";
import { $, V, tr } from "./util.js";
import { S } from "./state.js";

export let hitboxesVisible = false;

// Size labels: one per big collider (hulls and connector blocks; pins and probe tips are too small
// and too many). They sit above the box, keep a constant screen size and show width x height x depth
// in scene units, as the collision test sees them.
const LABEL_MIN = 0.6;
const labels = new Map(); // collider -> { sprite, text }
const labelGroup = new T.Group(); // apart from hitboxGroup, which holds exactly one box per collider
scene.add(labelGroup);
const worldScale = new T.Vector3();
const labelBox = new T.Box3();
const labelCenter = new T.Vector3();

function colliderName(m) {
  const port = m.userData.port;
  const part = m.userData.part || port?.part;
  const name = port ? port.kind : part ? part.type : tr("pieza", "part");
  return part?.spare ? name + tr(" (repuesto)", " (spare)") : name;
}
function makeLabel(text) {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 56;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(6, 22, 28, 0.82)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#42e8df";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
  ctx.fillStyle = "#e6fbfa";
  ctx.font = "bold 27px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true, sizeAttenuation: false }));
  sprite.scale.set(0.13, 0.13 * (c.height / c.width), 1);
  sprite.renderOrder = 1001;
  sprite.raycast = () => {};
  return sprite;
}
function dropLabel(m) {
  const l = labels.get(m);
  if (!l) return;
  l.sprite.material.map.dispose();
  l.sprite.material.dispose();
  labelGroup.remove(l.sprite);
  labels.delete(m);
}
$("hitboxes").onclick = () => {
  hitboxesVisible = !hitboxesVisible;
  $("hitboxes").setAttribute("aria-pressed", String(hitboxesVisible));
  hitboxGroup.visible = labelGroup.visible = hitboxesVisible;
  $("hitboxes").textContent = hitboxesVisible
    ? tr("Ocultar hitboxes", "Hide hitboxes")
    : tr("Mostrar hitboxes", "Show hitboxes");
};
export function updateHitboxes() {
  hitboxGroup.visible = labelGroup.visible = hitboxesVisible;
  if (!hitboxesVisible) return;
  for (const [m, h] of hitboxMap)
    if (!S.allColliders.includes(m)) {
      h.geometry.dispose();
      h.material.dispose();
      hitboxGroup.remove(h);
      hitboxMap.delete(m);
      dropLabel(m);
    }
  for (const m of S.allColliders) {
    let h = hitboxMap.get(m);
    if (!h) {
      h = new T.LineSegments(
        new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)),
        new T.LineBasicMaterial({
          color: 0x42e8df,
          depthTest: false,
          transparent: true,
          opacity: 0.8,
        }),
      );
      h.renderOrder = 1000;
      hitboxGroup.add(h);
      hitboxMap.set(m, h);
    }
    m.updateWorldMatrix(true, false);
    h.matrixAutoUpdate = false;
    h.matrix
      .copy(m.matrixWorld)
      .multiply(new T.Matrix4().makeTranslation(...(m.userData.solidCenter || V()).toArray()))
      .multiply(new T.Matrix4().makeScale(...m.userData.solid.clone().multiplyScalar(2).toArray()));
    h.matrixWorldNeedsUpdate = true;
    // Size label for the big boxes.
    worldScale.setFromMatrixScale(m.matrixWorld);
    const size = m.userData.solid.clone().multiplyScalar(2).multiply(worldScale);
    if (Math.max(size.x, size.y, size.z) < LABEL_MIN) {
      dropLabel(m);
      continue;
    }
    const text = `${colliderName(m)} ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}`;
    let l = labels.get(m);
    if (!l || l.text !== text) {
      dropLabel(m);
      l = { sprite: makeLabel(text), text };
      labelGroup.add(l.sprite);
      labels.set(m, l);
    }
    h.updateWorldMatrix(false, false);
    labelBox.setFromObject(h);
    labelBox.getCenter(labelCenter);
    l.sprite.position.set(labelCenter.x, labelBox.max.y, labelCenter.z);
  }
}
