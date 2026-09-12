// The built-in entity library. Everything here is addressable from map JSON by
// classname, and most of it is wired together through outputs/inputs rather
// than code. Games add their own classes with defineEntity() in game/scripts/.

import { defineEntity } from './entity.js';
import { add, sub, mul, norm, len, dist, dot, clamp, lerp } from './math.js';
import { RigidBody, CharacterController } from './physics.js';
import { playSoundAt, playSound } from './audio.js';
import { pointInBrush } from './map.js';

const layerOf = (world, name, fallback = 0) =>
  world.context.materialIndex.get(name) ?? fallback;

// ---------------------------------------------------------------------------
// Spawn points and lights
// ---------------------------------------------------------------------------

defineEntity('info_player_start', {});

defineEntity('light', {
  spawn(entity) {
    entity.kv.color = entity.get('color', [1, 0.9, 0.7]);
    entity.kv.radius = entity.get('radius', 9);
    entity.kv.brightness = entity.get('brightness', 1);
  },
  inputs: {
    TurnOn(entity) { entity.enabled = true; },
    TurnOff(entity) { entity.enabled = false; },
    Toggle(entity) { entity.enabled = !entity.enabled; },
    SetBrightness(entity, world, ctx) {
      const v = parseFloat(ctx.param);
      if (Number.isFinite(v)) entity.kv.brightness = v;
    },
  },
});

// ---------------------------------------------------------------------------
// Physics props
// ---------------------------------------------------------------------------

defineEntity('prop_physics', {
  spawn(entity, world) {
    const size = entity.get('size', [0.4, 0.4, 0.4]);
    entity.state.body = new RigidBody({
      position: [...entity.origin],
      halfExtents: size,
      restitution: entity.get('restitution', 0.28),
    });
    entity.state.layer = layerOf(world, entity.get('material', 'panel'), 5);
    entity.state.health = entity.get('health', 0);
  },
  think(entity, world, dt) {
    const body = entity.state.body;
    body.update(world.context.collision, dt);
    entity.origin = body.position;
    if (entity.origin[1] < -50) world.remove(entity);
  },
  draw(entity, renderer, shadowPass) {
    const body = entity.state.body;
    renderer.drawBox(body.position, body.halfExtents, entity.state.layer, entity.get('tint', [1, 1, 1]), null, shadowPass);
  },
  inputs: {
    Push(entity, world, ctx) {
      const dir = norm(entity.get('pushDir', [0, 1, 0]));
      entity.state.body.addImpulse(mul(dir, parseFloat(ctx.param) || 6));
    },
    Damage(entity, world, ctx) {
      if (!entity.state.health) return;
      entity.state.health -= parseFloat(ctx.param) || 10;
      if (entity.state.health <= 0) {
        world.fireOutput(entity, 'OnBreak', ctx.activator);
        playSoundAt('impact', entity.origin, world.context.listener(), 30);
        world.remove(entity);
      }
    },
  },
});

// ---------------------------------------------------------------------------
// Brush entities: doors and platforms move a box and update their collision.
// ---------------------------------------------------------------------------

function brushEntitySpawn(entity, world) {
  const min = entity.get('min', [0, 0, 0]);
  const max = entity.get('max', [1, 1, 1]);
  entity.state.baseMin = min;
  entity.state.baseMax = max;
  entity.state.offset = 0;
  entity.state.target = 0;
  entity.state.moveDir = norm(entity.get('moveDir', [0, 1, 0]));
  entity.state.distance = entity.get('distance', 2);
  entity.state.speed = entity.get('speed', 2.2);
  entity.state.layer = layerOf(world, entity.get('material', 'metal'), 3);
  entity.state.dynamicBrush = { planes: [], min: [...min], max: [...max], entity };
  world.context.registerDynamicBrush(entity.state.dynamicBrush);
  updateBrushEntity(entity, 0);
}

function updateBrushEntity(entity) {
  const shift = mul(entity.state.moveDir, entity.state.offset);
  const min = add(entity.state.baseMin, shift);
  const max = add(entity.state.baseMax, shift);
  const b = entity.state.dynamicBrush;
  b.min = min;
  b.max = max;
  b.planes = [
    { n: [1, 0, 0], d: max[0] }, { n: [-1, 0, 0], d: -min[0] },
    { n: [0, 1, 0], d: max[1] }, { n: [0, -1, 0], d: -min[1] },
    { n: [0, 0, 1], d: max[2] }, { n: [0, 0, -1], d: -min[2] },
  ];
  entity.origin = mul(add(min, max), 0.5);
}

function brushEntityThink(entity, world, dt) {
  const s = entity.state;
  if (Math.abs(s.offset - s.target) < 1e-4) return;
  const dir = Math.sign(s.target - s.offset);
  s.offset += dir * s.speed * dt;
  if ((dir > 0 && s.offset >= s.target) || (dir < 0 && s.offset <= s.target)) {
    s.offset = s.target;
    world.fireOutput(entity, s.target > 0 ? 'OnFullyOpen' : 'OnFullyClosed');
  }
  updateBrushEntity(entity);
}

function brushEntityDraw(entity, renderer, shadowPass) {
  const b = entity.state.dynamicBrush;
  const center = mul(add(b.min, b.max), 0.5);
  const half = mul(sub(b.max, b.min), 0.5);
  renderer.drawBox(center, half, entity.state.layer, entity.get('tint', [1, 1, 1]), null, shadowPass);
}

defineEntity('func_door', {
  spawn: brushEntitySpawn,
  think: brushEntityThink,
  draw: brushEntityDraw,
  inputs: {
    Open(entity, world) {
      if (entity.state.target === entity.state.distance) return;
      entity.state.target = entity.state.distance;
      playSoundAt('door', entity.origin, world.context.listener(), 25);
      world.fireOutput(entity, 'OnOpen');
    },
    Close(entity, world) {
      if (entity.state.target === 0) return;
      entity.state.target = 0;
      playSoundAt('door', entity.origin, world.context.listener(), 25);
      world.fireOutput(entity, 'OnClose');
    },
    Toggle(entity, world) {
      const def = entity.state.target === 0 ? 'Open' : 'Close';
      world.sendInput(entity.name, def);
    },
  },
});

defineEntity('func_platform', {
  spawn(entity, world) {
    brushEntitySpawn(entity, world);
    entity.state.auto = entity.get('auto', true);
    entity.state.waitTimer = 0;
    entity.state.wait = entity.get('wait', 1.5);
  },
  think(entity, world, dt) {
    const s = entity.state;
    if (s.auto && Math.abs(s.offset - s.target) < 1e-4) {
      s.waitTimer += dt;
      if (s.waitTimer >= s.wait) {
        s.waitTimer = 0;
        s.target = s.target === 0 ? s.distance : 0;
      }
    }
    brushEntityThink(entity, world, dt);
  },
  draw: brushEntityDraw,
  inputs: {
    Start(entity) { entity.state.auto = true; },
    Stop(entity) { entity.state.auto = false; },
  },
});

// ---------------------------------------------------------------------------
// Triggers and logic
// ---------------------------------------------------------------------------

defineEntity('trigger_multiple', {
  spawn(entity, world) {
    const region = world.context.findTriggerBrush(entity.name);
    entity.state.planes = region ? region.planes : null;
    entity.state.inside = false;
    entity.state.cooldown = 0;
    entity.state.wait = entity.get('wait', 0.5);
  },
  think(entity, world, dt) {
    if (!entity.state.planes) return;
    entity.state.cooldown = Math.max(0, entity.state.cooldown - dt);
    const player = world.context.player;
    const inside = pointInBrush(entity.state.planes, player.position, 0.35);

    if (inside && !entity.state.inside) {
      entity.state.inside = true;
      if (entity.state.cooldown <= 0) {
        entity.state.cooldown = entity.state.wait;
        world.fireOutput(entity, 'OnStartTouch', player.entity || null);
      }
    } else if (!inside && entity.state.inside) {
      entity.state.inside = false;
      world.fireOutput(entity, 'OnEndTouch', player.entity || null);
    }
  },
});

defineEntity('logic_relay', {
  inputs: {
    Trigger(entity, world, ctx) {
      world.fireOutput(entity, 'OnTrigger', ctx.activator, ctx.param);
    },
  },
});

defineEntity('logic_timer', {
  spawn(entity) {
    entity.state.accum = 0;
    entity.state.interval = entity.get('interval', 2);
    entity.enabled = entity.get('startEnabled', true);
  },
  think(entity, world, dt) {
    entity.state.accum += dt;
    if (entity.state.accum >= entity.state.interval) {
      entity.state.accum = 0;
      world.fireOutput(entity, 'OnTimer');
    }
  },
  inputs: {
    SetInterval(entity, world, ctx) {
      const v = parseFloat(ctx.param);
      if (Number.isFinite(v) && v > 0) entity.state.interval = v;
    },
  },
});

defineEntity('logic_counter', {
  spawn(entity) {
    entity.state.count = 0;
    entity.state.threshold = entity.get('threshold', 3);
  },
  inputs: {
    Add(entity, world, ctx) {
      entity.state.count += parseFloat(ctx.param) || 1;
      world.fireOutput(entity, 'OnChanged', ctx.activator, String(entity.state.count));
      if (entity.state.count >= entity.state.threshold) {
        world.fireOutput(entity, 'OnThreshold', ctx.activator);
        entity.state.count = 0;
      }
    },
    Reset(entity) { entity.state.count = 0; },
  },
});

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

function pickupThink(entity, world, dt, onCollect) {
  entity.state.bob = (entity.state.bob || 0) + dt * 2.5;
  const player = world.context.player;
  if (dist(player.position, entity.origin) < 1.1) {
    onCollect(entity, world, player);
    playSoundAt('pickup', entity.origin, world.context.listener(), 20);
    world.fireOutput(entity, 'OnPickup', player.entity || null);
    world.remove(entity);
  }
}

defineEntity('item_health', {
  spawn(entity, world) { entity.state.layer = layerOf(world, entity.get('material', 'light_panel'), 7); },
  think(entity, world, dt) {
    pickupThink(entity, world, dt, (e, w, player) => {
      player.health = Math.min(player.maxHealth, player.health + e.get('amount', 25));
    });
  },
  draw(entity, renderer, shadowPass) {
    const y = entity.origin[1] + Math.sin(entity.state.bob || 0) * 0.12 + 0.4;
    renderer.drawBox([entity.origin[0], y, entity.origin[2]], [0.18, 0.18, 0.18], entity.state.layer, [0.4, 1, 0.5], null, shadowPass);
  },
});

defineEntity('item_ammo', {
  spawn(entity, world) { entity.state.layer = layerOf(world, entity.get('material', 'metal'), 3); },
  think(entity, world, dt) {
    pickupThink(entity, world, dt, (e, w, player) => {
      player.ammo += e.get('amount', 30);
    });
  },
  draw(entity, renderer, shadowPass) {
    const y = entity.origin[1] + Math.sin(entity.state.bob || 0) * 0.1 + 0.35;
    renderer.drawBox([entity.origin[0], y, entity.origin[2]], [0.2, 0.12, 0.14], entity.state.layer, [1, 0.85, 0.3], null, shadowPass);
  },
});

// ---------------------------------------------------------------------------
// NPCs. The death path here is the whole point of the engine's party trick:
// the character controller's live velocity is handed straight to the ragdoll,
// plus the impulse of whatever killed it, applied at the point it was hit.
// ---------------------------------------------------------------------------

export function killNPC(entity, world, options = {}) {
  if (entity.state.dead) return;
  entity.state.dead = true;

  const ctrl = entity.state.controller;
  const feet = [ctrl.position[0], ctrl.position[1] - ctrl.halfExtents[1], ctrl.position[2]];

  const ragdoll = world.context.ragdolls.spawn({
    origin: feet,
    yaw: entity.state.yaw || 0,
    velocity: ctrl.velocity,
    tint: entity.get('tint', [1, 1, 1]),
    materials: {
      body: layerOf(world, entity.get('bodyMaterial', 'cloth'), 9),
      skin: layerOf(world, entity.get('skinMaterial', 'flesh'), 8),
    },
    lifetime: entity.get('ragdollLifetime', 40),
  });

  if (options.impulse) {
    const at = options.hitPoint || add(feet, [0, 1.2, 0]);
    ragdoll.applyImpulse(options.impulse, at, options.impulseRadius ?? 0.8);
  }

  playSoundAt('die', entity.origin, world.context.listener(), 40);
  world.fireOutput(entity, 'OnDeath', options.attacker || null);
  world.remove(entity);
}

defineEntity('npc_grunt', {
  spawn(entity, world) {
    entity.state.controller = new CharacterController({
      position: add(entity.origin, [0, 0.9, 0]),
      halfExtents: [0.32, 0.9, 0.32],
      maxSpeed: entity.get('speed', 3.4),
      acceleration: 10,
      jumpSpeed: 6,
    });
    entity.state.health = entity.get('health', 40);
    entity.state.yaw = entity.angles[1] || 0;
    entity.state.walkCycle = 0;
    entity.state.attackCooldown = 0;
    entity.state.dead = false;
    entity.state.bodyLayer = layerOf(world, entity.get('bodyMaterial', 'cloth'), 9);
    entity.state.skinLayer = layerOf(world, entity.get('skinMaterial', 'flesh'), 8);
    entity.state.home = [...entity.origin];
  },

  think(entity, world, dt) {
    const s = entity.state;
    const ctrl = s.controller;
    const player = world.context.player;
    const toPlayer = sub(player.position, ctrl.position);
    const distance = len(toPlayer);
    const sightRange = entity.get('sightRange', 26);

    let wish = [0, 0, 0];
    if (distance < sightRange && player.health > 0) {
      const flat = norm([toPlayer[0], 0, toPlayer[2]]);
      s.yaw = Math.atan2(-flat[2], flat[0]) * 180 / Math.PI;

      const keepAway = entity.get('keepDistance', 2.2);
      if (distance > keepAway) wish = flat;

      s.attackCooldown -= dt;
      if (distance < entity.get('attackRange', 14) && s.attackCooldown <= 0) {
        s.attackCooldown = entity.get('attackInterval', 1.4);
        const damage = entity.get('damage', 8);
        // Line of sight check keeps NPCs from shooting through walls.
        const eye = add(ctrl.position, [0, 0.5, 0]);
        const trace = world.context.collision.traceRay(eye, player.position);
        if (!trace.hit || trace.fraction > 0.95) {
          player.takeDamage(damage, entity);
          playSoundAt('shoot', ctrl.position, world.context.listener(), 45);
          world.fireOutput(entity, 'OnAttack', entity);
        }
      }
    }

    ctrl.update(world.context.collision, wish, false, dt);
    entity.origin = [ctrl.position[0], ctrl.position[1] - ctrl.halfExtents[1], ctrl.position[2]];
    s.walkCycle += len([ctrl.velocity[0], 0, ctrl.velocity[2]]) * dt * 2.4;

    if (ctrl.position[1] < -40) killNPC(entity, world, {});
  },

  draw(entity, renderer, shadowPass) {
    const s = entity.state;
    const ctrl = s.controller;
    const feet = [ctrl.position[0], ctrl.position[1] - ctrl.halfExtents[1], ctrl.position[2]];
    const tint = entity.get('tint', [1, 1, 1]);
    const yawRad = s.yaw * Math.PI / 180;
    const right = [Math.sin(yawRad), 0, Math.cos(yawRad)];

    const swing = Math.sin(s.walkCycle) * 0.34;
    const hip = [feet[0], feet[1] + 0.92, feet[2]];
    const legOffset = mul(right, 0.14);

    // Legs drawn as swinging segments so the alive pose reads as the same
    // skeleton the ragdoll takes over.
    const forward = [Math.cos(yawRad), 0, -Math.sin(yawRad)];
    for (const side of [-1, 1]) {
      const hipP = add(hip, mul(legOffset, side));
      const footP = add(
        [hipP[0], feet[1] + 0.06, hipP[2]],
        mul(forward, swing * side),
      );
      const kneeP = [
        (hipP[0] + footP[0]) / 2,
        (hipP[1] + footP[1]) / 2 + 0.04,
        (hipP[2] + footP[2]) / 2,
      ];
      renderer.drawSegment(hipP, kneeP, 0.07, s.bodyLayer, tint, shadowPass);
      renderer.drawSegment(kneeP, footP, 0.055, s.bodyLayer, tint, shadowPass);
    }

    renderer.drawSegment([feet[0], feet[1] + 0.92, feet[2]], [feet[0], feet[1] + 1.5, feet[2]], 0.13, s.bodyLayer, tint, shadowPass);

    const shoulder = [feet[0], feet[1] + 1.44, feet[2]];
    for (const side of [-1, 1]) {
      const sh = add(shoulder, mul(right, 0.2 * side));
      const hand = add([sh[0], feet[1] + 0.9, sh[2]], mul(forward, -swing * side * 0.6));
      renderer.drawSegment(sh, hand, 0.05, s.bodyLayer, tint, shadowPass);
    }

    renderer.drawSphere([feet[0], feet[1] + 1.66, feet[2]], 0.13, s.skinLayer, tint, shadowPass);
  },

  inputs: {
    Damage(entity, world, ctx) {
      const amount = parseFloat(ctx.param) || 10;
      entity.state.health -= amount;
      world.fireOutput(entity, 'OnDamaged', ctx.activator, String(entity.state.health));
      if (entity.state.health <= 0) {
        killNPC(entity, world, { attacker: ctx.activator, impulse: ctx.impulse, hitPoint: ctx.hitPoint });
      } else {
        playSoundAt('hurt', entity.origin, world.context.listener(), 30);
      }
    },
    Kill(entity, world, ctx) {
      killNPC(entity, world, { attacker: ctx.activator, impulse: [0, 4, 0] });
    },
  },
});

// A pure ragdoll spawner, handy for testing the death physics without
// having to fight an NPC first.
defineEntity('point_ragdoll', {
  inputs: {
    Spawn(entity, world) {
      world.context.ragdolls.spawn({
        origin: entity.origin,
        yaw: entity.angles[1] || 0,
        velocity: entity.get('velocity', [0, 2, 0]),
        materials: {
          body: layerOf(world, entity.get('bodyMaterial', 'cloth'), 9),
          skin: layerOf(world, entity.get('skinMaterial', 'flesh'), 8),
        },
      });
      playSoundAt('ragdoll', entity.origin, world.context.listener(), 30);
    },
  },
});

defineEntity('env_explosion', {
  inputs: {
    Explode(entity, world, ctx) {
      const radius = entity.get('radius', 6);
      const force = entity.get('force', 16);
      const damage = entity.get('damage', 60);
      playSoundAt('explosion', entity.origin, world.context.listener(), 70);

      for (const other of world.entities) {
        if (other.removed || other === entity) continue;
        const d = dist(other.origin, entity.origin);
        if (d > radius) continue;
        const falloff = 1 - d / radius;
        const dir = norm(add(sub(other.origin, entity.origin), [0, 0.6, 0]));

        if (other.classname === 'npc_grunt') {
          killNPC(other, world, {
            attacker: ctx.activator,
            impulse: mul(dir, force * falloff * 1.6),
            hitPoint: add(other.origin, [0, 1.0, 0]),
            impulseRadius: 2.5,
          });
        } else if (other.state.body) {
          other.state.body.addImpulse(mul(dir, force * falloff));
        }
      }

      // Explosions also throw existing bodies around, which is half the fun.
      for (const ragdoll of world.context.ragdolls.ragdolls) {
        const d = dist(ragdoll.center, entity.origin);
        if (d > radius * 1.4) continue;
        const falloff = 1 - d / (radius * 1.4);
        const dir = norm(add(sub(ragdoll.center, entity.origin), [0, 0.5, 0]));
        ragdoll.applyImpulse(mul(dir, force * falloff * 1.4), null);
      }

      const player = world.context.player;
      const pd = dist(player.position, entity.origin);
      if (pd < radius) player.takeDamage(damage * (1 - pd / radius), entity);

      world.fireOutput(entity, 'OnExplode', ctx.activator);
    },
  },
});
