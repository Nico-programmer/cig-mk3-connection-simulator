// Physical bench instruments: key switch, multimeter body/display and floor notices.
import * as T from "three";
import { box, cylinder, label } from "../geometry.js";
import { floorLabel, scene } from "./scene.js";
import { V } from "./util.js";
import "./scene.js";

// Physical instruments and documented notices are part of the bench, not side panels.
export const keyGroup = new T.Group();
keyGroup.position.set(-9, 0.1, 3.7);
keyGroup.rotation.x = -Math.PI / 2;
scene.add(keyGroup);
box(keyGroup, 1.6, 1.8, 0.26, 0x142530);
cylinder(keyGroup, 0.28, 0.13, 0xa2adb4, 0, 0.03, 0.19);
export const keyLever = new T.Group();
keyLever.position.set(0, 0.03, 0.28);
keyGroup.add(keyLever);
box(keyLever, 0.12, 0.51, 0.08, 0xc8d3d9, 0, 0.17, 0, false);
box(keyLever, 0.48, 0.22, 0.14, 0x121b22, 0, 0.48, 0, false);
keyGroup.traverse((m) => {
  if (m.isMesh) m.userData.action = "key";
});
label(keyGroup, "OFF     ON", 1.25, 0.22, V(0, 0.64, 0.145), {
  bg: "#142530",
  fg: "#eff3f4",
  size: 28,
});
export const keyTitle = label(keyGroup, "LLAVE", 1.2, 0.24, V(0, -0.59, 0.145), {
  bg: "#142530",
  fg: "#a8c1d0",
  size: 30,
});
export const meter = new T.Group();
meter.position.set(6.7, 0.93, 4.75);
meter.rotation.x = -Math.PI * 0.37;
scene.add(meter);
box(meter, 2.35, 3.45, 0.45, 0xc89635);
box(meter, 2.13, 3.21, 0.06, 0x23333c, 0, 0, 0.26);
export const meterCanvas = document.createElement("canvas");
meterCanvas.width = 720;
meterCanvas.height = 440;
export const meterTexture = new T.CanvasTexture(meterCanvas);
meterTexture.colorSpace = T.SRGBColorSpace;
export const meterDisplay = new T.Mesh(
  new T.PlaneGeometry(1.86, 1.17),
  new T.MeshBasicMaterial({
    map: meterTexture,
  }),
);
meterDisplay.position.set(0, 0.77, 0.3);
meter.add(meterDisplay);
meterDisplay.userData.action = "meterFocus";
export const dial = cylinder(meter, 0.36, 0.13, 0x111b21, 0, -0.52, 0.34);
dial.userData.action = "meter";
export const dialNeedle = box(meter, 0.08, 0.4, 0.035, 0xd5e3e9, 0, -0.4, 0.43, false);
dialNeedle.userData.action = "meter";
label(meter, "OFF     V DC     ◇", 1.8, 0.23, V(0, -0.02, 0.31), {
  bg: "#23333c",
  fg: "#e9eef1",
  size: 28,
});
label(meter, "COM                  V / Ω", 1.8, 0.21, V(0, -1.19, 0.31), {
  bg: "#23333c",
  fg: "#dae2e6",
  size: 29,
});
for (const x of [-0.63, 0.63]) cylinder(meter, 0.11, 0.06, x < 0 ? 0x0d171e : 0xc74935, x, -1.44, 0.32);
// Banana plugs (1.18.1): right-angle plugs, as on real test leads. Each enters its jack,
// turns 90° and runs along the face toward the meter's lower left corner (where the bench
// and the probes are), so the lead leaves level with the face just past the lower edge and
// simply drops: it never arches up over the jacks and the two leads never cross.
// The two plug bodies are rigid solids (tagged `leadPlug`), so the other lead lies on them.
// plugs[i] is the plug of lead i (0 = red, V/Ω; 1 = black, COM); its local -y is the exit.
export const PLUG_EXIT = V(0, -0.56, 0.52), // where the lead leaves the boot (plug-local)
  plugs = [0.63, -0.63].map((x, lead) => {
    const color = lead ? 0x151b20 : 0xd84132,
      g = new T.Group();
    g.position.set(x, -1.44, 0);
    g.rotation.z = -0.694; // local -y toward (-0.64, -0.77) on the face
    meter.add(g);
    const stem = cylinder(g, 0.09, 0.26, color, 0, 0, 0.45); // into the jack
    stem.userData.leadPlug = lead;
    const elbow = new T.Mesh(new T.SphereGeometry(0.09, 20, 14), stem.material);
    elbow.position.set(0, 0, 0.58);
    elbow.castShadow = true;
    g.add(elbow);
    const body = cylinder(g, 0.085, 0.38, color, 0, -0.2, 0.55); // along the face
    body.rotation.x = 0;
    body.userData.leadPlug = lead;
    for (const [r, len, y] of [
      [0.07, 0.1, -0.44],
      [0.05, 0.06, -0.52],
    ]) {
      const boot = cylinder(g, r, len, color, 0, y, 0.53);
      boot.rotation.x = 0;
      delete boot.userData.solid;
    }
    return g;
  });
export const meterCaption = floorLabel("MULTÍMETRO", "MULTIMETER", V(6.7, 0.02, 6.4), 3, 0.35);
export const notice = floorLabel(
  "10–30 V DC · >30 V: usar convertidor",
  "10–30 V DC · >30 V: use a converter",
  V(-4, 0.03, 4.8),
  6.2,
  0.4,
  "#e4af72",
);
export const bypassWarning = floorLabel(
  "BYPASS · Solo técnicos autorizados y supervisores",
  "BYPASS · Authorized technicians and supervisors only",
  V(-8, 0.03, 2.45),
  5.4,
  0.35,
  "#d8ac78",
);
