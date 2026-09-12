# fount-gamedev

## Problem

Making a game with an AI assistant normally means one of two bad deals: either the game calls a model at runtime (so it costs money every time anyone plays, needs an API key, and stops working offline), or the assistant writes code for a heavyweight engine it can't run, can't see, and can't verify. Fount avoids both — it's a real engine bundled in this repo whose entire content layer is text, so Claude authors a complete game during a normal Claude Code session and the result runs forever with zero API calls. This skill is what makes Claude actually good at authoring for it, instead of guessing at the schema.

## Trigger phrases

- "Add a new level to Fount with a courtyard and a sniper tower."
- "Place a few more enemies in dm_crucible and make them tougher."
- "Add a door that opens when the player steps on the pressure pad."
- "Make an explosion go off when the last guard dies."
- "Build me a small game with the Fount engine."
- "Why doesn't my trigger fire?"
- "The ragdolls are spawning inside the floor."
- "Add a turret enemy — there isn't a class for it yet."
- "Tune the player movement so jumps feel floatier."

## Non-triggers

- "Make me a game in Unity / Godot / Unreal / three.js." — a different engine entirely; nothing in this skill applies.
- "What makes a good level design?" — general design discussion with no artifact to produce; answer directly.
- "Fix the shadow acne in the renderer's fragment shader." — engine internals under `apps/fount/engine/`, which is ordinary code work on this repo, not level authoring.
- "Add a Claude API call so enemies generate taunts at runtime." — directly contradicts the engine's no-API-credits premise; push back and bake the content in instead.
- "Summarize this game design document." — `source-summarizer`'s job.

## Inputs

A description of the level, mechanic, or change wanted. Optionally an existing map file to modify.

## Output

Edited or newly created files under `apps/fount/game/` — map JSON and, when a mechanic genuinely needs code, a behaviour module in `game/scripts/`. New maps are registered in the `MAPS` array of `index.html` and `editor/index.html`. No binary assets, ever.

## Preferences consumed

- `voice.verbosity` — how much to explain a change versus just making it.
- `workflow.run_tests_before_proposing` — whether to validate map JSON and load the level before reporting success.
- `formatting.code_fence_language_tags` — for snippets in explanations.

Game code style follows the engine's existing conventions rather than user preferences, since it has to sit consistently alongside `engine/`.

## Bundled resources

- `references/map-format.md` — brush types, material generators, sky/lighting, coordinate system, and a scale table. Loaded when authoring or debugging geometry.
- `references/entities.md` — every built-in classname with keyvalues and inputs/outputs, plus how IO routing works. Loaded when placing entities or wiring logic.
- `references/custom-behaviors.md` — `defineEntity`, available engine services, and two worked examples. Loaded only when a mechanic needs new code.

Split by task rather than dumped into `SKILL.md` because a typical request touches one of the three, and the entity reference alone is longer than the whole skill body.

## Test cases

See `evals/evals.json`. Covers level authoring, logic wiring, a debugging case, and a new-behaviour case, plus negatives for other engines, engine-internals work, and the runtime-API-call request the skill is supposed to refuse.

## Done when

- A requested level is authored as valid JSON, spawns the player on solid floor, and is registered in both map lists.
- Wired logic works because the trigger brush and entity `name` actually match — the failure mode the reference calls out explicitly.
- A new mechanic lands as a `defineEntity` module with keyvalues read via `entity.get()`, so it's tunable from map JSON.
- No game content added under `apps/fount/game/` ever makes a network or AI API call at runtime.
- Claude states plainly whether it actually loaded the level in a browser or only validated the JSON.
