// Verlet ragdolls. Position-based dynamics rather than a full rigid-body
// solver with joints: particles + distance constraints are stable at any
// timestep, need no inertia tensors, and produce the loose, floppy death
// throws people actually want from a ragdoll. Limbs are drawn as boxes
// oriented along each bone segment.

import { add, sub, mul, dot, norm, len, dist, clamp } from './math.js';

// Particle indices — named so constraints below read as anatomy.
export const P = {
  HEAD: 0, NECK: 1, CHEST: 2, PELVIS: 3,
  SHOULDER_L: 4, ELBOW_L: 5, HAND_L: 6,
  SHOULDER_R: 7, ELBOW_R: 8, HAND_R: 9,
  HIP_L: 10, KNEE_L: 11, FOOT_L: 12,
  HIP_R: 13, KNEE_R: 14, FOOT_R: 15,
};

// Rest pose relative to the entity's feet, in metres. A ~1.8m humanoid.
const REST_POSE = [
  [0, 1.70, 0],      // HEAD
  [0, 1.52, 0],      // NECK
  [0, 1.28, 0],      // CHEST
  [0, 0.95, 0],      // PELVIS
  [-0.20, 1.46, 0],  // SHOULDER_L
  [-0.26, 1.16, 0],  // ELBOW_L
  [-0.30, 0.87, 0],  // HAND_L
  [0.20, 1.46, 0],   // SHOULDER_R
  [0.26, 1.16, 0],   // ELBOW_R
  [0.30, 0.87, 0],   // HAND_R
  [-0.12, 0.92, 0],  // HIP_L
  [-0.14, 0.50, 0],  // KNEE_L
  [-0.14, 0.06, 0],  // FOOT_L
  [0.12, 0.92, 0],   // HIP_R
  [0.14, 0.50, 0],   // KNEE_R
  [0.14, 0.06, 0],   // FOOT_R
];

// [a, b, stiffness]. Bone constraints are stiff; the cross-braces that stop
// the torso folding flat are softer so the body still flops convincingly.
const CONSTRAINTS = [
  [P.HEAD, P.NECK, 1.0],
  [P.NECK, P.CHEST, 1.0],
  [P.CHEST, P.PELVIS, 1.0],

  [P.NECK, P.SHOULDER_L, 1.0],
  [P.NECK, P.SHOULDER_R, 1.0],
  [P.SHOULDER_L, P.SHOULDER_R, 0.7],
  [P.SHOULDER_L, P.ELBOW_L, 1.0],
  [P.ELBOW_L, P.HAND_L, 1.0],
  [P.SHOULDER_R, P.ELBOW_R, 1.0],
  [P.ELBOW_R, P.HAND_R, 1.0],

  [P.PELVIS, P.HIP_L, 1.0],
  [P.PELVIS, P.HIP_R, 1.0],
  [P.HIP_L, P.HIP_R, 0.7],
  [P.HIP_L, P.KNEE_L, 1.0],
  [P.KNEE_L, P.FOOT_L, 1.0],
  [P.HIP_R, P.KNEE_R, 1.0],
  [P.KNEE_R, P.FOOT_R, 1.0],

  // Cross-bracing: without these the torso collapses into a flat sheet.
  [P.CHEST, P.HIP_L, 0.45],
  [P.CHEST, P.HIP_R, 0.45],
  [P.PELVIS, P.SHOULDER_L, 0.45],
  [P.PELVIS, P.SHOULDER_R, 0.45],
  [P.HEAD, P.CHEST, 0.35],
  [P.SHOULDER_L, P.ELBOW_R, 0.08],
  [P.SHOULDER_R, P.ELBOW_L, 0.08],
];

// [a, b, thickness, materialSlot] — materialSlot picks flesh vs cloth.
const BONES = [
  [P.NECK, P.CHEST, 0.11, 'body'],
  [P.CHEST, P.PELVIS, 0.13, 'body'],
  [P.SHOULDER_L, P.ELBOW_L, 0.055, 'body'],
  [P.ELBOW_L, P.HAND_L, 0.045, 'skin'],
  [P.SHOULDER_R, P.ELBOW_R, 0.055, 'body'],
  [P.ELBOW_R, P.HAND_R, 0.045, 'skin'],
  [P.HIP_L, P.KNEE_L, 0.07, 'body'],
  [P.KNEE_L, P.FOOT_L, 0.055, 'body'],
  [P.HIP_R, P.KNEE_R, 0.07, 'body'],
  [P.KNEE_R, P.FOOT_R, 0.055, 'body'],
];

const PARTICLE_RADIUS = 0.055;
const HEAD_RADIUS = 0.13;

export class Ragdoll {
  constructor(options = {}) {
    const origin = options.origin || [0, 0, 0];
    const yaw = (options.yaw || 0) * Math.PI / 180;
    const inherited = options.velocity || [0, 0, 0];
    const scale = options.scale || 1;

    this.positions = [];
    this.previous = [];
    this.invMass = [];

    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    for (let i = 0; i < REST_POSE.length; i++) {
      const r = REST_POSE[i];
      // Rotate the rest pose into the entity's facing before dropping it in.
      const x = r[0] * cos - r[2] * sin;
      const z = r[0] * sin + r[2] * cos;
      const p = [origin[0] + x * scale, origin[1] + r[1] * scale, origin[2] + z * scale];
      this.positions.push(p);
      // Seeding `previous` from inherited velocity is what makes a ragdoll
      // carry the momentum it died with instead of dropping straight down.
      this.previous.push([
        p[0] - inherited[0] * (1 / 60),
        p[1] - inherited[1] * (1 / 60),
        p[2] - inherited[2] * (1 / 60),
      ]);
      this.invMass.push(i === P.PELVIS ? 0.8 : 1.0);
    }

    this.restLengths = CONSTRAINTS.map(([a, b]) => dist(this.positions[a], this.positions[b]));

    this.gravity = options.gravity ?? 22;
    this.damping = options.damping ?? 0.992;
    this.groundFriction = options.groundFriction ?? 0.72;
    this.iterations = options.iterations ?? 6;
    this.age = 0;
    this.lifetime = options.lifetime ?? 30;
    this.settled = false;
    this.tint = options.tint || [1, 1, 1];
    this.materials = options.materials || { body: 0, skin: 0 };
    this.impactSoundPending = true;
  }

  // A hit at a specific point flings that body part, which is what sells a
  // headshot snapping the head back versus a body shot folding the torso.
  applyImpulse(impulse, atPoint = null, radius = 0.6) {
    for (let i = 0; i < this.positions.length; i++) {
      let scale = 1;
      if (atPoint) {
        const d = dist(this.positions[i], atPoint);
        scale = Math.max(0, 1 - d / radius);
        if (scale <= 0) continue;
        scale *= scale;
      }
      const dt = 1 / 60;
      this.previous[i] = [
        this.previous[i][0] - impulse[0] * scale * dt,
        this.previous[i][1] - impulse[1] * scale * dt,
        this.previous[i][2] - impulse[2] * scale * dt,
      ];
    }
    this.settled = false;
  }

  nearestParticle(point) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < this.positions.length; i++) {
      const d = dist(this.positions[i], point);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  update(world, dt) {
    this.age += dt;
    if (this.settled) return;

    const dt2 = dt * dt;
    let totalMotion = 0;

    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i];
      const prev = this.previous[i];
      const vx = (p[0] - prev[0]) * this.damping;
      const vy = (p[1] - prev[1]) * this.damping;
      const vz = (p[2] - prev[2]) * this.damping;
      this.previous[i] = [p[0], p[1], p[2]];
      this.positions[i] = [p[0] + vx, p[1] + vy - this.gravity * dt2, p[2] + vz];
      totalMotion += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
    }

    for (let iter = 0; iter < this.iterations; iter++) {
      this.solveConstraints();
      this.solveCollisions(world);
    }

    // Once the whole body has essentially stopped, freeze it. Ragdolls that
    // keep integrating forever are the classic source of twitching corpses.
    if (totalMotion < 0.004 && this.age > 0.75) this.settled = true;
  }

  solveConstraints() {
    for (let c = 0; c < CONSTRAINTS.length; c++) {
      const [ia, ib, stiffness] = CONSTRAINTS[c];
      const rest = this.restLengths[c];
      const a = this.positions[ia];
      const b = this.positions[ib];
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 1e-6) continue;

      const diff = (d - rest) / d * stiffness;
      const wa = this.invMass[ia], wb = this.invMass[ib];
      const sum = wa + wb;
      if (sum < 1e-6) continue;
      const fa = (wa / sum) * 0.5, fb = (wb / sum) * 0.5;

      a[0] += dx * diff * fa; a[1] += dy * diff * fa; a[2] += dz * diff * fa;
      b[0] -= dx * diff * fb; b[1] -= dy * diff * fb; b[2] -= dz * diff * fb;
    }
  }

  solveCollisions(world) {
    for (let i = 0; i < this.positions.length; i++) {
      const radius = i === P.HEAD ? HEAD_RADIUS : PARTICLE_RADIUS;
      const half = [radius, radius, radius];
      const p = this.positions[i];
      const prev = this.previous[i];

      const trace = world.traceBox(prev, p, half);
      if (trace.startSolid) {
        // Pushed inside geometry: lift out along the last known surface.
        this.positions[i] = [prev[0], prev[1] + radius * 0.5, prev[2]];
        continue;
      }
      if (!trace.hit) continue;

      this.positions[i] = trace.endPos;
      const n = trace.normal;

      // Kill the into-surface velocity and scrub the tangential part, which
      // is what stops limbs sliding forever on a flat floor.
      const vx = p[0] - prev[0], vy = p[1] - prev[1], vz = p[2] - prev[2];
      const intoSurface = vx * n[0] + vy * n[1] + vz * n[2];
      let tx = vx - n[0] * intoSurface;
      let ty = vy - n[1] * intoSurface;
      let tz = vz - n[2] * intoSurface;
      tx *= this.groundFriction; ty *= this.groundFriction; tz *= this.groundFriction;

      this.previous[i] = [
        this.positions[i][0] - tx,
        this.positions[i][1] - ty,
        this.positions[i][2] - tz,
      ];
    }
  }

  get center() {
    return this.positions[P.PELVIS];
  }

  draw(renderer, shadowPass = false) {
    const bodyLayer = this.materials.body;
    const skinLayer = this.materials.skin;
    for (const [a, b, thickness, slot] of BONES) {
      renderer.drawSegment(
        this.positions[a], this.positions[b], thickness,
        slot === 'skin' ? skinLayer : bodyLayer,
        this.tint, shadowPass,
      );
    }
    renderer.drawSphere(this.positions[P.HEAD], HEAD_RADIUS, skinLayer, this.tint, shadowPass);
  }
}

export class RagdollSystem {
  constructor(options = {}) {
    this.ragdolls = [];
    this.maxRagdolls = options.maxRagdolls ?? 24;
  }

  spawn(options) {
    const ragdoll = new Ragdoll(options);
    this.ragdolls.push(ragdoll);
    // Oldest bodies go first so a long firefight can't unbound the sim.
    while (this.ragdolls.length > this.maxRagdolls) this.ragdolls.shift();
    return ragdoll;
  }

  update(world, dt) {
    for (const r of this.ragdolls) r.update(world, dt);
    if (this.ragdolls.length) {
      this.ragdolls = this.ragdolls.filter((r) => r.age < r.lifetime);
    }
  }

  draw(renderer, shadowPass = false) {
    for (const r of this.ragdolls) r.draw(renderer, shadowPass);
  }

  clear() {
    this.ragdolls.length = 0;
  }

  get count() { return this.ragdolls.length; }
}
