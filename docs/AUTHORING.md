# Authoring a skill for SuperClaude

This expands `docs/PLAN.md` Section 6 into a working reference, plus the trigger map every new skill has to be checked against. Read this before writing a skill; use `tools/new_skill.py` (or the `skill-scaffold` skill) to start one.

## Frontmatter

Required: `name`, `description`. Optional: `compatibility`, `version`.

- `name` is the skill identifier and matches the directory name exactly. Lowercase, hyphenated, no spaces.
- `description` is the **entire triggering mechanism**. It must state what the skill does and when to use it, including phrasings a user would actually say — and, in a collection this size, what it should *not* be used for when something adjacent could be confused with it. Nothing in the SKILL.md body is visible before the skill fires, so no triggering information belongs there.

Lean slightly assertive in a description — the common failure is a skill not firing when it would have helped — but pair that with sharp scoping. In a large collection, two over-assertive descriptions collide.

## Progressive disclosure

Three levels, in order of what's in context and when:

1. **Name and description** — always in context, roughly 100 words.
2. **SKILL.md body** — in context only once the skill fires, under 500 lines (hard fail in CI at 600).
3. **Bundled `references/` and `scripts/`** — loaded or executed only when needed, effectively unlimited.

If a SKILL.md approaches 500 lines, add hierarchy: move detail into `references/` with clear pointers about when to read each file. Reference files over ~300 lines get a table of contents at the top. If a skill covers several variants (frameworks, platforms, formats), organize `references/` by variant so only the relevant one gets read.

## Writing style

- Imperative voice for instructions.
- Explain *why* a rule matters instead of stacking capitalized MUSTs. A model that understands the reason generalizes; one following a rule list overfits.
- Include worked examples with real input and output — two good examples beat a page of abstraction.
- Write general guidance, not guidance welded to whatever examples came up during development.
- Draft, then reread with fresh eyes and cut. First drafts are usually twice as long as they need to be.

## Output format

Where a skill produces a structured artifact, give the exact template in the skill. Ambiguity about output shape is the most common cause of inconsistent results.

## Trigger disambiguation

This is the problem unique to shipping many skills together:

- Give each skill a distinct trigger vocabulary. If two skills both claim "write a document," one is scoped wrong.
- Prefer a small number of broad, well-built skills over many narrow, overlapping ones. Merge before you split.
- Every skill's evals need negative cases — prompts that look adjacent but shouldn't fire it. Track false-trigger rate as seriously as trigger rate.
- Review the trigger map below whenever a skill is added. If a new skill's territory overlaps an existing one, resolve the overlap before merging — don't ship the collision and hope the descriptions sort it out at runtime.
- Simple one-step tasks won't trigger a skill regardless of description quality, because Claude just handles them directly. Don't tune a description against test prompts too simple to need a skill in the first place.

## Safety and trust

- No skill may contain exploit code, credential harvesting, or anything that exfiltrates user data.
- A skill's behavior must not surprise a user who read its description.
- Scripts must not make network calls without an explicit statement in the skill body about what they contact and why.
- Skills that touch the filesystem destructively must confirm first, and that confirmation cannot be disabled by preferences (see `docs/PREFERENCES.md` "Hard limits").

## The trigger map

Every skill's claimed territory, in one place, so a new addition can be checked against all of them at a glance. Update this whenever a skill is added, renamed, or rescoped.

| Skill | Territory | Explicitly excludes |
|---|---|---|
| `preferences-setup` | Creating/editing/viewing the user's SuperClaude preferences file itself. | One-off style overrides scoped to a single output; generic YAML/config questions; installing software. |
| `writing-assistant` | General-purpose drafting/editing of prose not covered by a more specific skill: emails, posts, bios, announcements, rewrites. | Code; summarizing existing source material; commit messages/PR descriptions; code review. |
| `skill-scaffold` | Creating a new skill in this repo, following every convention here. | Editing an existing skill; one-off scripts not meant to join `skills/`. |

## Before you propose a new skill

Also see `CONTRIBUTING.md`. In short: a demonstrated problem, five to ten realistic trigger phrases, three to five realistic non-triggers, a check against the trigger map above, and a reason Claude can't already do this well without a skill.
