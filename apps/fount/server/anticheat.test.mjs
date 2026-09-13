#!/usr/bin/env node
// Anticheat test suite. Speaks the wire protocol directly — no engine, no
// collision, no honesty — which is exactly what a real cheat client does.
//
//   node server/anticheat.test.mjs
//
// It starts its own server on a spare port and shuts it down afterwards. No npm
// dependencies: Node 21+ has a WebSocket client built in, the same reason the
// server hand-rolls its WebSocket server rather than taking one from npm.
//
// Run this after changing anticheat.mjs, the engine's movement constants, or
// the weapon values in game.js. Thresholds that were measured against one
// version of the movement code are not automatically right for the next.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { buildMap } from '../engine/map.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.FOUNT_TEST_PORT || 8791);
const MAP = 'game/maps/dm_crucible.json';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  const tag = pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${tag}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Pick test positions from the real map rather than by eye. Standing inside the
// catwalk and calling the anticheat wrong is a mistake this suite should not be
// able to make.
// ---------------------------------------------------------------------------

function findPositions() {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, MAP), 'utf8'));
  const world = buildMap(doc).collision;
  const full = [0.35, 0.9, 0.35];
  const free = [];
  for (let x = -18; x <= 18; x += 1) {
    for (let z = -18; z <= 18; z += 1) {
      const p = [x, 0.95, z];
      if (world.pointInSolid(p, full)) continue;
      const down = world.traceBox(p, [x, p[1] - 1.2, z], full);
      if (!down.hit || down.normal[1] < 0.7) continue;   // must stand on something
      free.push(p);
    }
  }
  const eye = (p) => [p[0], p[1] + 0.72, p[2]];
  let clear = null;
  let walled = null;
  for (const a of free) {
    for (const b of free) {
      const d = Math.hypot(a[0] - b[0], a[2] - b[2]);
      if (d < 9 || d > 12) continue;
      const t = world.traceRay(eye(a), eye(b));
      if (!clear && !t.hit) clear = [a, b];
      if (!walled && t.hit && t.fraction < 0.85) walled = [a, b];
      if (clear && walled) break;
    }
    if (clear && walled) break;
  }
  if (!clear || !walled) throw new Error('could not find suitable test positions in the map');
  // Anchor both cases on the same shooter position so one cheater setup serves.
  const shooter = clear[0];
  let hidden = walled[0] === shooter ? walled[1] : null;
  if (!hidden) {
    for (const b of free) {
      const t = world.traceRay(eye(shooter), eye(b));
      const d = Math.hypot(shooter[0] - b[0], shooter[2] - b[2]);
      if (d > 8 && d < 20 && t.hit && t.fraction < 0.85) { hidden = b; break; }
    }
  }
  if (!hidden) throw new Error('could not find a wall-separated position');
  const elsewhere = free.find((p) => Math.hypot(p[0] - shooter[0], p[2] - shooter[2]) > 25) || free[free.length - 1];
  return { A: shooter, B: clear[1], WALLED: hidden, FAR: elsewhere };
}

// ---------------------------------------------------------------------------
// A deliberately dishonest client.
// ---------------------------------------------------------------------------

class Client {
  constructor(name) { this.name = name; this.msgs = []; }

  async connect() {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      this.msgs.push(m);
      if (m.t === 'welcome') { this.self = m.id; this.cheatsAllowed = m.cheatsAllowed; }
      if (m.t === 'state') this.lastState = m;
      if (m.t === 'correct') this.corrected = m;
    });
    this.ws.addEventListener('close', (ev) => { this.closed = { code: ev.code, reason: ev.reason }; });
    await sleep(300);
    this.send({ t: 'name', name: this.name });
    return this;
  }

  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  close() { try { this.ws.close(); } catch { /* already gone */ } }

  at(pos, angles = this.angles || [0, 0, 0]) {
    this.angles = angles;
    this.pos = pos;
    this.send({ t: 'input', pos, angles, moving: false });
  }

  /** Angles that genuinely look along `dir`, the way a real client's would. */
  static anglesFor(dir) {
    const n = Math.hypot(...dir) || 1;
    const d = dir.map((v) => v / n);
    return [
      -Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI,
      Math.atan2(-d[2], d[0]) * 180 / Math.PI,
      0,
    ];
  }

  async aimAndShoot(dir) {
    const n = Math.hypot(...dir) || 1;
    const unit = dir.map((v) => v / n);
    this.at(this.pos, Client.anglesFor(unit));
    await sleep(80);
    this.send({ t: 'shoot', origin: [this.pos[0], this.pos[1] + 0.72, this.pos[2]], dir: unit });
    await sleep(120);
    return unit;
  }

  of(id) { return (this.lastState?.players || []).find((p) => p.id === id); }
  health(id) { return this.of(id)?.health ?? null; }
  kills(id) { return this.of(id)?.kills ?? null; }
  count(t) { return this.msgs.filter((m) => m.t === t).length; }
}

// ---------------------------------------------------------------------------

async function main() {
  const { A, B, WALLED, FAR } = findPositions();

  const server = spawn(process.execPath, [
    path.join(ROOT, 'server', 'server.mjs'),
    '--port', String(PORT), '--name', 'Anticheat Test', '--map', MAP,
  ], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
  let serverOut = '';
  server.stdout.on('data', (d) => { serverOut += d; });
  server.stderr.on('data', (d) => { serverOut += d; });
  await sleep(1500);
  if (server.exitCode !== null) {
    console.error('server failed to start:\n' + serverOut);
    process.exit(1);
  }

  const victim = await new Client('Victim').connect();
  await sleep(400);

  // The server refuses hits on a dead target, so a dead victim would make every
  // later case pass for the wrong reason. Keep them alive and in place.
  async function parkVictim(pos) {
    for (let i = 0; i < 20; i++) {
      const me = victim.of(victim.self);
      if (!me || !me.dead) break;
      victim.send({ t: 'respawn' });      // honoured only after the death delay
      await sleep(400);
    }
    for (let i = 0; i < 6; i++) { victim.at(pos); await sleep(60); }
    await sleep(300);
  }

  // Each case gets a fresh cheater: violations accumulate toward a kick, so a
  // shared one would leave later cases talking to a closed socket.
  async function freshCheater(pos) {
    const c = await new Client('Cheater').connect();
    await sleep(300);
    // Sit still until the join grace expires — the server exempts the spawn
    // teleport, so testing inside that window tests the exemption.
    for (let i = 0; i < 60; i++) { c.at(pos); await sleep(60); }
    await sleep(300);
    return c;
  }

  const toB = [B[0] - A[0], 0, B[2] - A[2]];

  // -- combat -----------------------------------------------------------------

  await parkVictim(B);
  {
    const c = await freshCheater(A);
    const before = c.health(victim.self);
    c.send({ t: 'hit', target: victim.self, damage: 9999, point: B });
    await sleep(400);
    ok('a hit with no matching shot is refused', c.health(victim.self) === before,
      `health ${before} -> ${c.health(victim.self)}`);
    c.close();
  }

  await parkVictim(B);
  {
    // A LEGITIMATE shot must land. If this fails the anticheat is broken, not
    // strict, and every case below it is meaningless.
    const c = await freshCheater(A);
    const before = c.health(victim.self);
    await c.aimAndShoot(toB);
    c.send({ t: 'hit', target: victim.self, damage: 9999, point: B });
    await sleep(400);
    const after = c.health(victim.self);
    // The eye is 0.72 above the origin and the head line 0.55, so a level shot
    // between players on one floor genuinely lands above the head line. What
    // matters is that the server decided that, not the client's 9999.
    ok('a real shot lands, for the server\'s damage not the claimed one',
      after === before - 100, `health ${before} -> ${after}`);

    c.send({ t: 'hit', target: victim.self, damage: 25, point: B });
    await sleep(300);
    ok('one shot cannot be spent on two hits', c.health(victim.self) === after,
      `health ${after} -> ${c.health(victim.self)}`);
    c.close();
  }

  await parkVictim(B);
  {
    const c = await freshCheater(A);
    const before = c.health(victim.self);
    await c.aimAndShoot(toB);
    // Claim the hit landed at the victim's feet. Believing the claim would mean
    // body damage; tracing the real ray means a head shot.
    c.send({ t: 'hit', target: victim.self, damage: 100, point: [B[0], B[1] - 0.85, B[2]] });
    await sleep(400);
    ok('the claimed hit point does not decide the damage either',
      c.health(victim.self) === before - 100,
      `health ${before} -> ${c.health(victim.self)}`);
    c.close();
  }

  {
    const c = await freshCheater(A);
    const unit = toB.map((v) => v / Math.hypot(...toB));
    c.at(A, Client.anglesFor(unit));
    await sleep(100);
    const before = victim.count('shoot');
    for (let i = 0; i < 30; i++) {
      c.send({ t: 'shoot', origin: [A[0], A[1] + 0.72, A[2]], dir: unit });
      await sleep(5);
    }
    await sleep(400);
    const relayed = victim.count('shoot') - before;
    ok('the weapon fire rate is enforced', relayed <= 3, `${relayed} of 30 rapid shots relayed`);
    c.close();
  }

  {
    const c = await freshCheater(A);
    const unit = toB.map((v) => v / Math.hypot(...toB));
    c.at(A, Client.anglesFor(unit));
    await sleep(100);
    const before = victim.count('shoot');
    for (let i = 0; i < 40; i++) {
      c.send({ t: 'shoot', origin: [A[0], A[1] + 0.72, A[2]], dir: unit });
      await sleep(115);
    }
    await sleep(300);
    const relayed = victim.count('shoot') - before;
    ok('ammo is finite', relayed <= 31, `${relayed} of 40 legal-rate shots relayed (30 rounds)`);
    c.close();
  }

  {
    // A second honest player, parked behind solid brushwork from the moment
    // they join so no move of their own muddies the result.
    const hidden = await new Client('Hidden').connect();
    for (let i = 0; i < 8; i++) { hidden.at(WALLED); await sleep(60); }
    await sleep(300);
    const c = await freshCheater(A);
    const before = c.health(hidden.self);
    await c.aimAndShoot([WALLED[0] - A[0], 0, WALLED[2] - A[2]]);
    c.send({ t: 'hit', target: hidden.self, damage: 100, point: WALLED });
    await sleep(400);
    ok('shooting through a wall is refused', c.health(hidden.self) === before,
      `health ${before} -> ${c.health(hidden.self)}`);
    c.close(); hidden.close();
  }

  await parkVictim(B);
  {
    const c = await freshCheater(A);
    const before = c.health(victim.self);
    c.at(A, [0, 0, 0]);                       // looking away from the victim
    await sleep(120);
    const unit = toB.map((v) => v / Math.hypot(...toB));
    c.send({ t: 'shoot', origin: [A[0], A[1] + 0.72, A[2]], dir: unit });
    await sleep(120);
    c.send({ t: 'hit', target: victim.self, damage: 100, point: B });
    await sleep(400);
    ok('a shot that does not match the view is refused',
      c.health(victim.self) === before, `health ${before} -> ${c.health(victim.self)}`);
    c.close();
  }

  await parkVictim(B);
  {
    const c = await freshCheater(A);
    const before = c.health(victim.self);
    c.send({ t: 'shoot', origin: [400, 2.5, 5], dir: [-1, 0, 0] });
    await sleep(120);
    c.send({ t: 'hit', target: victim.self, damage: 100, point: B });
    await sleep(400);
    ok('a shot that did not come from the player is refused',
      c.health(victim.self) === before, `health ${before} -> ${c.health(victim.self)}`);
    c.close();
  }

  await parkVictim(B);
  {
    const c = await freshCheater(A);
    const before = c.kills(c.self);
    await c.aimAndShoot(toB);
    c.send({ t: 'hit', target: c.self, damage: 9999, point: A });
    await sleep(400);
    ok('a player cannot claim a hit on themselves', c.kills(c.self) === before,
      `kills ${before} -> ${c.kills(c.self)}`);
    c.close();
  }

  {
    const c = await freshCheater(A);
    c.send({ t: 'selfdamage', amount: 500 });      // an honest way to die
    await sleep(500);
    const dead = c.of(c.self)?.dead;
    const before = victim.count('shoot');
    await c.aimAndShoot(toB);
    await sleep(300);
    ok('a dead player cannot shoot', dead === true && victim.count('shoot') === before,
      `dead=${dead}, ${victim.count('shoot') - before} shots relayed`);
    c.close();
  }

  // -- movement ---------------------------------------------------------------

  {
    const c = await freshCheater(A);
    c.corrected = null;
    c.at(FAR);
    await sleep(500);
    ok('a teleport across the map is corrected', !!c.corrected,
      c.corrected ? c.corrected.reason : 'no correction sent');
    c.close();
  }

  {
    const c = await freshCheater(A);
    c.corrected = null;
    for (let i = 0; i < 4; i++) { c.at([A[0], A[1] - 0.35, A[2]]); await sleep(80); }
    for (let i = 0; i < 4; i++) { c.at([A[0], A[1] - 0.9, A[2]]); await sleep(80); }
    await sleep(400);
    ok('sinking into solid ground is caught', !!c.corrected,
      c.corrected ? c.corrected.reason : 'no correction sent');
    c.close();
  }

  // -- self-reported state ----------------------------------------------------

  {
    const c = await freshCheater(A);
    for (let i = 0; i < 4; i++) {
      c.send({ t: 'input', pos: A, angles: [0, 0, 0], health: 9999, dead: false, kills: 999 });
      await sleep(70);
    }
    await sleep(300);
    ok('self-reported health is not read', c.health(c.self) === 100, `server health ${c.health(c.self)}`);
    ok('self-reported kills are not read', c.kills(c.self) === 0, `server kills ${c.kills(c.self)}`);
    c.close();
  }

  // -- enforcement ------------------------------------------------------------

  await parkVictim(B);
  {
    const c = await freshCheater(A);
    for (let i = 0; i < 40 && !c.closed; i++) {
      c.send({ t: 'hit', target: victim.self, damage: 100, point: B });
      await sleep(40);
    }
    await sleep(1000);
    ok('sustained cheating gets the client kicked', !!c.closed,
      c.closed ? `close code ${c.closed.code}` : 'still connected');
    c.close();
  }

  // The whole point: none of that touched the player who did nothing wrong.
  ok('the honest client was never corrected or kicked',
    !victim.closed && !victim.corrected,
    victim.closed ? 'kicked' : (victim.corrected ? 'corrected' : 'untouched'));

  victim.close();
  server.kill();
  await sleep(200);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
