# Fount entity reference

Every classname the engine ships with, its keyvalues, and the inputs/outputs it exposes to the IO system.

## Contents

- [The IO system](#the-io-system)
- [Spawns and lighting](#spawns-and-lighting)
- [Props](#props)
- [Brush entities](#brush-entities)
- [Triggers and logic](#triggers-and-logic)
- [Pickups](#pickups)
- [NPCs and death](#npcs-and-death)
- [Effects](#effects)
- [Universal inputs](#universal-inputs)

## The IO system

Level logic is declarative. An entity fires named **outputs** when things happen; a `connections` entry routes an output to another entity's **input**.

```json
"connections": [
  { "output": "OnStartTouch", "target": "vault_door", "input": "Open" },
  { "output": "OnEndTouch",   "target": "vault_door", "input": "Close", "delay": 2.0 }
]
```

| Field | Meaning |
|---|---|
| `output` | Output name on this entity |
| `target` | `name` of the receiving entity; all entities with that name receive it. `!activator` and `!caller` also work |
| `input` | Input name to invoke on the target |
| `param` | Optional string argument, parsed by the input |
| `delay` | Seconds to wait before delivering; default 0 |
| `once` | If true, the connection fires only the first time |

Multiple entities may share a `name` — one output then drives all of them, which is how you open a set of doors together.

## Spawns and lighting

### `info_player_start`

Where the player begins. `origin` should sit on the floor surface; `angles[1]` sets facing. Only the first one in the map is used.

### `light`

Point light. Max 16 active at once; no shadows (only the sun casts those).

| Keyvalue | Default | Meaning |
|---|---|---|
| `color` | `[1, 0.9, 0.7]` | Light colour |
| `radius` | `9` | Falloff distance in metres |
| `brightness` | `1` | Multiplier on `color` |

Inputs: `TurnOn`, `TurnOff`, `Toggle`, `SetBrightness` (`param` = number).

## Props

### `prop_physics`

A box with gravity that the player can shoot and shove around.

| Keyvalue | Default | Meaning |
|---|---|---|
| `size` | `[0.4,0.4,0.4]` | Half-extents |
| `material` | `panel` | Material name |
| `restitution` | `0.28` | Bounciness |
| `health` | `0` | If > 0, can be destroyed via `Damage` |
| `pushDir` | `[0,1,0]` | Direction used by the `Push` input |

Inputs: `Push` (`param` = impulse strength), `Damage` (`param` = amount).
Outputs: `OnBreak` (only if `health` > 0).

Props spawn where you put them and fall. Stacking them means stacking their `origin` values with a little vertical space; they settle themselves.

## Brush entities

These carry their own geometry as `min`/`max` rather than referencing a brush, because they move.

### `func_door`

| Keyvalue | Default | Meaning |
|---|---|---|
| `min`, `max` | — | The door slab's bounds when closed (**required**) |
| `moveDir` | `[0,1,0]` | Direction it travels when opening |
| `distance` | `2` | How far it travels |
| `speed` | `2.2` | Metres per second |
| `material` | `metal` | Material name |

Inputs: `Open`, `Close`, `Toggle`.
Outputs: `OnOpen`, `OnClose`, `OnFullyOpen`, `OnFullyClosed`.

A door that slides up needs `distance` ≥ its own height, or it stays partly in the doorway.

### `func_platform`

Same geometry fields as `func_door`, but it cycles on its own.

| Keyvalue | Default | Meaning |
|---|---|---|
| `auto` | `true` | Start cycling immediately |
| `wait` | `1.5` | Pause at each end, seconds |

Inputs: `Start`, `Stop`. Outputs: `OnFullyOpen`, `OnFullyClosed`.

## Triggers and logic

### `trigger_multiple`

Fires when the player enters or leaves a volume. **The volume comes from a brush with `"trigger": true` and the same `name`** — the entity itself has no bounds.

```json
{ "type": "box", "name": "trig_gate", "trigger": true, "min": [-2,0,4], "max": [2,3,8] }
```

```json
{ "classname": "trigger_multiple", "name": "trig_gate", "wait": 0.5,
  "connections": [ { "output": "OnStartTouch", "target": "gate", "input": "Open" } ] }
```

| Keyvalue | Default | Meaning |
|---|---|---|
| `wait` | `0.5` | Minimum seconds between re-fires |

Outputs: `OnStartTouch`, `OnEndTouch`.

Forgetting the matching trigger brush is the most common mistake here: the entity loads fine and silently never fires.

### `logic_relay`

Forwards one input to many outputs — the way to fan a single event out to several targets.

Inputs: `Trigger`. Outputs: `OnTrigger`.

### `logic_timer`

| Keyvalue | Default | Meaning |
|---|---|---|
| `interval` | `2` | Seconds between fires |
| `startEnabled` | `true` | Whether it runs at load |

Inputs: `SetInterval` (`param` = seconds), plus `Enable`/`Disable`. Outputs: `OnTimer`.

### `logic_counter`

| Keyvalue | Default | Meaning |
|---|---|---|
| `threshold` | `3` | Count that fires `OnThreshold`, then resets |

Inputs: `Add` (`param` = amount, default 1), `Reset`. Outputs: `OnChanged` (param = new count), `OnThreshold`.

## Pickups

### `item_health` / `item_ammo`

Collected by walking within ~1.1m. Both bob in place.

| Keyvalue | Default | Meaning |
|---|---|---|
| `amount` | `25` / `30` | Health or ammo granted |

Outputs: `OnPickup`.

## NPCs and death

### `npc_grunt`

Walks toward the player when it has line of sight, shoots from range, and **turns into a ragdoll when killed**.

| Keyvalue | Default | Meaning |
|---|---|---|
| `health` | `40` | Hit points. A headshot deals 100, a body shot 25 |
| `speed` | `3.4` | Movement speed; `0` makes a stationary target |
| `sightRange` | `26` | Distance at which it notices the player; `0` makes it inert |
| `attackRange` | `14` | Distance it will shoot from |
| `attackInterval` | `1.4` | Seconds between shots |
| `damage` | `8` | Damage per shot |
| `keepDistance` | `2.2` | Stops approaching closer than this |
| `tint` | `[1,1,1]` | Colour multiplier, for telling units apart |
| `bodyMaterial` | `cloth` | Material for torso and limbs |
| `skinMaterial` | `flesh` | Material for head and hands |
| `ragdollLifetime` | `40` | Seconds the body persists |

Inputs: `Damage` (`param` = amount), `Kill`.
Outputs: `OnDamaged` (param = remaining health), `OnDeath`, `OnAttack`.

**How death works.** On death the NPC's live character-controller velocity is handed to a fresh 16-particle verlet ragdoll, then the killing impulse is applied at the point of impact. So a body shot folds the torso, a headshot snaps the head back, and an NPC killed mid-sprint tumbles in the direction it was running. Bodies keep colliding with the world, get shoved by later bullets, and are thrown by explosions. `ragdolls.maxRagdolls` (default 24) retires the oldest body when exceeded.

Killing an NPC through `Damage` with a huge `param` is the scripted way to drop one on cue:

```json
{ "output": "OnTimer", "target": "guard_1", "input": "Damage", "param": "999" }
```

### `point_ragdoll`

Spawns a loose body with no NPC attached — useful for testing the death physics directly.

| Keyvalue | Default | Meaning |
|---|---|---|
| `velocity` | `[0,2,0]` | Initial velocity handed to the body |
| `bodyMaterial`, `skinMaterial` | `cloth`, `flesh` | Materials |

Inputs: `Spawn`.

## Effects

### `env_explosion`

| Keyvalue | Default | Meaning |
|---|---|---|
| `radius` | `6` | Effect radius |
| `force` | `16` | Impulse strength on props, NPCs and bodies |
| `damage` | `60` | Damage at the centre, falling off to the edge |

Inputs: `Explode`. Outputs: `OnExplode`.

An explosion kills NPCs in range with a radial impulse (they ragdoll outward), shoves `prop_physics`, throws existing ragdolls, and damages the player. Set `damage: 0` for a launcher pad that flings without hurting.

## Universal inputs

Every entity accepts these without declaring them:

| Input | Effect |
|---|---|
| `Enable` | Resume thinking |
| `Disable` | Stop thinking (stays in the world) |
| `Kill` | Remove from the world |
| `Toggle` | Flip enabled state, unless the class defines its own `Toggle` |
