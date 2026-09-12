# SuperClaude!

A public, open source collection of [Claude Skills](https://code.claude.com/docs/en/claude-code-on-the-web) — built so any skill in the collection adapts to *your* tone, stack, and workflow through one small preferences file, instead of being hardcoded to one person's setup.

## Why

Most shared prompts and skills are written for their author. SuperClaude separates *what a skill does* from *how it talks to you*: skills ship with neutral defaults, and a single preferences file you own controls voice, formatting, stack, and workflow across every skill in the collection at once.

## Status

The preferences system and authoring tooling are built, and skills are being added one at a time — each fully tested, documented, and checked against every other skill's trigger territory before the next one starts. See [`docs/PLAN.md`](docs/PLAN.md) for the full build plan and [`docs/AUTHORING.md`](docs/AUTHORING.md) for the trigger map.

## Quickstart

**Want the whole collection?** In a Claude Code session:

```text
/plugin marketplace add thatrgbgamer/SuperClaude
/plugin install superclaude@superclaude
```

**Want just a skill or two?** Clone the repo and copy what you want into your personal skills directory:

```sh
git clone https://github.com/thatrgbgamer/SuperClaude.git
cp -r SuperClaude/skills/preferences-setup ~/.claude/skills/
cp -r SuperClaude/skills/writing-assistant ~/.claude/skills/
```

Either way, next:

1. In a Claude Code session, ask it to set up your preferences (e.g. "set up my SuperClaude preferences") — this runs `preferences-setup`, asks a handful of questions, and writes `~/.claude/skills-preferences.yaml`.
2. Ask for whatever a skill does (e.g. "draft an email to my landlord about a leaking faucet") — it picks up your preferences automatically.

No preferences file yet? Every skill still works — it falls back to the neutral defaults in `config/defaults.yaml`.

Every install path (plugin, personal, project, packaged bundles, and the recommended starter set) is covered in [`docs/INSTALL.md`](docs/INSTALL.md).

## Catalog

| Skill | Purpose |
|---|---|
| [`preferences-setup`](skills/preferences-setup/) | Interviews you and writes your preferences file; also handles incremental edits later. |
| [`writing-assistant`](skills/writing-assistant/) | General-purpose drafting and editing that respects your voice, formatting, and banned-phrase preferences. |
| [`skill-scaffold`](skills/skill-scaffold/) | Creates a new skill in this repo following every convention — for contributors, not end users. |
| [`email-drafter`](skills/email-drafter/) | Strategic emails (outreach, follow-ups, declines, negotiation) as multiple angled variants, not one take. |
| [`repo-onboarding`](skills/repo-onboarding/) | Explains an unfamiliar codebase — entry points, architecture, conventions, where a change belongs. |
| [`source-summarizer`](skills/source-summarizer/) | Condenses articles, papers, transcripts, or docs at a configurable depth. |
| [`debug-triage`](skills/debug-triage/) | Systematically narrows down a non-obvious bug: reproduce, isolate, hypothesize, test, verify. |
| [`document-formatter`](skills/document-formatter/) | Restructures messy, multi-topic notes into a properly organized document. |
| [`research-brief`](skills/research-brief/) | Sourced research briefs with confidence labels and consensus vs. disagreement shown explicitly. |
| [`fount-gamedev`](skills/fount-gamedev/) | Authors levels, entities and logic for the bundled [Fount engine](apps/fount/) — games that run with zero API calls. |

## Bundled app: Fount Engine

[`apps/fount/`](apps/fount/) is a dependency-free WebGL2 FPS engine built around one constraint: **Claude authors the whole game as text, and the game then runs with no API calls at all.** Levels are JSON brushes, textures are procedural generators, sounds are synthesised, and level logic is declared as entity output→input connections — so a complete game is diffable text with no binary assets, and the finished thing runs offline forever with no key and no per-play cost.

It has brush-based collision (Quake-style swept AABB tracing), verlet ragdolls that inherit a victim's momentum on death, a Source-style entity IO system, and an in-browser editor that round-trips with the hand-written JSON. Run it with `cd apps/fount && python3 -m http.server 8099`, then pair it with the `fount-gamedev` skill and ask for a level.

More skills are added one at a time, each fully tested and documented before the next starts — see [`docs/PLAN.md`](docs/PLAN.md) Section 8 for the full planned catalog.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). This is currently a personal project — issues are welcome, PRs are not yet being actively solicited.

## License

MIT — see [`LICENSE`](LICENSE).
