// Server-side validation for Fount multiplayer.
//
// The design rule here is that the server never takes the client's word for
// anything it can check itself. It shares the engine's own collision code
// (engine/physics.js, via the map the server loads), so "can this shot see that
// player" and "could this player have walked here" are answered with exactly
// the trace the client runs — no second implementation to drift out of sync and
// start disagreeing with honest clients.
//
// What it cannot do is stated as plainly as what it can: the server validates
// movement rather than simulating it. It knows a move was impossible and undoes
// it; it does not reproduce the move from inputs. Making the server simulate
// would need client-side prediction and reconciliation, which is a much larger
// change and a worse feel if done badly. See README's "Trust model".
//
// Thresholds come from measurement, not taste. The numbers in NORMAL were taken
// from instrumented play — ordinary running, bunnyhopping, air-strafing and
// falling — where legitimate horizontal speed sat at ~16 m/s p99 and terminal
// fall at exactly 60 m/s, the engine's own clamp. Nothing in the stock engine
// pushes a player faster: env_explosion damages them but applies no impulse. So
// the caps here sit at roughly twice real play and the geometric checks do the
// precise work. A game whose own scripts launch players (jump pads, cannons)
// should raise maxHorizontalSpeed or run 'lenient' — a launch is not corrected
// either way, since correction is driven by geometry rather than speed, but it
// would otherwise trickle harmless points into that player's score.

import { CollisionWorld } from '../engine/physics.js';

// Half extents of a player, matching CharacterController's default, and the
// hitbox the client traces against. Hitbox is taller than the collision box
// because the head sits above the box's centre.
export const PLAYER_HALF = [0.35, 0.9, 0.35];
export const HITBOX_MIN = [-0.35, -0.9, -0.35];
export const HITBOX_MAX = [0.35, 1.25, 0.35];

// Where the camera sits above the player's origin, matching Player.eyeHeight in
// engine/game.js. Shots are checked against this, so a value that drifts from
// the client's would quietly start rejecting honest shots.
const EYE_HEIGHT = 0.72;

// Above this offset from the player's origin, a hit counts as a head shot.
// Must match the client's rule or the two disagree about lethality.
const HEADSHOT_OFFSET = 0.55;
const HEADSHOT_DAMAGE = 100;
const BODY_DAMAGE = 25;
const HEADSHOT_IMPULSE = 16;
const BODY_IMPULSE = 9;

// Weapon limits, mirroring engine/game.js's fire().
const FIRE_COOLDOWN_MS = 110;
const MAX_RANGE = 120;
const MAX_AMMO = 30;

export const PRESETS = {
  // No validation at all. For a trusted LAN game, or debugging.
  off: { enabled: false },

  // For high-latency or modded games: geometry checks still run, but the
  // scoring is forgiving and nobody is kicked automatically.
  lenient: {
    enabled: true,
    maxHorizontalSpeed: 60,
    maxRiseSpeed: 45,
    maxFallSpeed: 80,
    pathTolerance: 1.5,
    maxRewindMs: 400,
    aimConeDegrees: 30,
    originTolerance: 3.0,
    kickScore: Infinity,
    warnScore: 60,
  },

  // The default. Rejects what is provably impossible, kicks only on a sustained
  // pattern rather than a single anomaly, because one anomaly is usually a lag
  // spike and kicking on it punishes a bad connection instead of a cheat.
  normal: {
    enabled: true,
    maxHorizontalSpeed: 40,
    maxRiseSpeed: 35,
    maxFallSpeed: 70,
    pathTolerance: 0.75,
    maxRewindMs: 300,
    aimConeDegrees: 20,
    originTolerance: 2.0,
    kickScore: 100,
    warnScore: 40,
  },

  // For a competitive server that would rather drop a laggy player than let a
  // cheat land a single shot.
  strict: {
    enabled: true,
    maxHorizontalSpeed: 28,
    maxRiseSpeed: 26,
    maxFallSpeed: 65,
    pathTolerance: 0.5,
    maxRewindMs: 200,
    aimConeDegrees: 12,
    originTolerance: 1.2,
    kickScore: 45,
    warnScore: 20,
  },
};

// How much each kind of violation adds to a player's score. Impossible things
// (shooting through a wall, being inside geometry) weigh heavily; things that a
// bad connection can also produce weigh little.
const WEIGHTS = {
  speed: 3,
  fly: 4,
  fall: 2,
  noclip: 12,
  path: 8,
  bounds: 10,
  aim: 6,
  range: 6,
  los: 15,
  miss: 10,
  phantom: 12,
  cooldown: 4,
  ammo: 4,
  dead: 8,
  self: 20,
  malformed: 2,
};

// Violations decay, so a player who lagged badly an hour ago is not carrying it
// around. Half the accumulated score every 30 seconds.
const DECAY_HALF_LIFE_MS = 30000;

function isFiniteVec(v) {
  return Array.isArray(v) && v.length >= 3
    && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function anglesToForward(angles) {
  const pitch = (angles[0] || 0) * Math.PI / 180;
  const yaw = (angles[1] || 0) * Math.PI / 180;
  const cp = Math.cos(pitch);
  return [Math.cos(yaw) * cp, -Math.sin(pitch), -Math.sin(yaw) * cp];
}

// Ray against an axis-aligned box; returns entry distance or null. Same slab
// method the client uses to pick targets, so both agree on what was hit.
function rayBox(origin, dir, min, max) {
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
      continue;
    }
    const inv = 1 / dir[i];
    let t1 = (min[i] - origin[i]) * inv;
    let t2 = (max[i] - origin[i]) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Per-player anticheat state. Kept beside the player rather than inside it. */
export function newPlayerState() {
  return {
    history: [],          // [{ t, pos, angles }] for lag compensation
    lastPos: null,
    lastPosTime: 0,
    pendingShots: [],     // shots fired but not yet claimed as hits
    lastShotTime: 0,
    ammo: MAX_AMMO,
    score: 0,
    scoreTime: Date.now(),
    violations: new Map(), // kind -> count, for admin display
    graceUntil: 0,         // set when the server itself moves the player
    corrections: 0,
    lastCorrection: 0,
  };
}

const HISTORY_MS = 1200;

export class AntiCheat {
  constructor(preset = 'normal', overrides = {}) {
    this.setPreset(preset, overrides);
    this.world = new CollisionWorld();
    this.bounds = null;
    this.onFlag = null;    // (player, kind, detail) => void
  }

  setPreset(preset, overrides = {}) {
    const base = PRESETS[preset] || PRESETS.normal;
    this.presetName = PRESETS[preset] ? preset : 'normal';
    this.config = { validateMovement: true, ...PRESETS.normal, ...base, ...overrides };
    this.enabled = this.config.enabled !== false;
    return this.presetName;
  }

  /** Swap in the collision world for the current map. */
  setWorld(built) {
    this.world = built ? built.collision : new CollisionWorld();
    this.bounds = built ? built.bounds : null;
  }

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------

  /** Exponential decay, so old violations stop counting without a timer. */
  currentScore(ac) {
    const now = Date.now();
    const elapsed = now - ac.scoreTime;
    if (elapsed > 0 && ac.score > 0) {
      ac.score *= Math.pow(0.5, elapsed / DECAY_HALF_LIFE_MS);
      if (ac.score < 0.01) ac.score = 0;
    }
    ac.scoreTime = now;
    return ac.score;
  }

  flag(player, kind, detail = '') {
    const ac = player.ac;
    this.currentScore(ac);
    ac.score += WEIGHTS[kind] ?? 3;
    ac.violations.set(kind, (ac.violations.get(kind) || 0) + 1);
    if (this.onFlag) this.onFlag(player, kind, detail);
    return ac.score;
  }

  /** 'ok' | 'warn' | 'kick' — what the server should do about this player. */
  verdict(player) {
    const score = this.currentScore(player.ac);
    if (score >= this.config.kickScore) return 'kick';
    if (score >= this.config.warnScore) return 'warn';
    return 'ok';
  }

  /**
   * Tell the anticheat the server itself moved this player (spawn, respawn,
   * map change, admin teleport). Without this, every respawn reads as a ~66m
   * teleport — measured on the demo map — and is the single biggest source of
   * false positives.
   */
  grantGrace(player, pos, ms = 1000) {
    const ac = player.ac;
    ac.graceUntil = Date.now() + ms;
    ac.lastPos = pos ? [...pos] : null;
    ac.lastPosTime = Date.now();
    ac.history.length = 0;
  }

  // -------------------------------------------------------------------------
  // Movement
  // -------------------------------------------------------------------------

  recordPosition(player, pos, angles, now) {
    const ac = player.ac;
    ac.history.push({ t: now, pos: [...pos], angles: [...angles] });
    while (ac.history.length && now - ac.history[0].t > HISTORY_MS) ac.history.shift();
  }

  /**
   * Validate a claimed position. Returns the position to accept — which is the
   * claimed one when it is reachable, and a correction when it is not.
   *
   * The load-bearing check is geometric, not speed-based: sweep the player's box
   * from where they were to where they say they are, through the same brushes
   * the client collides against. A path that runs through solid geometry is not
   * a fast player, it is a client that isn't collidng. Speed limits are a
   * secondary signal, because a laggy honest client can look fast for a tick.
   */
  checkMove(player, pos, angles, now) {
    const ac = player.ac;
    // A server that allows cheat commands must not then fight them: noclip and
    // teleport are movement the operator has explicitly permitted. Combat
    // validation stays on regardless, because that protects other players
    // rather than the cheating one.
    if (!this.enabled || this.config.validateMovement === false) {
      ac.lastPos = [...pos];
      ac.lastPosTime = now;
      this.recordPosition(player, pos, angles, now);
      return { pos, corrected: false };
    }

    if (!isFiniteVec(pos)) {
      this.flag(player, 'malformed', 'non-finite position');
      return { pos: ac.lastPos || [0, 2, 0], corrected: true, reason: 'malformed' };
    }

    // A server-initiated move (respawn, map change) is legitimate and arrives
    // as an enormous jump. Trust the first report inside the grace window.
    if (now < ac.graceUntil) {
      ac.lastPos = [...pos];
      ac.lastPosTime = now;
      this.recordPosition(player, pos, angles, now);
      return { pos, corrected: false };
    }

    // Outside the map entirely. The engine kills a player below y=-60, so the
    // floor here is lower than that to leave the death fall alone.
    if (this.bounds) {
      const m = 80;
      const { min, max } = this.bounds;
      if (pos[0] < min[0] - m || pos[0] > max[0] + m
        || pos[2] < min[2] - m || pos[2] > max[2] + m
        || pos[1] > max[1] + m || pos[1] < min[1] - 200) {
        this.flag(player, 'bounds', `${pos.map((n) => n.toFixed(1))}`);
        return { pos: ac.lastPos || [0, 2, 0], corrected: true, reason: 'out of bounds' };
      }
    }

    const prev = ac.lastPos;
    const dt = ac.lastPosTime ? (now - ac.lastPosTime) / 1000 : 0;

    if (prev && dt > 0 && dt < 1.0) {
      const dx = pos[0] - prev[0];
      const dy = pos[1] - prev[1];
      const dz = pos[2] - prev[2];
      const horizontal = Math.hypot(dx, dz) / dt;
      const vertical = dy / dt;

      if (horizontal > this.config.maxHorizontalSpeed) {
        this.flag(player, 'speed', `${horizontal.toFixed(1)} m/s`);
      }
      // Sustained rise without ground contact is flight. A jump and an
      // explosion both rise fast but briefly, so this is a rate check, not a
      // displacement one.
      if (vertical > this.config.maxRiseSpeed) {
        this.flag(player, 'fly', `+${vertical.toFixed(1)} m/s`);
      }
      if (-vertical > this.config.maxFallSpeed) {
        this.flag(player, 'fall', `${vertical.toFixed(1)} m/s`);
      }

      const travelled = Math.hypot(dx, dy, dz);
      if (travelled > 0.05) {
        const reach = this.reachable(prev, pos);
        if (!reach.ok) {
          this.flag(player, 'path', `blocked after ${reach.travelled.toFixed(2)}m of ${travelled.toFixed(2)}m`);
          ac.corrections++;
          ac.lastCorrection = now;
          ac.lastPos = [...reach.endPos];
          ac.lastPosTime = now;
          this.recordPosition(player, reach.endPos, angles, now);
          return { pos: reach.endPos, corrected: true, reason: 'moved through geometry' };
        }
      }
    }

    // Standing inside solid geometry. Shrunk slightly: the controller's own
    // step-up and slide legitimately leave a player touching a surface, and a
    // full-size test would flag that constantly.
    const shrunk = [PLAYER_HALF[0] * 0.6, PLAYER_HALF[1] * 0.6, PLAYER_HALF[2] * 0.6];
    if (this.world.pointInSolid(pos, shrunk)) {
      this.flag(player, 'noclip', `${pos.map((n) => n.toFixed(1))}`);
      const fallback = prev && !this.world.pointInSolid(prev, shrunk) ? prev : null;
      if (fallback) {
        ac.lastPos = [...fallback];
        ac.lastPosTime = now;
        this.recordPosition(player, fallback, angles, now);
        return { pos: fallback, corrected: true, reason: 'inside geometry' };
      }
    }

    ac.lastPos = [...pos];
    ac.lastPosTime = now;
    this.recordPosition(player, pos, angles, now);
    return { pos, corrected: false };
  }

  /**
   * Could a player have got from `from` to `to`? A straight sweep is stricter
   * than the client's real path, which slides along walls and steps up stairs
   * in 120Hz substeps — so the step-up retry and the distance tolerance below
   * exist to keep honest movement from being called a violation. The tolerance
   * scales with distance because clipping a corner costs more the faster you go.
   */
  reachable(from, to) {
    const travelled = dist(from, to);
    const tolerance = Math.max(this.config.pathTolerance, travelled * 0.5);

    const direct = this.world.traceBox(from, to, PLAYER_HALF);
    if (!direct.hit || direct.startSolid) return { ok: true, travelled, endPos: to };
    if (dist(direct.endPos, to) <= tolerance) return { ok: true, travelled, endPos: to };

    // Retry lifted by the controller's step height, the way stairs are climbed.
    const stepHeight = 0.55;
    const lifted = [from[0], from[1] + stepHeight, from[2]];
    const up = this.world.traceBox(from, lifted, PLAYER_HALF);
    if (!up.startSolid) {
      const target = [to[0], to[1] + stepHeight, to[2]];
      const stepped = this.world.traceBox(up.endPos, target, PLAYER_HALF);
      if (!stepped.hit || dist(stepped.endPos, target) <= tolerance) {
        return { ok: true, travelled, endPos: to };
      }
    }

    return { ok: false, travelled: dist(from, direct.endPos), endPos: direct.endPos };
  }

  // -------------------------------------------------------------------------
  // Shooting
  // -------------------------------------------------------------------------

  /**
   * Record a shot. Rejecting here stops the shot being relayed at all, so a
   * client cannot machine-gun a weapon that fires at 9 rounds a second, and
   * cannot fire while dead.
   */
  noteShot(player, origin, dir, now) {
    const ac = player.ac;
    if (!this.enabled) {
      ac.pendingShots.push({ t: now, origin, dir, used: false });
      if (ac.pendingShots.length > 32) ac.pendingShots.shift();
      return { ok: true };
    }

    if (!isFiniteVec(origin) || !isFiniteVec(dir)) {
      this.flag(player, 'malformed', 'non-finite shot');
      return { ok: false, reason: 'malformed shot' };
    }
    if (player.dead) {
      this.flag(player, 'dead', 'fired while dead');
      return { ok: false, reason: 'dead players do not shoot' };
    }

    // Fire rate. A 10ms allowance absorbs timer jitter without opening the
    // door to a client that simply ignores the cooldown.
    if (now - ac.lastShotTime < FIRE_COOLDOWN_MS - 10) {
      this.flag(player, 'cooldown', `${now - ac.lastShotTime}ms apart`);
      return { ok: false, reason: 'firing too fast' };
    }
    if (ac.ammo <= 0) {
      this.flag(player, 'ammo', 'fired with no ammo');
      return { ok: false, reason: 'out of ammo' };
    }

    // The shot must leave from roughly where the server thinks the player is,
    // and point roughly where they claim to be looking.
    const eye = this.eyeOf(player);
    if (dist(origin, eye) > this.config.originTolerance) {
      this.flag(player, 'aim', `origin ${dist(origin, eye).toFixed(1)}m from player`);
      return { ok: false, reason: 'shot did not come from the player' };
    }
    const look = anglesToForward(player.angles);
    const dlen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const cos = (dir[0] * look[0] + dir[1] * look[1] + dir[2] * look[2]) / dlen;
    const limit = Math.cos(this.config.aimConeDegrees * Math.PI / 180);
    if (cos < limit) {
      this.flag(player, 'aim', `${(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI).toFixed(0)}deg off view`);
      return { ok: false, reason: 'shot direction does not match view' };
    }

    ac.lastShotTime = now;
    ac.ammo--;
    ac.pendingShots.push({ t: now, origin: [...origin], dir: [dir[0] / dlen, dir[1] / dlen, dir[2] / dlen], used: false });
    while (ac.pendingShots.length && now - ac.pendingShots[0].t > 1500) ac.pendingShots.shift();
    if (ac.pendingShots.length > 32) ac.pendingShots.shift();
    return { ok: true };
  }

  eyeOf(player) {
    return [player.pos[0], player.pos[1] + EYE_HEIGHT, player.pos[2]];
  }

  setAmmo(player, n) {
    player.ac.ammo = Math.max(0, Math.min(MAX_AMMO, n));
  }

  // -------------------------------------------------------------------------
  // Hits
  // -------------------------------------------------------------------------

  /** Where was this player at time `t`, interpolated from their history? */
  positionAt(player, t) {
    const h = player.ac.history;
    if (!h.length) return [...player.pos];
    if (t >= h[h.length - 1].t) return [...h[h.length - 1].pos];
    if (t <= h[0].t) return [...h[0].pos];
    for (let i = h.length - 1; i > 0; i--) {
      const b = h[i];
      const a = h[i - 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        const f = span > 0 ? (t - a.t) / span : 0;
        return [
          a.pos[0] + (b.pos[0] - a.pos[0]) * f,
          a.pos[1] + (b.pos[1] - a.pos[1]) * f,
          a.pos[2] + (b.pos[2] - a.pos[2]) * f,
        ];
      }
    }
    return [...player.pos];
  }

  /**
   * Decide whether a claimed hit really happened, and how much it hurt. The
   * client says who it hit; the server says whether that was possible and what
   * the damage is — the claimed damage is never read.
   *
   * Lag compensation: the shooter aimed at where they saw the target, which is
   * INTERP_DELAY_MS behind the server's newest snapshot plus their own latency.
   * Rewinding the target to that moment is what makes honest hits land on a
   * real connection; capping the rewind is what stops it becoming a cheat.
   */
  resolveHit(shooter, target, claim, now, interpDelayMs = 100) {
    if (!this.enabled) {
      const point = isFiniteVec(claim.point) ? claim.point : [...target.pos];
      const headshot = point[1] > target.pos[1] + HEADSHOT_OFFSET;
      return {
        ok: true,
        damage: headshot ? HEADSHOT_DAMAGE : BODY_DAMAGE,
        point,
        impulse: isFiniteVec(claim.impulse) ? claim.impulse : [0, 0, 0],
        headshot,
      };
    }

    if (shooter.id === target.id) {
      this.flag(shooter, 'self', 'claimed a hit on itself');
      return { ok: false, reason: 'self hit' };
    }
    if (shooter.dead) {
      this.flag(shooter, 'dead', 'claimed a hit while dead');
      return { ok: false, reason: 'shooter is dead' };
    }
    if (target.dead) return { ok: false, reason: 'target already dead' };

    // Every hit must correspond to a shot the server accepted. Without this,
    // a client can skip 'shoot' entirely and post hits directly — which is the
    // cheapest aimbot there is.
    const shot = this.matchShot(shooter, now);
    if (!shot) {
      this.flag(shooter, 'phantom', 'hit with no matching shot');
      return { ok: false, reason: 'no shot to account for this hit' };
    }

    // Rewind the target to when the shooter saw them.
    const latency = Math.max(0, Math.min(this.config.maxRewindMs, shooter.ac.rtt || 0));
    const viewTime = now - Math.min(this.config.maxRewindMs, interpDelayMs + latency);
    const at = this.positionAt(target, viewTime);

    const min = [at[0] + HITBOX_MIN[0], at[1] + HITBOX_MIN[1], at[2] + HITBOX_MIN[2]];
    const max = [at[0] + HITBOX_MAX[0], at[1] + HITBOX_MAX[1], at[2] + HITBOX_MAX[2]];
    const t = rayBox(shot.origin, shot.dir, min, max);
    if (t === null) {
      this.flag(shooter, 'miss', 'ray does not reach the target');
      return { ok: false, reason: 'shot did not intersect the target' };
    }
    if (t > MAX_RANGE) {
      this.flag(shooter, 'range', `${t.toFixed(0)}m`);
      return { ok: false, reason: 'target out of range' };
    }

    const point = [
      shot.origin[0] + shot.dir[0] * t,
      shot.origin[1] + shot.dir[1] * t,
      shot.origin[2] + shot.dir[2] * t,
    ];

    // Line of sight through the real map. This is what stops shooting through
    // walls, and it uses the same trace the client used to decide the shot was
    // clear — so an honest client and the server agree.
    const world = this.world.traceRay(shot.origin, point);
    if (world.hit && world.fraction < 0.99) {
      this.flag(shooter, 'los', `wall at ${(world.fraction * t).toFixed(1)}m of ${t.toFixed(1)}m`);
      return { ok: false, reason: 'no line of sight to the target' };
    }

    shot.used = true;

    // The server decides lethality from where the ray actually landed. The
    // client's claimed damage is not read at all.
    const headshot = point[1] > at[1] + HEADSHOT_OFFSET;
    return {
      ok: true,
      damage: headshot ? HEADSHOT_DAMAGE : BODY_DAMAGE,
      point: point.map((n) => +n.toFixed(2)),
      impulse: shot.dir.map((n) => n * (headshot ? HEADSHOT_IMPULSE : BODY_IMPULSE)),
      headshot,
      rewindMs: now - viewTime,
    };
  }

  /** The most recent unused shot, within the window a hit could refer to. */
  matchShot(shooter, now) {
    const shots = shooter.ac.pendingShots;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (s.used) continue;
      if (now - s.t > 1000) break;
      return s;
    }
    return null;
  }

  /** A short report for the admin console. */
  report(player) {
    const ac = player.ac;
    const score = this.currentScore(ac);
    const kinds = [...ac.violations.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}x${n}`)
      .join(' ');
    return { score, kinds, corrections: ac.corrections };
  }
}
