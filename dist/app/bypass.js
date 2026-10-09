// Relay-1 bypass connectors and their cables.
import * as T from "three";
import { curveFor, pathKey, updateTube } from "../drag-performance.js";
import { box, cable } from "../geometry.js";
import { cableVolumes } from "./colliders.js";
import { attach } from "./connection.js";
import { workParts } from "./scenario.js";
import { dynamic, scene } from "./scene.js";
import { forward, setWorldPosition, setWorldQuaternion, worldPos, worldQ } from "./spatial.js";
import { Q, V } from "./util.js";
import { S } from "./state.js";

export function buildBypass() {
  S.bypassPorts = [];
  const bp = {
    id: "bypass",
    type: "bypass",
    root: new T.Group(),
    ports: [],
    fault: null,
  };
  dynamic.add(bp.root);
  bp.root.userData.part = bp;
  for (let i = 0; i < 4; i++) {
    const kind = ["vehicleA", "relayA", "vehicleB", "relayB"][i],
      g = new T.Group();
    g.position.set(-9 + (i % 2) * 0.43, 0.5, -0.2 + Math.floor(i / 2) * 1.1);
    g.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
    bp.root.add(g);
    const p = {
      id: kind,
      kind,
      part: bp,
      group: g,
      pins: [],
      colliders: [],
    };
    g.userData.port = p;
    box(g, 0.32, 0.32, 0.47, i % 2 ? 0x3288aa : 0x3881ad, 0, 0, -0.1);
    const latch = box(g, 0.18, 0.07, 0.21, 0x7db9d0, 0, 0.185, -0.08);
    latch.userData.latch = p;
    g.traverse((m) => {
      if (m.isMesh) m.userData.port = p;
      if (m.userData.solid) p.colliders.push(m);
    });
    bp.ports.push(p);
    S.bypassPorts.push(p);
  }
  alignBypass(S.bypassPorts[0], S.bypassPorts[1]);
  alignBypass(S.bypassPorts[2], S.bypassPorts[3]);
  attach(S.bypassPorts[0], S.bypassPorts[1]);
  attach(S.bypassPorts[2], S.bypassPorts[3]);
  updateBypassCables();
}
export function alignBypass(a, b) {
  setWorldQuaternion(a.group, worldQ(b).multiply(Q(0, Math.PI, 0)));
  setWorldPosition(a.group, worldPos(b).addScaledVector(forward(b), 0.14));
}
export let bypassCables = [];
export function updateBypassCables() {
  let at = 0;
  for (let i = 0; i < S.bypassPorts.length; i++) {
    const p = S.bypassPorts[i],
      a = worldPos(p).addScaledVector(forward(p), -0.35),
      b =
        i % 2
          ? worldPos(workParts[2].ports[1]).addScaledVector(forward(workParts[2].ports[1]), -0.48)
          : V(-10.7, 0.1, i < 2 ? -0.4 : 0.8);
    const path =
      i % 2
        ? [a, V(-7, 0.14, 4.1 + i * 0.18), V(3, 0.14, 4.1 + i * 0.18), b]
        : [
            a,
            a
              .clone()
              .lerp(b, 0.5)
              .add(V(0, -0.15, 0.2)),
            b,
          ];
    function sync(points, color, radius, stripe) {
      const key = pathKey(points);
      let m = bypassCables[at];
      if (!m) {
        m = cable(points, color, radius);
        scene.add(m);
        bypassCables[at] = m;
      } else if (m.userData.pathKey !== key) updateTube(m, curveFor(points));
      if (!stripe) {
        m.userData.bypassPort = p;
        if (m.userData.pathKey !== key) cableVolumes(m, "bypass");
      }
      m.userData.pathKey = key;
      at++;
    }
    if (i === 3)
      sync(
        path.map((p) => p.clone().add(V(0, 0.04, 0))),
        0xbcc1c3,
        0.012,
        true,
      );
    sync(path, 0x10191e, 0.045, false);
  }
}
