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

export class Rope {
  // getEnds(): { a, aDir, b, bDir } world points and the directions the cable leaves them.
  // lengthFor(distance): rest length for a given end-to-end distance.
  // ignores(mesh): solids this rope passes (e.g. the probe it is attached to).
  constructor({ count = 64, radius, color, getEnds, lengthFor, maxLength = Infinity, ignores = () => false }) {
    this.n = count;
    this.maxLength = maxLength;
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
  layout(ends) {
    const { a, b } = ends,
      d = a.distanceTo(b);
    this.length = Math.max(this.lengthFor(d), d);
    const rise = Math.sqrt(Math.max(this.length * this.length - d * d, 0)) * 0.45;
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1),
        p = this.pos[i].copy(a).lerp(b, t);
      p.y += rise * Math.sin(Math.PI * t);
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
    if (p.y < ground) {
      p.y = ground;
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
    if (endsMoved) this.paidOut = 0;
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
        for (let i = 0; i < last; i++) this.satisfy(i, i + 1, seg, 1);
        for (let i = 0; i < last - 1; i++) this.satisfy(i, i + 2, seg * 2, BEND);
        if (k % 4 === 3) for (let i = 2; i < last - 1; i++) this.collide(i, solids);
      }
      // Two rounds of "no stretch" then "no penetration"; collisions get the last word, so a
      // taut cable rests *on* an edge, never sunk into it.
      for (let round = 0; round < 2; round++) {
        this.inextensible(seg);
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
      if (this.snag > SNAG_STEPS) {
        // First give the cable a little more length so it can go around the solid; only a
        // cable already at its maximum length slips through (briefly) to free itself.
        if (this.length < this.maxLength) {
          this.length = Math.min(this.maxLength, this.length * 1.05);
          this.paidOut = this.length;
          seg = this.length / last;
        } else this.ghost[worstAt - 1] = this.ghost[worstAt] = GHOST_STEPS;
        this.snag = 0;
      }
      this.tension = tense && !snag ? (this.tension || 0) + 1 : 0;
      if (this.tension > TENSION_STEPS && this.length < this.maxLength) {
        this.length = Math.min(this.maxLength, this.length + excess, this.length * 1.1);
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
