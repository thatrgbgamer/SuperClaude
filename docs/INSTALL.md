# Installing SuperClaude skills

Every skill here is a plain folder — `SKILL.md` plus optional `references/`, `scripts/`, `assets/`, and a dev-only `evals/`. No skill in this collection requires anything beyond a Claude Code session; none need external tools, API keys, or paid dependencies. `tools/` (the scaffolding/validation/packaging scripts) needs Python 3, but that's only for repo contributors, not for using an installed skill.

You don't need all of them. Pick what's useful; each skill works completely on its own.

## Recommended starter set

If you're not sure where to start:

1. **`preferences-setup`** — run this first so every other skill adapts to you.
2. **`writing-assistant`** — the broadest everyday value, and the clearest demonstration that preferences actually change output.
3. **`skill-scaffold`** — only if you plan to add your own skills to a clone of this repo.

Add the rest as you find a need for them — see the [catalog](../README.md#catalog).

## Path 1: personal skills directory (recommended for individual use)

Installs a skill for you, across every project. Copy the folder into your personal skills directory:

```sh
cp -r skills/writing-assistant ~/.claude/skills/
```

Repeat for each skill you want. Claude Code picks up anything in `~/.claude/skills/` automatically — no restart or registration step beyond that.

To update later, pull the latest version of this repo and re-copy the folder(s) you're using.

## Path 2: project skills directory (recommended for team use)

If a team wants everyone working in a given repo to have the same skill, check the skill folder into that repo's own `.claude/skills/` directory instead of (or in addition to) the personal one:

```sh
mkdir -p .claude/skills
cp -r /path/to/SuperClaude/skills/writing-assistant .claude/skills/
```

This makes the skill available to anyone working in that project, version-controlled alongside the code it's used with. Combine with a project-level `.claude/preferences.yaml` (see `docs/PREFERENCES.md`) if the team wants shared conventions on top of individual voice preferences.

## Path 3: packaged `.skill` bundles

For sharing a single skill as one file instead of a folder, or for install flows that expect an archive:

```sh
python3 tools/package_skill.py writing-assistant
# -> dist/writing-assistant.skill
```

This produces a zip archive (`.skill` extension) containing everything the skill needs to run (`SKILL.md`, `README.md`, `references/`, `scripts/`, `assets/`) and excludes `evals/`, which is a repo development artifact, not something an installed skill needs. Unzip it into `~/.claude/skills/<name>/` or a project's `.claude/skills/<name>/` to install it.

## Path 4: the whole collection as a plugin

This repo is a Claude Code plugin marketplace with one plugin — `superclaude` — that bundles every skill in `skills/` at once. Use this if you want the whole collection; use paths 1–3 above if you want a single skill or a hand-picked subset (a plugin installs as one unit, not skill-by-skill).

In a Claude Code session:

```text
/plugin marketplace add thatrgbgamer/SuperClaude
/plugin install superclaude@superclaude
```

To remove it later: `/plugin uninstall superclaude`.

The plugin manifest (`.claude-plugin/plugin.json`) and marketplace manifest (`.claude-plugin/marketplace.json`) live at the repo root. The plugin's `source` points at the repo root itself (`"./"`), so it auto-discovers every skill under `skills/` directly — there's no separate, duplicated copy of skill content to keep in sync.

## Verifying an install

After copying a skill in, ask Claude Code something that matches one of its trigger phrases (listed in that skill's own `README.md`, e.g. `skills/writing-assistant/README.md`). If it doesn't seem to fire, double check the folder landed at the right path and that `SKILL.md`'s frontmatter `name` matches its directory name.
