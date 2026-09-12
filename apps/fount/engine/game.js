// Game runtime: player, weapons, the fixed-timestep loop, and the glue that
// hands engine services to entity behaviours.

import { Renderer } from './render.js';
import { CollisionWorld, CharacterController } from './physics.js';
import { RagdollSystem } from './ragdoll.js';
import { EntityWorld, defineEntity } from './entity.js';
import { buildMap, loadMap, pointInBrush } from './map.js';
import { playSound, playSoundAt, unlockAudio } from './audio.js';
import {
  add, sub, mul, norm, len, dot, dist, clamp,
  anglesToForward, anglesToRight,
} from './math.js';
import { killNPC } from './entities.js';

const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS = 8;

class Player {
  constructor(config = {}) {
    this.controller = new CharacterController({
      position: config.spawn || [0, 2, 0],
      halfExtents: [0.35, 0.9, 0.35],
      maxSpeed: config.maxSpeed ?? 7.2,
      jumpSpeed: config.jumpSpeed ?? 7.4,
    });
    this.angles = [0, config.yaw ?? 0, 0];
    this.maxHealth = config.maxHealth ?? 100;
    this.health = this.maxHealth;
    this.ammo = config.ammo ?? 120;
    this.eyeHeight = 0.72;
    this.fireCooldown = 0;
    this.damageFlash = 0;
    this.stepAccum = 0;
    this.kills = 0;
    this.dead = false;
    this.respawnTimer = 0;
    this.spawnPoint = config.spawn || [0, 2, 0];
    this.spawnYaw = config.yaw ?? 0;
  }

  get position() { return this.controller.position; }

  get eyePosition() {
    const p = this.controller.position;
    return [p[0], p[1] + this.eyeHeight, p[2]];
  }

  get forward() { return anglesToForward(this.angles); }

  takeDamage(amount, source) {
    if (this.dead) return;
    this.health -= amount;
    this.damageFlash = 1;
    playSound('hurt', 0.7);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.respawnTimer = 2.5;
      playSound('die');
    }
    void source;
  }

  respawn() {
    this.controller.position = [...this.spawnPoint];
    this.controller.velocity = [0, 0, 0];
    this.angles = [0, this.spawnYaw, 0];
    this.health = this.maxHealth;
    this.dead = false;
  }
}

// Ray vs axis-aligned box, used for hitscan against NPC bodies.
function rayBox(origin, dir, min, max) {
  let tmin = 0, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
    } else {
      const inv = 1 / dir[i];
      let t1 = (min[i] - origin[i]) * inv;
      let t2 = (max[i] - origin[i]) * inv;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = new Renderer(canvas);
    this.ragdolls = new RagdollSystem();
    this.keys = new Set();
    this.mouseDown = false;
    this.paused = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsAccum = 0;
    this.dynamicBrushes = [];
    this.debugText = '';
    this.sensitivity = 0.14;
    this.onStatsChanged = null;
    this.bindInput();
  }

  async load(mapUrl) {
    const doc = await loadMap(mapUrl);
    this.loadMapDocument(doc);
  }

  loadMapDocument(doc) {
    this.mapDoc = doc;
    const built = buildMap(doc);
    this.built = built;
    this.collision = built.collision;
    this.dynamicBrushes = [];
    this.collision.setDynamicBrushes(this.dynamicBrushes);
    this.renderer.setMaterials(built.materials);
    this.renderer.setWorldMesh(built.meshData);
    this.renderer.computeLightMatrix(built.env.sunDir, built.bounds);
    this.env = built.env;
    this.ragdolls.clear();

    const startEntity = (built.entities || []).find((e) => e.classname === 'info_player_start');
    let spawn = startEntity ? add(startEntity.origin, [0, 1.0, 0]) : [0, 3, 0];
    spawn = this.resolveSpawn(spawn);
    this.player = new Player({
      spawn,
      yaw: startEntity && startEntity.angles ? startEntity.angles[1] : 0,
      ...(built.player || {}),
    });

    this.world = new EntityWorld({
      collision: this.collision,
      ragdolls: this.ragdolls,
      materialIndex: built.materialIndex,
      player: this.player,
      listener: () => this.player.eyePosition,
      registerDynamicBrush: (brush) => this.dynamicBrushes.push(brush),
      findTriggerBrush: (name) => built.triggerBrushes.find((t) => t.name === name),
      game: this,
    });

    for (const data of built.entities) this.world.spawn(data);
    this.mapName = built.name;
  }

  /**
   * A spawn buried in geometry leaves the player stuck with no obvious cause —
   * an easy mistake to make when writing map JSON by hand. Lift the spawn to
   * free space if we can, and say so loudly rather than failing silently.
   */
  resolveSpawn(spawn) {
    const half = [0.35, 0.9, 0.35];
    if (!this.collision.pointInSolid(spawn, half)) {
      this.spawnWarning = '';
      return spawn;
    }
    for (let lift = 0.5; lift <= 12; lift += 0.5) {
      const candidate = [spawn[0], spawn[1] + lift, spawn[2]];
      if (!this.collision.pointInSolid(candidate, half)) {
        this.spawnWarning = `info_player_start is inside solid geometry — lifted ${lift.toFixed(1)}m`;
        console.warn('[fount]', this.spawnWarning, spawn);
        return candidate;
      }
    }
    this.spawnWarning = 'info_player_start is inside solid geometry and could not be freed';
    console.warn('[fount]', this.spawnWarning, spawn);
    return spawn;
  }

  bindInput() {
    const canvas = this.canvas;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      unlockAudio();
      if (e.code === 'KeyR' && e.shiftKey) this.restart();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      unlockAudio();
      if (!this.editorMode && document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.player.angles[1] -= e.movementX * this.sensitivity;
      this.player.angles[0] = clamp(this.player.angles[0] + e.movementY * this.sensitivity, -89, 89);
    });

    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  restart() {
    if (this.mapDoc) this.loadMapDocument(this.mapDoc);
  }

  wishDirection() {
    if (this.player.dead) return [0, 0, 0];
    const forward = anglesToForward([0, this.player.angles[1], 0]);
    const right = anglesToRight(this.player.angles);
    let wish = [0, 0, 0];
    if (this.keys.has('KeyW')) wish = add(wish, forward);
    if (this.keys.has('KeyS')) wish = sub(wish, forward);
    if (this.keys.has('KeyD')) wish = add(wish, right);
    if (this.keys.has('KeyA')) wish = sub(wish, right);
    wish[1] = 0;
    return wish;
  }

  // Hitscan: trace the world first, then see whether any NPC body is closer.
  // Where it lands decides the ragdoll impulse point, so a head hit throws the
  // head and a leg hit drops them.
  fire() {
    const player = this.player;
    if (player.dead || player.ammo <= 0 || player.fireCooldown > 0) return;
    player.fireCooldown = 0.11;
    player.ammo--;
    playSound('shoot');

    const origin = player.eyePosition;
    const dir = player.forward;
    const maxRange = 120;
    const end = add(origin, mul(dir, maxRange));

    const worldTrace = this.collision.traceRay(origin, end);
    let bestDist = worldTrace.hit ? worldTrace.fraction * maxRange : maxRange;
    let hitEntity = null;
    let hitPoint = worldTrace.endPos;

    for (const entity of this.world.entities) {
      if (entity.removed || entity.classname !== 'npc_grunt' || entity.state.dead) continue;
      const ctrl = entity.state.controller;
      const c = ctrl.position;
      const h = ctrl.halfExtents;
      const min = [c[0] - h[0], c[1] - h[1], c[2] - h[2]];
      const max = [c[0] + h[0], c[1] + h[1] + 0.35, c[2] + h[2]];
      const t = rayBox(origin, dir, min, max);
      if (t !== null && t < bestDist) {
        bestDist = t;
        hitEntity = entity;
        hitPoint = add(origin, mul(dir, t));
      }
    }

    if (hitEntity) {
      const isHeadshot = hitPoint[1] > hitEntity.state.controller.position[1] + 0.55;
      const damage = isHeadshot ? 100 : 25;
      hitEntity.state.health -= damage;
      this.world.fireOutput(hitEntity, 'OnDamaged', null, String(hitEntity.state.health));

      if (hitEntity.state.health <= 0) {
        killNPC(hitEntity, this.world, {
          impulse: mul(dir, isHeadshot ? 16 : 9),
          hitPoint,
          impulseRadius: isHeadshot ? 0.55 : 1.0,
        });
        this.player.kills++;
      } else {
        playSoundAt('impact', hitPoint, this.player.eyePosition, 30);
        playSoundAt('hurt', hitPoint, this.player.eyePosition, 30);
      }
    } else if (worldTrace.hit) {
      playSoundAt('impact', hitPoint, this.player.eyePosition, 40);
      // Shooting a physics prop shoves it, which makes the world feel reactive.
      for (const entity of this.world.entities) {
        if (entity.removed || !entity.state.body) continue;
        const b = entity.state.body;
        const min = sub(b.position, b.halfExtents);
        const max = add(b.position, b.halfExtents);
        const t = rayBox(origin, dir, min, max);
        if (t !== null && t <= bestDist + 0.5) {
          b.addImpulse(mul(dir, 7));
          break;
        }
      }
    }

    // Bullets nudge bodies too.
    for (const ragdoll of this.ragdolls.ragdolls) {
      if (dist(ragdoll.center, hitPoint) < 1.2) {
        const idx = ragdoll.nearestParticle(hitPoint);
        ragdoll.applyImpulse(mul(dir, 6), ragdoll.positions[idx], 0.7);
      }
    }
  }

  step(dt) {
    const player = this.player;
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.damageFlash = Math.max(0, player.damageFlash - dt * 2.2);

    if (player.dead) {
      player.respawnTimer -= dt;
      if (player.respawnTimer <= 0) player.respawn();
    } else {
      const wish = this.wishDirection();
      const wantJump = this.keys.has('Space');
      const wasAir = !player.controller.onGround;
      player.controller.update(this.collision, wish, wantJump, dt);

      if (player.controller.justJumped) playSound('jump', 0.6);
      if (player.controller.justLanded && wasAir) playSound('land', 0.5);

      // Footsteps keyed to distance travelled rather than time, so they stay
      // in sync whether walking or sprinting.
      if (player.controller.onGround) {
        const speed = Math.hypot(player.controller.velocity[0], player.controller.velocity[2]);
        player.stepAccum += speed * dt;
        if (player.stepAccum > 2.2) {
          player.stepAccum = 0;
          playSound('step', 0.5);
        }
      }

      if (player.position[1] < -60) {
        player.takeDamage(1000, null);
      }
    }

    if (this.mouseDown) this.fire();

    this.world.update(dt);
    this.ragdolls.update(this.collision, dt);
  }

  render() {
    const aspect = this.renderer.resize();
    const player = this.player;
    const camera = {
      position: player.eyePosition,
      forward: player.forward,
      fov: 78,
    };

    this.env.pointLights = this.world.collectPointLights();

    this.renderer.beginShadowPass();
    this.renderer.drawWorld(true);
    this.world.draw(this.renderer, true);
    this.ragdolls.draw(this.renderer, true);
    this.renderer.endShadowPass();

    this.renderer.beginFrame(camera, this.env, aspect);
    this.renderer.drawWorld(false);
    this.world.draw(this.renderer, false);
    this.ragdolls.draw(this.renderer, false);
  }

  updateHUD() {
    if (!this.hud) return;
    const p = this.player;
    this.hud.update({
      health: Math.ceil(p.health),
      ammo: p.ammo,
      kills: p.kills,
      ragdolls: this.ragdolls.count,
      fps: Math.round(this.fps),
      dead: p.dead,
      damageFlash: p.damageFlash,
      entities: this.world.entities.length,
      map: this.mapName,
      debug: this.spawnWarning || this.debugText,
    });
  }

  frame(now) {
    // start() is called immediately while load() is still in flight, so the
    // first frames run before there's a world to draw.
    if (!this.world || !this.player) {
      requestAnimationFrame((t) => this.frame(t));
      return;
    }
    if (!this.lastTime) this.lastTime = now;
    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // A long stall (tab in background) must not be simulated all at once.
    if (frameTime > 0.25) frameTime = 0.25;

    this.fpsAccum += frameTime;
    this.frameCount++;
    if (this.fpsAccum >= 0.4) {
      this.fps = this.frameCount / this.fpsAccum;
      this.fpsAccum = 0;
      this.frameCount = 0;
    }

    if (!this.paused) {
      this.accumulator += frameTime;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
        this.step(FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_SUBSTEPS) this.accumulator = 0;
    }

    this.render();
    this.updateHUD();
    requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    requestAnimationFrame((t) => this.frame(t));
  }
}

export { defineEntity, pointInBrush };
