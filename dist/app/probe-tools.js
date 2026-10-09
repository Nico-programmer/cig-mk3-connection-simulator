// Builds the two physical probes (red / black).
import * as T from "three";
import { box, cylinder, palette } from "../geometry.js";
import { scene } from "./scene.js";
import { V } from "./util.js";
import "./bench.js";

export const probeGroup = new T.Group();
scene.add(probeGroup);
export const probeTools = [],
  probeWires = new T.Group();
probeGroup.add(probeWires);
for (let i = 0; i < 2; i++) {
  const g = new T.Group();
  g.userData.probeIndex = i + 1;
  g.position.set(4.2 + i * 1.1, 0.22, 4.8);
  const color = i ? 0x252d35 : 0xd84132;
  const tip = cylinder(g, 0.065, 0.3, palette.metal, 0, 0, 0.15);
  tip.userData.probeTip = true;
  box(g, 0.19, 0.19, 0.75, color, 0, 0, 0.66, false);
  box(g, 0.34, 0.27, 0.1, color, 0, 0, 0.29, false);
  g.rotation.x = -Math.PI / 2;
  probeGroup.add(g);
  g.traverse((m) => {
    if (m.isMesh && m.geometry) {
      m.geometry.computeBoundingBox();
      m.userData.solid = m.geometry.boundingBox.getSize(V()).multiplyScalar(0.5);
      m.userData.solidCenter = m.geometry.boundingBox.getCenter(V());
      m.userData.probeIndex = i + 1;
    }
  });
  probeTools.push({
    group: g,
    contact: null,
  });
}
