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
