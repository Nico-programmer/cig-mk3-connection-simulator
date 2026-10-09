// Flexible cable simulated as a chain of particles (position-based dynamics, Verlet).
// Used for the meter leads (1.16); the harness and bypass cables will reuse it.
//
// Safeguards against the "giant loop" failure of earlier attempts:
//  - fixed 1/120 s sub-steps, frame time capped at 1/30 s;
//  - per-step displacement capped; NaN or runaway state resets the rope;
//  - an end that jumps (scenario change, probe reset) re-lays the rope instead of whipping it;
//  - rest length always >= the distance between the ends, so constraints never fight;
//  - the rope sleeps (zero cost) when its ends and its surroundings are still.
import * as T from "three";
import { cachedCollider as colliderOf } from "../drag-performance.js";
import { material } from "../geometry.js";
import { OBB } from "../vendor/OBB.js";
import { S } from "./state.js";

const STEP = 1 / 120,
  MAX_FRAME = 1 / 30,
  GRAVITY = -175, // 9.8 m/s² in scene units (1 unit ≈ 5.6 cm)
  DAMPING = 0.985,
  ITERATIONS = 14,
  BEND = 0.08,
  FRICTION = 0.6,
  CONTACT_KEEP = 0.2,
  TENSION_STEPS = 30, // sub-steps of lasting tension before cable pays out (0.25 s)
  SNAG_STEPS = 12, // sub-steps a single segment may stay caught before it slips free
  GHOST_STEPS = 30, // sub-steps a freed pair passes through solids (0.25 s)
  PAYOUT_LIMIT = 1.6, // paid-out cable never exceeds 1.6 x the nominal length
  RELAX_STEPS = 120, // a second without tension gives paid-out cable back
  MAX_MOVE = 0.3,
  JUMP = 2.5,
  SLEEP_FRAMES = 20, // frames without visible motion before the rope sleeps
  STILL = 5e-3, // largest per-frame particle motion that counts as still (0.3 mm, invisible)
  IDLE_CHECK = 6, // a sleeping rope checks its surroundings every 6th frame (0.1 s)
  RADIAL = 8;

// Surface under the cables: one continuous height (the mat; the table top is only 2.5 mm
// lower). Steps such as the trays are solid boxes below, never a jump in this height: a
// height step launches a sliding particle upward and starts an endless bounce.
export function groundAt() {
  return -0.105;
}
// The two parts trays on the table (scene.js: tray boxes), as solids for the cables.
const STATIC_SOLIDS = [
  [0, -0.07, -5.45, 10.5, 0.05, 1.55],
  [0, -0.07, 6.8, 10.5, 0.05, 1],
].map(([x, y, z, hx, hy, hz]) => {
  const obb = new OBB(new T.Vector3(x, y, z), new T.Vector3(hx, hy, hz), new T.Matrix3());
  return { obb, inverse: new T.Matrix3() };
});

// ---- Cable-to-cable contact (1.18.1) ----
// Every live rope and every static cable piece (e.g. the taped bypass runs) is registered.
// Once per frame each rope's bounding box is refreshed; a moving rope then keeps each of its
// segments at least (r1 + r2) away from the segments of the cables whose box touches its own,
// so cables lie on and beside each other instead of passing through. Cables far apart cost
// one box test.
const ROPES = new Set(),
  STATIC_PIECES = [],
  PIECE = 0.4; // static runs are split into pieces this long, so each has a tight box
export function registerStaticCable(a, b, radius) {
  const parts = Math.max(1, Math.ceil(a.distanceTo(b) / PIECE));
  for (let k = 0; k < parts; k++) {
    const pa = a.clone().lerp(b, k / parts),
      pb = a.clone().lerp(b, (k + 1) / parts);
    STATIC_PIECES.push({ rope: null, a: pa, b: pb, radius, box: boxOf([pa, pb], 0) });
  }
}
function boxOf(points, pad, out = new Float64Array(6)) {
  out.fill(Infinity, 0, 3).fill(-Infinity, 3, 6);
  for (const p of points) {
    if (p.x < out[0]) out[0] = p.x;
    if (p.y < out[1]) out[1] = p.y;
    if (p.z < out[2]) out[2] = p.z;
    if (p.x > out[3]) out[3] = p.x;
    if (p.y > out[4]) out[4] = p.y;
    if (p.z > out[5]) out[5] = p.z;
  }
  for (let k = 0; k < 3; k++) (out[k] -= pad), (out[k + 3] += pad);
  return out;
}
const overlap = (A, B, pad) =>
  A[0] - pad <= B[3] && B[0] - pad <= A[3] && A[1] - pad <= B[4] && B[1] - pad <= A[4] && A[2] - pad <= B[5] && B[2] - pad <= A[5];
function isLive(rope) {
  for (let o = rope.mesh; o; o = o.parent) if (o.isScene) return true;
  return false;
}
let boxesDirty = true,
  frameId = 0;
// Marks the boxes stale; they are refreshed lazily by the first awake rope that needs them,
// so a frame where every cable sleeps costs nothing here.
export function beginRopeFrame() {
  boxesDirty = true;
  frameId++;
}
function refreshBoxes() {
  boxesDirty = false;
  for (const rope of ROPES) {
    if (!isLive(rope)) {
      ROPES.delete(rope);
      continue;
    }
    rope.box = boxOf(rope.pos, rope.radius, rope.box);
  }
}
const MARGIN = 0.15, // candidates are gathered once per frame; this covers a frame's motion
  CHUNK = 8; // segments per chunk when listing candidates
// Closest points between segments p0p1 and q0q1 (scalar math, no allocation): writes the
// parameters into out[0] (along p) and out[1] (along q).
function closestParams(p0, p1, q0, q1, out) {
  const d1x = p1.x - p0.x, d1y = p1.y - p0.y, d1z = p1.z - p0.z,
    d2x = q1.x - q0.x, d2y = q1.y - q0.y, d2z = q1.z - q0.z,
    rx = p0.x - q0.x, ry = p0.y - q0.y, rz = p0.z - q0.z,
    a = d1x * d1x + d1y * d1y + d1z * d1z,
    e = d2x * d2x + d2y * d2y + d2z * d2z,
    f = d2x * rx + d2y * ry + d2z * rz,
    c = d1x * rx + d1y * ry + d1z * rz,
    b = d1x * d2x + d1y * d2y + d1z * d2z,
    clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  let s = 0,
    t = 0;
  if (a > 1e-12 && e > 1e-12) {
    const denom = a * e - b * b;
    s = denom > 1e-12 ? clamp((b * f - c * e) / denom) : 0;
    t = (b * s + f) / e;
    if (t < 0) (t = 0), (s = clamp(-c / a));
    else if (t > 1) (t = 1), (s = clamp((b - c) / a));
  } else if (a > 1e-12) s = clamp(-c / a);
  else if (e > 1e-12) t = clamp(f / e);
  out[0] = s;
  out[1] = t;
}
const ST = [0, 0],
  V3 = (x, y, z) => new T.Vector3(x, y, z);

export class Rope {
  // getEnds(): { a, aDir, b, bDir } world points and the directions the cable leaves them.
  // lengthFor(distance): rest length for a given end-to-end distance.
  // ignores(mesh): solids this rope passes (e.g. the probe it is attached to).
  constructor({ count = 64, radius, color, getEnds, lengthFor, maxLength = Infinity, ignores = () => false, floorLayout = false }) {
    this.n = count;
    this.floorLayout = floorLayout;
    this.maxLength = maxLength;
    ROPES.add(this);
    this.radius = radius;
    this.getEnds = getEnds;
    this.lengthFor = lengthFor;
    this.ignores = ignores;
    this.pos = Array.from({ length: count }, () => new T.Vector3());
    this.prev = Array.from({ length: count }, () => new T.Vector3());
    this.contact = new Uint8Array(count);
    this.ghost = new Uint8Array(count);
    this.length = 0;
    this.sleep = 0;
    this.paidOut = 0;
    this.lastEnds = null;
    this.signature = "";
    this.segments = (count - 1) * 2;
    const ends = getEnds();
    this.layout(ends);
    this.curve = new T.CatmullRomCurve3(this.pos.map((p) => p.clone()), false, "centripetal");
    this.mesh = new T.Mesh(new T.TubeGeometry(this.curve, this.segments, radius, RADIAL, false), material(color));
    this.mesh.castShadow = true;
    this.mesh.raycast = () => {};
    this.mesh.frustumCulled = false;
    this.layout(ends);
    this.render();
  }
  points() {
    return this.pos.map((p) => p.clone());
  }
  wake() {
    this.sleep = 0;
  }
  // Lays the rope along an arc *above* the ends (used at start and after a jump); it then
  // drops into place under gravity, so a fresh layout never starts inside a solid.
  // A `floorLayout` rope (bench wiring) is laid instead straight down from each end and along
  // the table between them, so it never lands draped over the connectors it runs past.
  layout(ends) {
    const { a, b } = ends,
      d = a.distanceTo(b);
    this.length = Math.max(this.lengthFor(d), d);
    const rise = Math.sqrt(Math.max(this.length * this.length - d * d, 0)) * 0.45,
      floor = groundAt() + this.radius,
      path = this.floorLayout && [a, V3(a.x, floor, a.z), V3(b.x, floor, b.z), b],
      legs = path && [1, 2, 3].map((k) => path[k].distanceTo(path[k - 1])),
      total = legs && legs[0] + legs[1] + legs[2];
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1),
        p = this.pos[i];
      if (path && total > 1e-6) {
        let s = t * total,
          k = 0;
        while (k < 2 && s > legs[k]) s -= legs[k++];
        p.copy(path[k]).lerp(path[k + 1], legs[k] > 1e-9 ? s / legs[k] : 0);
      } else {
        p.copy(a).lerp(b, t);
        p.y += rise * Math.sin(Math.PI * t);
      }
      p.y = Math.max(p.y, groundAt(p.x, p.z) + this.radius);
      this.prev[i].copy(p);
    }
    this.pinEnds(ends);
    // Settle the fresh layout against the solids before it is ever drawn.
    if (this.curve) {
      const solids = this.candidates(),
        seg = this.length / (this.n - 1);
      for (let k = 0; k < 40; k++) {
        for (let i = 0; i < this.n - 1; i++) this.satisfy(i, i + 1, seg, 1);
        for (let i = 2; i < this.n - 2; i++) this.collide(i, solids);
      }
      this.inextensible(seg);
      for (let i = 0; i < this.n; i++) this.prev[i].copy(this.pos[i]);
    }
    this.lastEnds = { a: a.clone(), b: b.clone() };
    this.sleep = 0;
  }
  pinEnds({ a, aDir, b, bDir }) {
    const seg = this.length / (this.n - 1),
      last = this.n - 1;
    this.pos[0].copy(a);
    this.pos[1].copy(a).addScaledVector(aDir, seg);
    this.pos[last].copy(b);
    this.pos[last - 1].copy(b).addScaledVector(bDir, seg);
    for (const i of [0, 1, last - 1, last]) this.prev[i].copy(this.pos[i]);
  }
  // Rigid solids near the rope, with their world OBBs.
  candidates() {
    const box = new T.Box3();
    for (const p of this.pos) box.expandByPoint(p);
    box.expandByScalar(this.radius + 0.6);
    const out = [];
    for (const m of S.allColliders) {
      if (this.ignores(m)) continue;
      const obb = colliderOf(m),
        r = obb.halfSize.length();
      if (box.distanceToPoint(obb.center) <= r) out.push({ obb, inverse: obb.rotation.clone().transpose() });
    }
    for (const solid of STATIC_SOLIDS)
      if (box.distanceToPoint(solid.obb.center) <= solid.obb.halfSize.length()) out.push(solid);
    return out;
  }
  collide(i, solids) {
    if (this.ghost[i]) return; // slipping out of a crevice
    const p = this.pos[i],
      r = this.radius;
    let hit = false;
    const ground = groundAt(p.x, p.z) + r;
    // resting exactly on the table counts as contact too, so cable lying there keeps its
    // friction (without the tolerance it slid freely and could creep across the table forever)
    if (p.y < ground + 1e-3) {
      if (p.y < ground) p.y = ground;
      hit = true;
    }
    for (const { obb, inverse } of solids) {
      const local = p.clone().sub(obb.center).applyMatrix3(inverse),
        h = obb.halfSize;
      const px = h.x + r - Math.abs(local.x),
        py = h.y + r - Math.abs(local.y),
        pz = h.z + r - Math.abs(local.z);
      if (px <= 0 || py <= 0 || pz <= 0) continue;
      // Push out through a face the particle could have come in by (it was outside that face
      // at its previous position), choosing the one needing the smallest push. Thin solids
      // such as the meter body cannot be crossed; at an edge the cable climbs onto the top
      // instead of being shoved back to the side. Otherwise: least penetration.
      const before = this.prev[i].clone().sub(obb.center).applyMatrix3(inverse),
        depth = { x: px, y: py, z: pz };
      let axis = null,
        climb = null;
      for (const k of ["x", "y", "z"]) {
        if (Math.abs(before[k]) <= h[k] + r - 1e-9) continue;
        if (!axis || depth[k] < depth[axis]) axis = k;
        // A step lower than the cable's radius is ridden over, as a real cable would.
        const up = obb.rotation.elements[{ x: 1, y: 4, z: 7 }[k]] * Math.sign(before[k]);
        if (up > 0.5 && depth[k] <= r) climb = k;
      }
      if (climb) axis = climb;
      if (axis) local[axis] = Math.sign(before[axis]) * (h[axis] + r);
      else if (px <= py && px <= pz) local.x = Math.sign(local.x || 1) * (h.x + r);
      else if (py <= pz) local.y = Math.sign(local.y || 1) * (h.y + r);
      else local.z = Math.sign(local.z || 1) * (h.z + r);
      p.copy(local.applyMatrix3(obb.rotation).add(obb.center));
      hit = true;
    }
    // Inelastic, frictional contact: a particle that touches something keeps only a little
    // of its velocity, so resting cable stays put instead of vibrating against the surface.
    if (hit) this.prev[i].lerp(p, 1 - CONTACT_KEEP);
    this.contact[i] = hit ? 1 : 0;
  }
  // Advances the simulation by `dt` seconds of real time and refreshes the mesh.
  update(dt) {
    const ends = this.getEnds(),
      jumped =
        !this.lastEnds ||
        ends.a.distanceTo(this.lastEnds.a) > JUMP ||
        ends.b.distanceTo(this.lastEnds.b) > JUMP;
    if (jumped) {
      this.layout(ends);
      this.render();
      return;
    }
    const endsMoved = ends.a.distanceTo(this.lastEnds.a) > 1e-6 || ends.b.distanceTo(this.lastEnds.b) > 1e-6,
      fromEnds = this.lastEnds,
      endTravel = Math.max(ends.a.distanceTo(fromEnds.a), ends.b.distanceTo(fromEnds.b));
    this.lastEnds = { a: ends.a.clone(), b: ends.b.clone() };
    // Asleep and ends still: look for solids moved onto the cable only every few frames.
    if (this.sleep >= SLEEP_FRAMES && !endsMoved && (this.idleTick = ((this.idleTick || 0) + 1) % IDLE_CHECK)) return;
    const solids = this.candidates(),
      signature = solids.map(({ obb: o }) => o.center.toArray().map((v) => v.toFixed(4)).join(",")).join(";");
    if (endsMoved || signature !== this.signature) this.sleep = 0;
    this.signature = signature;
    // Length follows the end distance with slack: paid out at once when needed, reeled in
    // gently otherwise - but never below what a solid recently demanded (`paidOut`, forgotten
    // as soon as an end moves), so reeling in and paying out cannot chase each other.
    const d = ends.a.distanceTo(ends.b),
      wanted = Math.max(this.lengthFor(d), d * 1.02);
    this.wanted = wanted;
    // Extra cable paid out for a solid is given back once the cable has been free of tension
    // for a second, so payouts can never accumulate into loose loops.
    if (endsMoved || (this.quiet || 0) > RELAX_STEPS) this.paidOut = 0;
    const target = Math.max(wanted, this.paidOut);
    if (target > this.length) this.length = target;
    else if (this.length - target < 0.01) this.length = target;
    else this.length += (target - this.length) * 0.05;
    if (Math.abs(this.length - target) > 1e-9) this.sleep = 0; // still reeling: stay awake
    if (this.sleep >= SLEEP_FRAMES) return;
    const start = this.pos.map((p) => p.clone());
    // A fast drag moves an end a long way in one frame: spread that travel over extra
    // sub-steps (at most 0.08 per step, up to 16) so the cable follows instead of being yanked.
    const steps = Math.min(16, Math.max(1, Math.round(Math.min(dt, MAX_FRAME) / STEP), Math.ceil(endTravel / 0.08))),
      last = this.n - 1,
      g = GRAVITY * STEP * STEP;
    let seg = this.length / last;
    for (let s = 0; s < steps; s++) {
      const f = (s + 1) / steps;
      this.pinEnds({ ...ends, a: fromEnds.a.clone().lerp(ends.a, f), b: fromEnds.b.clone().lerp(ends.b, f) });
      // integrate free particles
      for (let i = 2; i < last - 1; i++) {
        const p = this.pos[i],
          q = this.prev[i],
          vx = (p.x - q.x) * DAMPING * (this.contact[i] ? FRICTION : 1),
          vy = (p.y - q.y) * DAMPING,
          vz = (p.z - q.z) * DAMPING * (this.contact[i] ? FRICTION : 1);
        q.copy(p);
        const move = new T.Vector3(vx, vy + g, vz);
        if (move.length() > MAX_MOVE) move.setLength(MAX_MOVE);
        p.add(move);
      }
      // constraints, interleaved with collisions so the rope settles around solids
      for (let k = 0; k < ITERATIONS; k++) {
        // Sweeps alternate direction: always solving from the same end makes slack cable on
        // the table drift along its own length like a conveyor belt (1.18.1). Bending is not
        // enforced where the cable rests on something: friction holds the shape it lies in,
        // otherwise a long cable on the table keeps trying to straighten and never stops.
        if (k % 2) {
          for (let i = last - 1; i >= 0; i--) this.satisfy(i, i + 1, seg, 1);
          for (let i = last - 2; i >= 0; i--) if (!this.contact[i + 1]) this.satisfy(i, i + 2, seg * 2, BEND);
        } else {
          for (let i = 0; i < last; i++) this.satisfy(i, i + 1, seg, 1);
          for (let i = 0; i < last - 1; i++) if (!this.contact[i + 1]) this.satisfy(i, i + 2, seg * 2, BEND);
        }
        if (k % 4 === 3) for (let i = 2; i < last - 1; i++) this.collide(i, solids);
      }
      // Two rounds of "no stretch" then "no penetration"; collisions get the last word, so a
      // taut cable rests *on* an edge, never sunk into it.
      for (let round = 0; round < 2; round++) {
        this.inextensible(seg);
        if (round) this.collideCables(); // once per sub-step: enough to keep cables apart
        for (let i = 2; i < last - 1; i++) this.collide(i, solids);
      }
      // Gravity stretch was removed by the inextensible pass, so any stretch left now is
      // geometric. Two cases:
      //  - spread along the cable: it must go around something -> pay out cable, but only for
      //    lasting tension (a cable hitting an edge as it falls must not grow);
      //  - concentrated in one segment: a particle is caught in a crevice between two solids.
      //    More cable would not help, so let that pair slip free (no collision for 0.25 s).
      let excess = 0,
        worst = 0,
        worstAt = 0;
      for (let i = 1; i <= last; i++) {
        const e = this.pos[i].distanceTo(this.pos[i - 1]) - seg;
        if (e > 0) excess += e;
        if (e > worst) {
          worst = e;
          worstAt = i;
        }
      }
      const tense = excess > this.length * 0.01,
        snag = tense && worst > excess * 0.5;
      this.snag = snag ? (this.snag || 0) + 1 : 0;
      const paidForSnag = this.snag > SNAG_STEPS;
      if (paidForSnag) {
        // First give the cable a little more length so it can go around the solid; only a
        // cable already at its maximum length slips through (briefly) to free itself.
        if (this.length < this.payoutCap()) {
          this.length = Math.min(this.payoutCap(), this.length * 1.05);
          this.paidOut = this.length;
          seg = this.length / last;
        } else this.ghost[worstAt - 1] = this.ghost[worstAt] = GHOST_STEPS;
        this.snag = 0;
      }
      // Brief single-segment blips (a particle grazing an edge) do not count as tension here,
      // so they cannot hold extra cable out forever; a snag that made the cable pay out does.
      this.quiet = (tense && !snag) || paidForSnag ? 0 : (this.quiet || 0) + 1;
      this.tension = tense && !snag ? (this.tension || 0) + 1 : 0;
      if (this.tension > TENSION_STEPS && this.length < this.payoutCap()) {
        this.length = Math.min(this.payoutCap(), this.length + excess, this.length * 1.1);
        this.paidOut = this.length;
        this.tension = 0;
        seg = this.length / last;
      }
      for (let i = 0; i <= last; i++) if (this.ghost[i]) this.ghost[i]--;
      // runaway guard
      for (let i = 0; i <= last; i++) {
        const p = this.pos[i];
        if (!Number.isFinite(p.x + p.y + p.z) || p.distanceTo(ends.a) > this.length + 1) {
          this.layout(ends);
          this.render();
          return;
        }
      }
    }
    const still = this.pos.every((p, i) => p.distanceTo(start[i]) < STILL);
    this.sleep = still ? this.sleep + 1 : 0;
    this.render();
  }
  // Most cable a rope may pay out for solids: 1.6 x its nominal length, within its maximum.
  payoutCap() {
    return Math.min(this.maxLength, (this.wanted || this.length) * PAYOUT_LIMIT);
  }
  // Keeps this rope's segments clear of every other cable's nearby segments.
  collideCables() {
    if (boxesDirty) refreshBoxes();
    if (this.candFrame !== frameId) this.gatherCandidates();
    if (!this.nc) return;
    const last = this.n - 1,
      movable = (i) => i >= 2 && i <= last - 2 && !this.ghost[i];
    for (let c = 0; c < this.chunks.length; c++) {
      const CAND = this.chunks[c],
        nc = CAND.length,
        to = Math.min(last, (c + 1) * CHUNK);
      if (!nc) continue;
      for (let i = c * CHUNK + 1; i <= to; i++) {
        const p0 = this.pos[i - 1],
          p1 = this.pos[i],
          m0 = movable(i - 1),
          m1 = movable(i);
        if (!m0 && !m1) continue;
        for (let k = 0; k < nc; k += 4) {
          const q0 = CAND[k],
            q1 = CAND[k + 1],
            otherRope = CAND[k + 3],
            gap = this.radius + CAND[k + 2];
          // quick box reject
          if (Math.max(p0.x, p1.x) + gap < Math.min(q0.x, q1.x) || Math.max(q0.x, q1.x) + gap < Math.min(p0.x, p1.x)) continue;
          if (Math.max(p0.y, p1.y) + gap < Math.min(q0.y, q1.y) || Math.max(q0.y, q1.y) + gap < Math.min(p0.y, p1.y)) continue;
          if (Math.max(p0.z, p1.z) + gap < Math.min(q0.z, q1.z) || Math.max(q0.z, q1.z) + gap < Math.min(p0.z, p1.z)) continue;
          closestParams(p0, p1, q0, q1, ST);
          const s = ST[0],
            t = ST[1];
          let nx = p0.x + (p1.x - p0.x) * s - (q0.x + (q1.x - q0.x) * t),
            ny = p0.y + (p1.y - p0.y) * s - (q0.y + (q1.y - q0.y) * t),
            nz = p0.z + (p1.z - p0.z) * s - (q0.z + (q1.z - q0.z) * t);
          let d = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (d >= gap) continue;
          if (d < 1e-6) (nx = 0), (ny = 1), (nz = 0), (d = 0); // exactly crossing: lift over
          else (nx /= d), (ny /= d), (nz /= d);
          // A sleeping cable pushed deep (a third of the combined thickness) wakes up and makes
          // room too; ordinary resting contact does not wake it, or two cables lying against
          // each other would keep waking each other and never sleep.
          if (otherRope && otherRope.sleep >= SLEEP_FRAMES && gap - d > gap * 0.35) otherRope.wake();
          const push = gap - d,
            wa = m0 ? 1 - s : 0,
            wb = m1 ? s : 0,
            norm = wa * wa + wb * wb;
          if (norm < 1e-9) continue;
          // move the two endpoints so the closest point moves out by `push`
          const ka = (push * wa) / norm,
            kb = (push * wb) / norm;
          p0.x += nx * ka;
          p0.y += ny * ka;
          p0.z += nz * ka;
          p1.x += nx * kb;
          p1.y += ny * kb;
          p1.z += nz * kb;
          this.contact[i - 1] = this.contact[i] = 1;
          // inelastic, like contact with a solid: the push must not turn into velocity, or
          // two cables pressed together keep shoving each other across the table
          if (m0) this.prev[i - 1].lerp(p0, 1 - CONTACT_KEEP);
          if (m1) this.prev[i].lerp(p1, 1 - CONTACT_KEEP);
        }
      }
    }
  }
  // Once per frame: the segments of other cables that can reach this one, listed per chunk of
  // CHUNK segments (each chunk only tests what is near it). Positions are read live, so pushes
  // made by ropes updated earlier in the frame are seen; MARGIN covers a frame's motion.
  gatherCandidates() {
    this.candFrame = frameId;
    const last = this.n - 1,
      count = Math.ceil(last / CHUNK);
    this.chunks = this.chunks || Array.from({ length: count }, () => []);
    this.chunkBoxes = this.chunkBoxes || Array.from({ length: count }, () => new Float64Array(6));
    for (let c = 0; c < count; c++) {
      this.chunks[c].length = 0;
      boxOf(this.pos.slice(c * CHUNK, Math.min(last, (c + 1) * CHUNK) + 1), this.radius + MARGIN, this.chunkBoxes[c]);
    }
    const box = (this.box = boxOf(this.pos, this.radius + MARGIN, this.box)),
      add = (q0, q1, radius, rope) => {
        for (let c = 0; c < count; c++) {
          const b = this.chunkBoxes[c];
          if (Math.max(q0.x, q1.x) < b[0] - radius || Math.min(q0.x, q1.x) > b[3] + radius) continue;
          if (Math.max(q0.y, q1.y) < b[1] - radius || Math.min(q0.y, q1.y) > b[4] + radius) continue;
          if (Math.max(q0.z, q1.z) < b[2] - radius || Math.min(q0.z, q1.z) > b[5] + radius) continue;
          this.chunks[c].push(q0, q1, radius, rope);
        }
      };
    let n = 0;
    for (const other of ROPES) {
      if (other === this || !other.box || !overlap(box, other.box, other.radius)) continue;
      for (let j = 1; j < other.n; j++) add(other.pos[j - 1], other.pos[j], other.radius, other), n++;
    }
    for (const piece of STATIC_PIECES)
      if (overlap(box, piece.box, piece.radius)) add(piece.a, piece.b, piece.radius, null), n++;
    this.nc = n;
  }
  // Follow-the-leader pass in both directions: no segment ends longer than `rest`, so gravity
  // cannot stretch the cable. Like any position constraint, the correction also removes the
  // velocity it opposes (the previous position is left alone).
  inextensible(rest) {
    const last = this.n - 1,
      pull = (from, to) => {
        const a = this.pos[from],
          b = this.pos[to],
          d = b.distanceTo(a);
        if (d <= rest) return;
        b.copy(a.clone().addScaledVector(b.clone().sub(a), rest / d));
      };
    // alternate sweeps so the residual is not dumped on the segment visited last
    for (let sweep = 0; sweep < 2; sweep++) {
      for (let i = 2; i <= last - 2; i++) pull(i - 1, i);
      for (let i = last - 2; i >= 2; i--) pull(i + 1, i);
    }
  }
  // Moves particles i and j toward distance `rest`; the four pinned particles do not move.
  satisfy(i, j, rest, stiffness) {
    const last = this.n - 1,
      wi = i < 2 || i > last - 2 ? 0 : 1,
      wj = j < 2 || j > last - 2 ? 0 : 1;
    if (!wi && !wj) return;
    const a = this.pos[i],
      b = this.pos[j],
      dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z,
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    if (stiffness < 1 && dist >= rest) return; // bending only resists folding
    const diff = ((dist - rest) / dist) * stiffness,
      share = diff / (wi + wj);
    a.x += dx * share * wi;
    a.y += dy * share * wi;
    a.z += dz * share * wi;
    b.x -= dx * share * wj;
    b.y -= dy * share * wj;
    b.z -= dz * share * wj;
  }
  // Rebuilds the tube buffers in place (same topology as THREE.TubeGeometry).
  render() {
    // Particles live in world space; the mesh may hang under a moving group (a harness root),
    // so the drawn curve is expressed in that group's local space.
    const parent = this.mesh?.parent;
    let toLocal = null;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      toLocal = parent.matrixWorld.clone().invert();
    }
    this.curve.points.forEach((p, i) => {
      p.copy(this.pos[i]);
      if (toLocal) p.applyMatrix4(toLocal);
    });
    const geometry = this.mesh?.geometry;
    if (!geometry) return;
    const frames = this.curve.computeFrenetFrames(this.segments, false),
      position = geometry.attributes.position,
      normal = geometry.attributes.normal,
      p = new T.Vector3(),
      nrm = new T.Vector3();
    for (let i = 0; i <= this.segments; i++) {
      this.curve.getPointAt(i / this.segments, p);
      const N = frames.normals[i],
        B = frames.binormals[i];
      for (let j = 0; j <= RADIAL; j++) {
        const angle = (j / RADIAL) * Math.PI * 2,
          sin = Math.sin(angle),
          cos = -Math.cos(angle);
        nrm.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize();
        const index = i * (RADIAL + 1) + j;
        position.setXYZ(index, p.x + nrm.x * this.radius, p.y + nrm.y * this.radius, p.z + nrm.z * this.radius);
        normal.setXYZ(index, nrm.x, nrm.y, nrm.z);
      }
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    geometry.boundingSphere = null;
    geometry.boundingBox = null;
  }
}
