// Three.js scene, camera, renderer, orbit controls, lights, table and floor labels.
import * as T from "three";
import { box, label, material } from "../geometry.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { $, V } from "./util.js";

export const scene = new T.Scene();
scene.background = new T.Color("#15232f");
scene.fog = new T.Fog("#15232f", 35, 80);
export const camera = new T.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 100);
camera.position.set(12, 13, 22);
export let renderer;
try {
  renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
} catch (e) {
  $("fatal").hidden = false;
  $("fatal").textContent =
    "WebGL no está disponible. Activa la aceleración gráfica del navegador. / WebGL is unavailable. Enable browser graphics acceleration.";
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
$("workspace").appendChild(renderer.domElement);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.minDistance = 2;
controls.maxDistance = 42;
controls.maxPolarAngle = Math.PI * 0.485;
controls.enablePan = true;
controls.rotateSpeed = 1.65;
controls.zoomSpeed = 1.8;
controls.panSpeed = 1.6;
controls.mouseButtons = {
  LEFT: T.MOUSE.ROTATE,
  MIDDLE: T.MOUSE.DOLLY,
  RIGHT: T.MOUSE.PAN,
};
scene.add(new T.HemisphereLight(0xd5e8ff, 0x172630, 2.1));
export const sun = new T.DirectionalLight(0xffeddb, 3.6);
sun.position.set(-5, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -17,
  right: 17,
  top: 15,
  bottom: -15,
  near: 1,
  far: 50,
});
sun.shadow.normalBias = 0.03;
scene.add(sun);
export const fill = new T.DirectionalLight(0x90bcff, 1.7);
fill.position.set(8, 7, -9);
scene.add(fill);
export const table = new T.Group();
scene.add(table);
box(table, 26, 0.4, 19, 0x263a47, 0, -0.33, 0);
box(table, 26, 0.08, 0.1, 0xb17f45, 0, -0.08, 9.4);
export const grid = new T.GridHelper(25, 50, 0x486172, 0x304652);
grid.position.y = -0.115;
scene.add(grid);
export const mat = new T.Mesh(new T.PlaneGeometry(16, 7.5), material(0x1b303c));
mat.rotation.x = -Math.PI / 2;
mat.position.set(0, -0.105, 0);
mat.receiveShadow = true;
scene.add(mat);
export const floor = new T.Mesh(new T.PlaneGeometry(160, 160), material(0x101b25));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1;
scene.add(floor);
export let staticLabels = [];
export function floorLabel(es, en, pos, w = 3, h = 0.35, fg = "#819bab") {
  const m = label(scene, es, w, h, pos, {
    bg: "#263a47",
    fg,
    size: 34,
  });
  m.rotation.x = -Math.PI / 2;
  staticLabels.push({
    m,
    es,
    en,
  });
  return m;
}
floorLabel("REPUESTOS", "SPARE PARTS", V(0, 0.02, -7), 5, 0.45, "#c4d3dc");
floorLabel("PIEZAS RETIRADAS", "REMOVED PARTS", V(0, 0.02, 7.6), 5, 0.4);
floorLabel("CIG / MK3", "CIG / MK3", V(-9, 0.02, -3), 2.8, 0.4, "#efaa62");
export const tray = new T.Group();
scene.add(tray);
box(tray, 21, 0.1, 3.1, 0x1b2b37, 0, -0.07, -5.45);
box(tray, 21, 0.1, 2, 0x192a35, 0, -0.07, 6.8);
for (const x of [-10.5, -5.25, 0, 5.25, 10.5]) box(tray, 0.04, 0.03, 3, 0x63717a, x, 0.01, -5.45, false);
export let lastCamera = camera.position.clone();
export const dynamic = new T.Group();
scene.add(dynamic);
