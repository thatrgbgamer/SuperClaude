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
| Mouse | Look; left click to shoot |
| Shift+R | Restart map |
| Esc | Release mouse |

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
│   └── game.js             Player, weapons, fixed-timestep loop
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
- **Single-player only.** No networking anywhere.
- **Brushes must be convex.** Concave shapes are built from several brushes, exactly as in Quake and Source.

## License

MIT, same as the rest of SuperClaude.
