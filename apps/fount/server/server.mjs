#!/usr/bin/env node
// Fount multiplayer server: serves the game over HTTP and runs the session
// over WebSocket. Node stdlib only — no npm install, no dependencies.
//
//   node server/server.mjs
//   node server/server.mjs --port 8080 --name "My Server" --map game/maps/dm_crucible.json
//
// Trust model, stated plainly because it governs what this is safe for:
// clients report their own position. The server relays state, enforces rate
// limits and a speed sanity check, and owns scores, chat and admin — but a
// modified client can still cheat at movement. That is the right trade for
// friends-and-community servers; it is not suitable for ranked competition.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { attachWebSocketServer } from './websocket.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  // map stays null until resolveStartMap picks one, so we can tell "the user
  // asked for this map" (a typo should be fatal) from "nobody said" (find one).
  const args = { port: 8099, name: 'Fount Server', map: null, maxPlayers: 16, host: '0.0.0.0' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--port' || a === '-p') args.port = parseInt(next(), 10);
    else if (a === '--name' || a === '-n') args.name = next();
    else if (a === '--map' || a === '-m') args.map = next();
    else if (a === '--max' ) args.maxPlayers = parseInt(next(), 10);
    else if (a === '--host') args.host = next();
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  console.log(`
Fount multiplayer server

  node server/server.mjs [options]

  --port, -p <n>     Port to listen on (default 8099)
  --name, -n <s>     Server name shown to players
  --map,  -m <path>  Starting map (default: the first one in game/maps/)
  --max <n>          Maximum players (default 16)
  --host <addr>      Bind address (default 0.0.0.0, all interfaces)

Once running, type admin commands directly into this terminal.
Type "help" there for the list.
`);
}

const args = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  // Resolve inside ROOT and verify: without this, ../../etc/passwd is servable.
  const filePath = path.resolve(ROOT, '.' + pathname);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

const TICK_MS = 50;                 // 20Hz snapshots
const INPUT_RATE_LIMIT = 40;        // client position updates per second
const CHAT_RATE_LIMIT = 4;          // messages per 5 seconds
const MAX_SPEED_SANITY = 40;        // m/s; well above legitimate movement

function mapExists(rel) {
  if (typeof rel !== 'string' || !rel) return false;
  const full = path.resolve(ROOT, rel);
  // Same containment rule the static server uses: a map path is a client-
  // supplied path too once an admin can set it.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return false;
  return fs.existsSync(full) && fs.statSync(full).isFile();
}

// Pick the map to start on. A scaffolded game has its own levels and no
// dm_crucible, so defaulting to a hard-coded name would hand every client a
// 404 on join; look at what is actually there instead.
function resolveStartMap(requested) {
  if (requested) {
    if (mapExists(requested)) return requested;
    console.error(`No such map: ${requested}`);
    console.error(`Looked in ${path.resolve(ROOT, requested)}`);
    process.exit(1);
  }
  const preferred = 'game/maps/dm_crucible.json';
  if (mapExists(preferred)) return preferred;
  const dir = path.join(ROOT, 'game', 'maps');
  const found = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    : [];
  if (!found.length) {
    console.error(`No maps found in ${dir}.`);
    console.error('Add a level there, or pass --map <path>.');
    process.exit(1);
  }
  return `game/maps/${found[0]}`;
}

let nextId = 1;
const players = new Map();          // id -> player
const bans = new Set();             // remote addresses
let currentMap = resolveStartMap(args.map);
const startedAt = Date.now();

const COLORS = [
  [1.0, 0.45, 0.4], [0.45, 0.75, 1.0], [0.55, 1.0, 0.6], [1.0, 0.85, 0.4],
  [0.85, 0.55, 1.0], [1.0, 0.65, 0.85], [0.5, 0.95, 0.95], [1.0, 0.72, 0.45],
];

function sanitizeName(raw, fallback) {
  const cleaned = String(raw ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 20);
  return cleaned || fallback;
}

function finiteVec(v, fallback = [0, 0, 0]) {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? v.map((n) => Math.max(-10000, Math.min(10000, n)))
    : fallback;
}

function broadcast(message, exceptId = null) {
  const text = JSON.stringify(message);
  for (const p of players.values()) {
    if (p.id !== exceptId) p.connection.send(text);
  }
}

function systemNotice(text) {
  broadcast({ t: 'chat', from: null, text });
  log(text);
}

function log(text) {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${text}`);
}

function playerSummary(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    pos: p.pos,
    angles: p.angles,
    health: p.health,
    kills: p.kills,
    deaths: p.deaths,
    dead: p.dead,
    moving: p.moving,
  };
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket
// ---------------------------------------------------------------------------

const httpServer = http.createServer((req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: args.name,
      map: currentMap,
      players: [...players.values()].map((p) => ({ name: p.name, kills: p.kills, deaths: p.deaths })),
      maxPlayers: args.maxPlayers,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    }));
    return;
  }
  serveStatic(req, res);
});

attachWebSocketServer(httpServer, (connection) => {
  if (bans.has(connection.remoteAddress)) {
    connection.close(4003, 'banned');
    return;
  }
  if (players.size >= args.maxPlayers) {
    connection.close(4000, 'server full');
    return;
  }

  const id = nextId++;
  const player = {
    id,
    connection,
    name: `Player${id}`,
    color: COLORS[(id - 1) % COLORS.length],
    pos: [0, 1, 0],
    angles: [0, 0, 0],
    health: 100,
    kills: 0,
    deaths: 0,
    dead: false,
    moving: false,
    admin: false,
    joinedAt: Date.now(),
    inputTimes: [],
    chatTimes: [],
    lastPos: null,
    lastPosTime: 0,
  };
  players.set(id, player);

  connection.on('message', (raw) => handleMessage(player, raw));
  connection.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
    systemNotice(`${player.name} left (${players.size} online)`);
  });

  connection.send(JSON.stringify({
    t: 'welcome',
    id,
    name: player.name,
    color: player.color,
    map: currentMap,
    serverName: args.name,
    tickMs: TICK_MS,
    players: [...players.values()].filter((p) => p.id !== id).map(playerSummary),
  }));

  broadcast({ t: 'join', player: playerSummary(player) }, id);
  systemNotice(`${player.name} joined (${players.size} online)`);
});

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

function rateLimited(times, limit, windowMs) {
  const now = Date.now();
  while (times.length && now - times[0] > windowMs) times.shift();
  if (times.length >= limit) return true;
  times.push(now);
  return false;
}

function handleMessage(player, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return; // malformed input is ignored rather than crashing the server
  }
  if (!msg || typeof msg.t !== 'string') return;

  switch (msg.t) {
    case 'input': {
      if (rateLimited(player.inputTimes, INPUT_RATE_LIMIT, 1000)) return;
      const pos = finiteVec(msg.pos, player.pos);

      // Sanity check, not real anti-cheat: catches obviously broken or
      // teleporting clients without pretending the server is authoritative.
      const now = Date.now();
      if (player.lastPos && player.lastPosTime) {
        const dt = Math.max((now - player.lastPosTime) / 1000, 0.001);
        const dist = Math.hypot(pos[0] - player.lastPos[0], pos[1] - player.lastPos[1], pos[2] - player.lastPos[2]);
        if (dist / dt > MAX_SPEED_SANITY && dt < 1) {
          player.suspicious = (player.suspicious || 0) + 1;
          if (player.suspicious === 20) log(`warning: ${player.name} is moving implausibly fast`);
        }
      }
      player.lastPos = pos;
      player.lastPosTime = now;

      player.pos = pos;
      player.angles = finiteVec(msg.angles, player.angles);
      player.moving = !!msg.moving;
      if (typeof msg.health === 'number' && Number.isFinite(msg.health)) {
        player.health = Math.max(0, Math.min(1000, msg.health));
      }
      player.dead = !!msg.dead;
      return;
    }

    case 'name': {
      const next = sanitizeName(msg.name, player.name);
      if (next === player.name) return;
      const old = player.name;
      player.name = next;
      broadcast({ t: 'rename', id: player.id, name: next });
      systemNotice(`${old} is now ${next}`);
      return;
    }

    case 'shoot': {
      // Relayed so everyone sees and hears the shot; damage is resolved by
      // the shooter's client and reported as a 'hit'.
      broadcast({
        t: 'shoot',
        id: player.id,
        origin: finiteVec(msg.origin, player.pos),
        dir: finiteVec(msg.dir, [0, 0, 1]),
      }, player.id);
      return;
    }

    case 'hit': {
      const target = players.get(msg.target);
      if (!target || target.dead) return;
      const damage = Math.max(0, Math.min(200, Number(msg.damage) || 0));
      target.health = Math.max(0, target.health - damage);
      broadcast({
        t: 'hit',
        target: target.id,
        by: player.id,
        damage,
        point: finiteVec(msg.point, target.pos),
        impulse: finiteVec(msg.impulse, [0, 0, 0]),
      });
      if (target.health <= 0 && !target.dead) {
        target.dead = true;
        target.deaths++;
        if (player.id !== target.id) player.kills++;
        broadcast({
          t: 'kill',
          victim: target.id,
          killer: player.id,
          point: finiteVec(msg.point, target.pos),
          impulse: finiteVec(msg.impulse, [0, 0, 0]),
        });
        systemNotice(`${player.name} killed ${target.name}`);
      }
      return;
    }

    case 'respawn': {
      player.dead = false;
      player.health = 100;
      player.pos = finiteVec(msg.pos, player.pos);
      broadcast({ t: 'respawn', id: player.id, pos: player.pos });
      return;
    }

    case 'chat': {
      if (rateLimited(player.chatTimes, CHAT_RATE_LIMIT, 5000)) return;
      const text = String(msg.text ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 200);
      if (!text) return;
      broadcast({ t: 'chat', from: player.name, id: player.id, text });
      log(`${player.name}: ${text}`);
      return;
    }

    case 'cmd': {
      const text = String(msg.text ?? '').trim();
      if (!text) return;
      if (!player.admin) {
        player.connection.send(JSON.stringify({ t: 'cmdresult', text: 'Not authorised. Ask the server operator to /admin you.' }));
        return;
      }
      const result = runAdminCommand(text, player.name);
      player.connection.send(JSON.stringify({ t: 'cmdresult', text: result }));
      return;
    }

    default:
  }
}

// ---------------------------------------------------------------------------
// Admin commands, shared by the server terminal and in-game admins
// ---------------------------------------------------------------------------

function findPlayer(needle) {
  const lower = String(needle).toLowerCase();
  for (const p of players.values()) {
    if (String(p.id) === needle || p.name.toLowerCase() === lower) return p;
  }
  for (const p of players.values()) {
    if (p.name.toLowerCase().includes(lower)) return p;
  }
  return null;
}

function runAdminCommand(line, issuedBy = 'console') {
  const parts = line.match(/"([^"]*)"|(\S+)/g)?.map((s) => s.replace(/^"|"$/g, '')) || [];
  const cmd = (parts[0] || '').toLowerCase();
  const rest = parts.slice(1);

  switch (cmd) {
    case 'help':
      return [
        'status            List connected players',
        'say <text>        Broadcast a server message',
        'kick <who> [why]  Disconnect a player',
        'ban <who>         Kick and block their address',
        'unban <addr>      Remove a ban',
        'bans              List bans',
        'admin <who>       Grant in-game admin rights',
        'unadmin <who>     Revoke admin rights',
        'map <path>        Change the map for everyone',
        'restart           Restart the current map for everyone',
        'quit              Shut the server down',
      ].join('\n');

    case 'status': {
      if (!players.size) return 'No players connected.';
      const rows = [...players.values()].map((p) => {
        const mins = Math.floor((Date.now() - p.joinedAt) / 60000);
        return `  #${p.id} ${p.name.padEnd(20)} ${String(p.kills).padStart(3)}k/${String(p.deaths).padStart(3)}d  ${p.admin ? 'admin ' : '      '}${mins}m  ${p.connection.remoteAddress}`;
      });
      return `${players.size}/${args.maxPlayers} players on ${currentMap}\n${rows.join('\n')}`;
    }

    case 'say': {
      const text = rest.join(' ');
      if (!text) return 'usage: say <text>';
      broadcast({ t: 'chat', from: null, text: `[server] ${text}` });
      log(`[server say] ${text}`);
      return 'sent';
    }

    case 'kick': {
      const target = findPlayer(rest[0]);
      if (!target) return `No such player: ${rest[0] ?? ''}`;
      const reason = rest.slice(1).join(' ') || 'kicked';
      target.connection.send(JSON.stringify({ t: 'kicked', reason }));
      target.connection.close(4001, reason);
      systemNotice(`${target.name} was kicked by ${issuedBy} (${reason})`);
      return `kicked ${target.name}`;
    }

    case 'ban': {
      const target = findPlayer(rest[0]);
      if (!target) return `No such player: ${rest[0] ?? ''}`;
      bans.add(target.connection.remoteAddress);
      target.connection.send(JSON.stringify({ t: 'kicked', reason: 'banned' }));
      target.connection.close(4003, 'banned');
      systemNotice(`${target.name} was banned by ${issuedBy}`);
      return `banned ${target.name} (${target.connection.remoteAddress})`;
    }

    case 'unban': {
      if (!rest[0]) return 'usage: unban <address>';
      return bans.delete(rest[0]) ? `unbanned ${rest[0]}` : `not banned: ${rest[0]}`;
    }

    case 'bans':
      return bans.size ? [...bans].map((b) => '  ' + b).join('\n') : 'No bans.';

    case 'admin': {
      const target = findPlayer(rest[0]);
      if (!target) return `No such player: ${rest[0] ?? ''}`;
      target.admin = true;
      target.connection.send(JSON.stringify({ t: 'cmdresult', text: 'You now have admin rights. Use /help in chat.' }));
      return `${target.name} is now an admin`;
    }

    case 'unadmin': {
      const target = findPlayer(rest[0]);
      if (!target) return `No such player: ${rest[0] ?? ''}`;
      target.admin = false;
      return `${target.name} is no longer an admin`;
    }

    case 'map': {
      if (!rest[0]) return `current map: ${currentMap}`;
      // Changing to a map that isn't there would 404 every client at once, so
      // refuse the typo rather than emptying the server.
      if (!mapExists(rest[0])) return `No such map: ${rest[0]} (server still on ${currentMap})`;
      currentMap = rest[0];
      broadcast({ t: 'map', map: currentMap });
      systemNotice(`Map changed to ${currentMap} by ${issuedBy}`);
      return `map set to ${currentMap}`;
    }

    case 'restart':
      broadcast({ t: 'map', map: currentMap });
      systemNotice(`Map restarted by ${issuedBy}`);
      return 'restarted';

    case 'quit':
      systemNotice('Server shutting down.');
      setTimeout(() => process.exit(0), 200);
      return 'shutting down';

    default:
      return `Unknown command "${cmd}". Type help.`;
  }
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

setInterval(() => {
  if (!players.size) return;
  broadcast({
    t: 'state',
    time: Date.now(),
    players: [...players.values()].map(playerSummary),
  });
}, TICK_MS);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

httpServer.listen(args.port, args.host, () => {
  const lines = [
    '',
    `  ${args.name}`,
    '',
    `    Play      http://localhost:${args.port}/`,
    `    Editor    http://localhost:${args.port}/editor/index.html`,
    `    Status    http://localhost:${args.port}/api/status`,
    '',
    `    Map       ${currentMap}`,
    `    Slots     ${args.maxPlayers}`,
    '',
    '  Type admin commands here (help for the list). Ctrl-C to stop.',
    '',
  ];
  console.log(lines.join('\n'));
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${args.port} is already in use. Try --port ${args.port + 1}.\n`);
    process.exit(1);
  }
  console.error('Server error:', err.message);
  process.exit(1);
});

// Admin console on stdin, so operating the server needs no second tool.
// Deliberately not gated on isTTY: stdin is a pipe under Docker, systemd and
// most process managers, and gating on a terminal would silently disable
// admin control in exactly the deployments that need it most.
if (process.stdin.readable) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '' });
  rl.on('line', (line) => {
    const text = line.trim();
    if (text) console.log(runAdminCommand(text));
  });
  // A closed pipe just means no admin input; it must not kill the server.
  rl.on('close', () => log('stdin closed; terminal admin console disabled'));
  process.stdin.on('error', () => {});
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nShutting down.');
    broadcast({ t: 'chat', from: null, text: 'Server shutting down.' });
    setTimeout(() => process.exit(0), 100);
  });
}

export { runAdminCommand };
