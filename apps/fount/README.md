# Fount Engine

A dependency-free WebGL2 FPS engine, built so **Claude can author a complete game as plain text and the game then runs with zero API calls.**

That single constraint shapes everything here. Authoring happens in a Claude Code session on your existing subscription; the finished game is static files that run offline, forever, with no API key, no network access, and no per-play cost. To make that possible, nothing in a Fount game is a binary asset:

| Normally a binary file | In Fount |
|---|---|
| Texture PNGs | Procedural generators with named parameters (`brick`, `metal`, `noise`, …) |
| Sound WAVs | WebAudio synthesis presets (`shoot`, `explosion`, `die`, …) |
| Compiled level (BSP) | A JSON brush list, read directly at runtime |
| Character models | Primitives composed in code, sharing a skeleton with the ragdolls |
| Animation clips | Procedural — walk cycles from a sine, deaths from physics |

So a whole game is text you can diff, review, and edit in one pass.

## Run it

```sh
cd apps/fount
./run.sh              # or ./run.sh 9000 for a different port
```

That serves the files and opens a browser. Equivalent by hand:

```sh
python3 -m http.server 8099
```

- Game: <http://localhost:8099/>
- Editor: <http://localhost:8099/editor/index.html>

ES modules need a real HTTP origin — opening `index.html` from the filesystem won't work. There is no build step: edit a file, refresh the browser.

## Controls

| Input | Action |
|---|---|
| WASD | Move — air acceleration is capped Quake-style, so air-strafing and bunnyhopping preserve momentum |
| Space | Jump |
| Mouse | Look (click to capture, or drag); left click to shoot |
| Arrow keys | Look, for when pointer lock is unavailable |
| F / Enter / Ctrl | Shoot from the keyboard |
| ` or ~ | Open the console |
| Shift+R | Restart map |
| Esc | Release mouse |

Looking works three ways — pointer lock, mouse drag, arrow keys — on purpose.
Pointer lock is refused by some browsers and embeddings, and when it was the
only route a refusal left you unable to turn at all, with nothing on screen
saying why. Now any one of them is enough, and a refusal says so in the HUD.

Headshots do 100 damage, body shots 25. The ragdoll a kill produces inherits the victim's velocity and takes the bullet's impulse at the point of impact.

## What's in the box

**Renderer** — WebGL2 from raw GL calls. One shader, a single 2D-array texture holding every material (so the world draws without rebinds), a 2048² directional shadow map with 3×3 PCF, up to 16 point lights, and exponential distance fog.

**Collision** — Swept AABB against convex brushes using Quake's Minkowski plane-expansion trace, so slopes, wedges and cylinders work with no special cases. Move-and-slide with corner creasing, plus step-up so stairs are walkable.

**Ragdolls** — 16-particle verlet humanoid with distance constraints and cross-bracing, colliding against the world, settling and freezing when still. Position-based dynamics rather than rigid bodies with joints: stable at any timestep, no inertia tensors, and much floppier in the way that actually reads as death. Explosions throw bodies; later bullets shove them.

**Entities + IO** — Entities are addressed by `classname` from map JSON. Level logic is declared as output→input connections with delays (`OnDeath` → `Open` after 0.5s), so most mechanics need no code at all.

**Editor** — Fly camera, click-to-select, outliner, property forms plus raw-JSON editing per object, entity gizmos, and export back to the map file. Visual edits and hand-written JSON round-trip, because the JSON *is* the map.

## Layout

```text
apps/fount/
├── index.html              Game shell + HUD; the map list lives here
├── editor/index.html       In-browser editor
├── engine/
│   ├── math.js             Vectors as plain arrays, so they match map JSON
│   ├── render.js           WebGL2 renderer, mesh building
│   ├── physics.js          Brush tracing, character controller, rigid bodies
│   ├── ragdoll.js          Verlet ragdolls
│   ├── entity.js           Entity registry + output/input event system
│   ├── entities.js         Built-in classnames
│   ├── map.js              Brush → planes → polygons, map loading
│   ├── textures.js         Procedural material generators
│   ├── audio.js            Procedural sound synthesis
│   ├── console.js          In-game console: commands, cvars, completion
│   ├── net.js              Multiplayer client: snapshots, interpolation
│   └── game.js             Player, weapons, fixed-timestep loop
├── server/
│   ├── websocket.mjs       RFC 6455 server, written against the stdlib
│   └── server.mjs          HTTP + session host, admin terminal
├── serve.sh                Start a multiplayer server
└── game/
    ├── maps/               Levels (JSON)
    └── scripts/            Game-specific entity behaviours
```

## Authoring

The `fount-gamedev` skill in this repo teaches Claude the formats. Install it and ask for what you want:

> "Add a level with a courtyard and a sniper tower, and put four guards in it."

Full schema documentation, for humans and for Claude:

- `skills/fount-gamedev/references/map-format.md` — brushes, materials, lighting, scale table
- `skills/fount-gamedev/references/entities.md` — every classname, keyvalue, input and output
- `skills/fount-gamedev/references/custom-behaviors.md` — `defineEntity` and engine services

## Console

Press `` ` `` (or `~`) in game. Tab completes, up/down walks history, and `help`
lists everything.

| Command | Does |
|---|---|
| `noclip`, `god` | The usual cheats |
| `give health\|ammo [n]` | Top yourself up |
| `teleport x y z`, `where` | Move about, find out where you are |
| `spawn <classname> [key value …]` | Place an entity at your crosshair |
| `ragdoll`, `killall`, `clearbodies` | Make a mess, then clean it up |
| `ent [classname]`, `fire <target> <input> [value]` | Inspect entities; send them IO inputs |
| `map <path>`, `restart`, `pause` | Level control |
| `connect [host]`, `disconnect`, `say`, `name`, `players`, `status` | Multiplayer |

Cvars are read by typing the name and set by typing a value after it:
`sensitivity`, `fov`, `gravity`, `speed`, `jump`, `timescale`, `maxbodies`,
`showfps`.

`fire` is the useful one while building a level: it drives the same IO system
the map JSON uses, so you can test a connection before you wire it up.

## Multiplayer

```sh
cd apps/fount
./serve.sh                                    # port 8099, all interfaces
./serve.sh --port 8080 --name "My Server"
./serve.sh --map game/maps/test_playground.json --max 24
```

One process serves the game files *and* hosts the session on the same port, so
there is nothing else to run and nothing to configure: whoever opens the page is
already pointed at the right server. Node 18+, no `npm install` — the WebSocket
server in `server/websocket.mjs` is written against the standard library. The
`.mjs` extension is deliberate: it makes the server load correctly whatever
`package.json` your game repo happens to have next to it.

Players join with `connect` in the console (no argument connects to whoever
served the page), and `disconnect` leaves. Chat is `say`, `players` shows the
scoreboard, `status` shows the connection.

### Admin

The terminal you started the server in *is* the admin console — type into it:

| Command | Does |
|---|---|
| `status` | Who is connected, their scores, their addresses |
| `say <text>` | Broadcast a server message |
| `kick <who> [why]` | Disconnect a player |
| `ban <who>`, `unban <addr>`, `bans` | Block an address, and manage the list |
| `admin <who>`, `unadmin <who>` | Grant or revoke in-game admin rights |
| `map <path>`, `restart` | Change or restart the level for everyone |
| `quit` | Shut down |

A player you have `admin`'d runs those same commands from the game by prefixing
chat with `/` — `say /kick griefer`. Everyone else gets told to ask you.

`<who>` matches a player id or a name prefix, so `kick 3` and `kick grie` both
work.

### Putting a server on the internet

The server binds all interfaces, so on a LAN people can already reach it at
`http://<your-lan-ip>:8099/`. Beyond that, pick whichever of these fits:

**A tunnel** — nothing to configure, good for a quick game with friends:

```sh
./serve.sh --port 8099 &
cloudflared tunnel --url http://localhost:8099     # or: ngrok http 8099
```

Share the HTTPS URL it prints. The client picks `wss://` automatically when the
page is served over HTTPS, so tunnels work with no flags.

**Port forwarding** — forward external 8099 to your machine's 8099 and share
`http://<your-public-ip>:8099/`. Free, but it exposes your home address to
everyone who plays.

**A cheap VPS** — the durable option, and the one to use if the server should
outlive your laptop:

```sh
git clone https://github.com/<you>/<your-game>.git
cd <your-game>
./serve.sh --port 80 --name "My Game"
```

That is the whole deployment. Because a scaffolded Fount game vendors the engine
and the server, the repo *is* the build — there is no toolchain to install on the
box beyond Node. Keep it running with whatever you already use; a systemd unit is
enough:

```ini
[Service]
ExecStart=/usr/bin/node /srv/my-game/server/server.mjs --port 80 --name "My Game"
WorkingDirectory=/srv/my-game
Restart=always
```

To put it behind nginx or Caddy for TLS, proxy to the port and pass the
`Upgrade`/`Connection` headers through so WebSockets survive the hop. The server
reads `X-Forwarded-For`, so `status` and `ban` see real client addresses rather
than the proxy's.

`GET /api/status` returns the server name, map, player list and uptime as JSON —
enough for a server browser or an uptime check.

### How it works, and what that costs

Remote players are drawn ~100 ms behind the newest snapshot, interpolated
between the two snapshots straddling that time. Rendering the latest snapshot
directly would teleport players on every packet; one tick of slack buys smooth
motion for a little latency, which is the standard trade. The server ticks at
20 Hz and clients report at the same rate.

Shooting is client-authoritative: your client traces the shot locally against
the positions it is drawing and tells the server what it hit, which is what makes
hits feel immediate on a high-ping connection. The server sanity-checks speed and
rate-limits messages, but a modified client can still lie about where it is. This
is a community-server trust model, not an anti-cheat one — see **Known limits**.

## Starting your own game repo

`apps/fount/` is the engine plus its demo maps. A real game wants its own
repository, which the scaffolder sets up:

```sh
python3 tools/new_fount_game.py ../my-game --name "My Game"
cd ../my-game && ./run.sh
```

You get a self-sufficient project: the engine vendored in (it has no
dependencies, so a copy beats a submodule), a starter level, the game shell and
editor, `run.sh`, a README, and a git repo with a first commit. Nothing is
pushed anywhere — the script prints the remote steps for you to run.

**The part that matters for Claude Code**: it also installs the `fount-gamedev`
skill at `.claude/skills/fount-gamedev/` inside the new project. A Claude Code
session opened on that repo — locally, or by attaching the GitHub repo on the
web — discovers it as a project skill automatically, so Claude already knows the
map format and entity library without SuperClaude being present at all.

Other modes:

```sh
python3 tools/new_fount_game.py ../existing-repo --vendor-only  # add Fount to a project you already have
python3 tools/new_fount_game.py ../my-game --update             # refresh the vendored engine + skill
python3 tools/new_fount_game.py ../my-game --dry-run            # show what it would write
```

`--update` only touches `engine/` and `.claude/skills/fount-gamedev/`. Your
`game/` content, `index.html` and README are never overwritten.

## Included maps

- **`dm_crucible`** — walled arena with a catwalk, ramps, a raised platform, physics crates, five guards, and a trigger-operated vault door.
- **`test_playground`** — sandbox for the systems themselves: a timer that drops ragdolls, an explosion pad, a cycling platform, stationary targets, and a crate stack.

## Performance note

Performance depends heavily on the GPU. On software rendering (a headless CI browser using SwiftShader) the demo maps run around 8–10 fps, dominated by the 2048² shadow pass; on any real GPU they run at refresh rate. If you need more headroom on weak hardware, drop `SHADOW_SIZE` in `engine/render.js`.

## Known limits

Honest about what this is not:

- **No rotational rigid bodies.** `prop_physics` boxes translate and get a visual spin, but don't tumble with real angular dynamics. Ragdolls carry the physical interest instead.
- **No BSP/PVS culling.** Every brush in the static mesh is drawn every frame. Fine at demo-map scale; a very large level would want spatial partitioning.
- **Point lights don't cast shadows** — only the sun does.
- **The server is not authoritative over movement.** Clients report their own
  position; the server enforces rate limits and a speed sanity check and owns
  scores, chat and admin. Right for community servers, wrong for ranked play.
- **Brushes must be convex.** Concave shapes are built from several brushes, exactly as in Quake and Source.

## License

MIT, same as the rest of SuperClaude.
