// Collision for rigid hardware: MK3 screen, Expansion Module, every connector, bypass
// connectors, key switch, multimeter and probes. Cables are flexible and are never
// obstacles (from 1.14). All exemptions live in exempt(); nothing else filters solids.
import * as T from "three";
import { bounds, cachedCollider as colliderOf } from "../drag-performance.js";
import { keyGroup, meter } from "./bench.js";
import { probeGroup, probeTools } from "./probe-tools.js";
import { camera, dynamic } from "./scene.js";
import { isDescendant, setWorldPosition } from "./spatial.js";
import { S } from "./state.js";

export const CAMERA_RADIUS = 0.38; // moving hardware may not enter this sphere (until step 4)
export const FLOOR_Y = -0.115; // table surface
const SWEEP_STEP = 0.02; // finer than the thinnest rigid solid (probe tip, 0.13)
const BISECT = 6; // contact precision: SWEEP_STEP / 2^6 ≈ 0.0003

// Rigid solids are meshes with userData.solid. Cable meshes carry no solids.
export function refreshColliders() {
  S.allColliders = [];
  S.pinPicks = [];
  for (const root of [dynamic, keyGroup, meter, probeGroup])
    root.traverse((m) => {
      if (m.userData.solid) S.allColliders.push(m);
      if (m.userData.pin) S.pinPicks.push(m);
    });
}

const portOf = (m) => m.userData.port || null;
// The only two exemptions: mated connector hulls, and a probe tip on the connector it measures.
function exempt(a, b) {
  const pa = portOf(a),
    pb = portOf(b);
  if (pa && pb && pa.mate === pb) return true;
  for (const [tip, other] of [
    [a, pb],
    [b, pa],
  ]) {
    if (!tip.userData.probeTip || !other) continue;
    const contact = probeTools[tip.userData.probeIndex - 1].contact;
    if (contact && (other === contact.port || other === contact.port.mate)) return true;
  }
  return false;
}

// Probes connected to a pin of the moving entity follow it, so they are not obstacles to it.
function attachedProbe(m, entity) {
  const index = m.userData.probeIndex;
  if (index === undefined) return false;
  const contact = probeTools[index - 1].contact;
  return !!contact && isDescendant(contact.port.group, entity);
}

// Snapshot of everything that does not move with `entity`. Valid while only `entity` moves.
export function collisionContext(entity) {
  entity.updateWorldMatrix(true, true);
  const moving = [],
    obstacles = [];
  for (const m of S.allColliders) {
    if (isDescendant(m, entity)) moving.push(m);
    else if (!attachedProbe(m, entity)) {
      const obb = colliderOf(m);
      obstacles.push({ m, obb, box: bounds(obb) });
    }
  }
  return { entity, moving, obstacles, ignore: new Set() };
}

const pairKey = (a, b) => a.uuid + "|" + b.uuid;
// First blocking contact at the entity's current pose, or null.
function contactAt(ctx, candidates = ctx.obstacles) {
  ctx.entity.updateWorldMatrix(true, true);
  const sphere = new T.Sphere(camera.position, CAMERA_RADIUS);
  for (const m of ctx.moving) {
    const a = colliderOf(m),
      box = bounds(a);
    if (!ctx.ignore.has(m.uuid + "|camera") && a.intersectsSphere(sphere)) return { m, other: "camera" };
    if (!ctx.ignore.has(m.uuid + "|floor") && box.min.y < FLOOR_Y) return { m, other: "floor" };
    for (const o of candidates) {
      if (!o.box.intersectsBox(box) || ctx.ignore.has(pairKey(m, o.m)) || exempt(m, o.m)) continue;
      if (a.intersectsOBB(o.obb, 1e-5)) return { m, other: o.m };
    }
  }
  return null;
}
// Lets a part that already overlaps something (e.g. after a scenario change) be pulled free.
function ignoreStartingContacts(ctx) {
  for (let hit = contactAt(ctx), guard = 0; hit && guard < 64; hit = contactAt(ctx), guard++)
    ctx.ignore.add(hit.other === "camera" || hit.other === "floor" ? hit.m.uuid + "|" + hit.other : pairKey(hit.m, hit.other));
}

export function collision(entity, sel, context = null) {
  return !!contactAt(context || collisionContext(entity));
}

// Moves `entity` from `from` along `delta` and stops at the first contact.
// Returns the fraction of `delta` travelled (1 = no contact).
export function sweepTranslation(ctx, from, delta) {
  const place = (t) => setWorldPosition(ctx.entity, from.clone().addScaledVector(delta, t));
  const length = delta.length();
  if (length < 1e-9) return 1;
  place(0);
  // Broad phase: the swept bounds of the moving solids.
  const swept = new T.Box3();
  for (const m of ctx.moving) {
    const b = bounds(colliderOf(m));
    swept.union(b).union(b.clone().translate(delta));
  }
  const cameraBox = new T.Box3().setFromCenterAndSize(camera.position, new T.Vector3(1, 1, 1).multiplyScalar(2 * CAMERA_RADIUS));
  const candidates = ctx.obstacles.filter((o) => o.box.intersectsBox(swept));
  if (!candidates.length && !swept.intersectsBox(cameraBox) && swept.min.y >= FLOOR_Y) {
    place(1);
    return 1;
  }
  const steps = Math.max(1, Math.ceil(length / SWEEP_STEP));
  let safe = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    place(t);
    if (!contactAt(ctx, candidates)) {
      safe = t;
      continue;
    }
    let lo = safe,
      hi = t;
    for (let k = 0; k < BISECT; k++) {
      const mid = (lo + hi) / 2;
      place(mid);
      if (contactAt(ctx, candidates)) hi = mid;
      else lo = mid;
    }
    place(lo);
    return lo;
  }
  return 1;
}

// Drag motion with sliding: whatever the contact blocks is retried along each world axis,
// so a part pushed against a surface glides along it instead of sticking.
export function moveWithSlide(entity, from, delta) {
  const ctx = collisionContext(entity);
  ignoreStartingContacts(ctx);
  const t = sweepTranslation(ctx, from, delta);
  if (t < 1) {
    const rest = delta.clone().multiplyScalar(1 - t),
      axes = ["x", "y", "z"].sort((a, b) => Math.abs(rest[b]) - Math.abs(rest[a]));
    for (const axis of axes) {
      if (Math.abs(rest[axis]) < 1e-4) continue;
      const step = new T.Vector3();
      step[axis] = rest[axis];
      sweepTranslation(ctx, entity.getWorldPosition(new T.Vector3()), step);
    }
  }
  return entity.getWorldPosition(new T.Vector3()).distanceTo(from) > 1e-9;
}

// Lowest point of the moving solids below the table surface (0 if none).
function floorPenetration(ctx) {
  ctx.entity.updateWorldMatrix(true, true);
  let lowest = Infinity;
  for (const m of ctx.moving) lowest = Math.min(lowest, bounds(colliderOf(m)).min.y);
  return Math.max(0, FLOOR_Y - lowest);
}

// Applies `turn(entity)` in small increments. A part tilted into the table is lifted just
// enough to rest on it; contact with any other solid cancels the whole rotation.
export function rotateChecked(entity, increments, turn) {
  const ctx = collisionContext(entity);
  ignoreStartingContacts(ctx);
  const before = entity.quaternion.clone(),
    beforePosition = entity.position.clone();
  for (let i = 0; i < increments; i++) {
    turn(entity);
    const lift = floorPenetration(ctx);
    if (lift > 0) setWorldPosition(entity, entity.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, lift + 1e-4, 0)));
    if (contactAt(ctx)) {
      entity.quaternion.copy(before);
      entity.position.copy(beforePosition);
      entity.updateWorldMatrix(true, true);
      return false;
    }
  }
  return true;
}
