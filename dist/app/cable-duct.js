// Cable ducts (1.22): flat covered channels on the table that hide the long taped runs of the supply cable and of
// the relay bypass cables. Only the free cables at both ends are seen, coming out of the open ends of the duct.
// Each run is a chain of straight sections with a square piece at every corner; the middle of each section is a
// solid for the cables (they lie over it, not through it), but the first and last stretches stay open so the cable
// can enter.
import * as T from "three";
import { box, material } from "../geometry.js";
import { groundAt, registerStaticSolid } from "./rope.js";
import { scene } from "./scene.js";

const HEIGHT = 0.13, // the cables (radius 0.045..0.06) lie at floor level and stay below the lid
  LID = 0.025,
  OPEN_END = 0.45, // length at each end of a run that is not a solid, so the cable can come in
  BODY = 0x253846,
  COVER = 0x33495a;

const group = new T.Group();
scene.add(group);
let built = false;

function section(a, b, width) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = Math.hypot(dx, dz),
    angle = -Math.atan2(dz, dx),
    floor = groundAt(),
    mid = new T.Vector3((a.x + b.x) / 2, floor + HEIGHT / 2, (a.z + b.z) / 2);
  const holder = new T.Group();
  holder.position.copy(mid);
  holder.rotation.y = angle;
  group.add(holder);
  // body (a trough seen from outside) and a slightly wider, lighter cover on top
  box(holder, length, HEIGHT - LID, width, BODY, 0, -LID / 2, 0, false);
  box(holder, length, LID, width * 1.1, COVER, 0, HEIGHT / 2 - LID / 2, 0, false);
  for (const mesh of holder.children) {
    mesh.raycast = () => {};
    mesh.receiveShadow = true;
  }
  if (length > 2 * OPEN_END + 0.2)
    registerStaticSolid(mid, new T.Vector3((length - 2 * OPEN_END) / 2, HEIGHT / 2, width / 2), angle);
}
function corner(p, width) {
  const m = box(group, width * 1.1, HEIGHT, width * 1.1, COVER, p.x, groundAt() + HEIGHT / 2, p.z, false);
  m.raycast = () => {};
}
// `points`: the corners of the run (x, z on the table); `width`: inner width of the channel.
export function buildDuct(points, width) {
  for (let i = 1; i < points.length; i++) section(points[i - 1], points[i], width);
  for (let i = 1; i < points.length - 1; i++) corner(points[i], width);
}
// Both runs, built once.
export function ensureDucts(supplyRoute, bypassRuns) {
  if (built) return;
  built = true;
  buildDuct(supplyRoute, 0.2);
  for (const run of bypassRuns) buildDuct(run, run.width ?? 0.7);
}
