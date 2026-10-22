// Builds the two physical probes (red / black).
import * as T from "three";
import { cylinder, material, palette } from "../geometry.js";
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
  // Straight probe like a real meter lead (1.17.1): a thin metal tip ending in a point and a slim round handle that
  // swells to a grip and tapers to the cable, nothing sticking out, so two probes fit on adjacent pins (closest pins
  // 0.205 apart).
  const tip = cylinder(g, 0.02, 0.24, palette.metal, 0, 0, 0.18);
  tip.userData.probeTip = true;
  const point = new T.Mesh(new T.ConeGeometry(0.02, 0.06, 16), material(palette.metal));
  point.rotation.x = -Math.PI / 2; // the cone's tip along -z, the way the probe points
  point.position.z = 0.03; // inside the same 0.3 as before: the contact point does not move
  point.userData.probeTip = true;
  g.add(point);
  // handle profile (radius, distance along the probe from where the metal ends)
  const grip = new T.LatheGeometry(
    [
      [0.03, 0],
      [0.045, 0.04],
      [0.052, 0.12],
      [0.055, 0.3],
      [0.052, 0.55],
      [0.04, 0.7],
      [0.038, 0.75],
    ].map(([radius, y]) => new T.Vector2(radius, y)),
    24,
  );
  const handle = new T.Mesh(grip, material(color));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.3;
  handle.castShadow = true;
  g.add(handle);
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
