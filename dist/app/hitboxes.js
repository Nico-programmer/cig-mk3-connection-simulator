// Debug display of the registered collision volumes.
import * as T from "three";
import { hitboxGroup, hitboxMap } from "./overlays.js";
import { $, V, tr } from "./util.js";
import { S } from "./state.js";

export let hitboxesVisible = false;
$("hitboxes").onclick = () => {
  hitboxesVisible = !hitboxesVisible;
  $("hitboxes").setAttribute("aria-pressed", String(hitboxesVisible));
  hitboxGroup.visible = hitboxesVisible;
  $("hitboxes").textContent = hitboxesVisible
    ? tr("Ocultar hitboxes", "Hide hitboxes")
    : tr("Mostrar hitboxes", "Show hitboxes");
};
export function updateHitboxes() {
  hitboxGroup.visible = hitboxesVisible;
  if (!hitboxesVisible) return;
  for (const [m, h] of hitboxMap)
    if (!S.allColliders.includes(m)) {
      h.geometry.dispose();
      h.material.dispose();
      hitboxGroup.remove(h);
      hitboxMap.delete(m);
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
  }
}
