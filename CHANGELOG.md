# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses semantic versioning at the collection level once a first release is tagged.

## [Unreleased]

### Added

- Repo skeleton: README, LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, `.gitignore`, CI stub.
- Build plan at `docs/PLAN.md`.
- Preferences system: `docs/PREFERENCES.md`, `shared/preferences-loader.md`, `config/defaults.yaml`, `config/preferences.example.yaml`.
- `preferences-setup` skill: interviews the user and writes/edits their preferences file.
- `writing-assistant` skill: general-purpose drafting and editing that respects voice, formatting, and banned-phrase preferences — the first proof that the same prompt produces visibly different output under different preferences.
- Authoring tooling: `tools/new_skill.py` (scaffold), `tools/validate_skills.py` (frontmatter/line-count/reference-link/evals checks, now what CI actually runs), `tools/package_skill.py` (zip a skill into a `.skill` bundle).
- `skill-scaffold` skill: builds a new skill following every convention here, dogfooding the repo.
- `docs/AUTHORING.md`: skill-writing conventions plus the trigger map.
- Tier 2 skills (batch 1): `email-drafter` (strategic/outreach emails as multiple angled variants), `repo-onboarding` (codebase walkthroughs for humans), `source-summarizer` (configurable-depth summaries of existing source material). Trigger map reviewed across all six skills for collisions; scoped `writing-assistant` explicitly around `email-drafter`, and `repo-onboarding` explicitly around the built-in `init` and `code-review` skills.
- Tier 2 skills (batch 2): `debug-triage` (systematic reproduce/isolate/hypothesize/test methodology for non-obvious bugs), `document-formatter` (restructures messy multi-section notes into a properly organized document), `research-brief` (sourced research briefs with per-finding confidence labels and explicit consensus-vs-disagreement). Trigger map reviewed across all nine skills; scoped `writing-assistant` further around `document-formatter`. Deliberately deferred `commit-and-pr` as a likely "wrapper skill" duplicating Claude Code's own default git behavior, and `data-cleanup` pending careful scoping against the built-in `xlsx` skill.
- Distribution (Phase 6): `docs/INSTALL.md` covering every install path (personal, project, packaged `.skill` bundles, plugin) plus a recommended starter set; `docs/TESTING.md` explaining how evals work in this repo; a Claude Code plugin marketplace (`.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`) bundling the whole collection as a single installable plugin with zero duplication of skill content, validated in CI.
- Pre-built `dist/*.skill` bundles for all nine skills, committed so a single skill can be downloaded and installed without cloning the repo or running `tools/package_skill.py` locally. `.gitignore` updated accordingly — these are intentionally tracked, unlike other build output.
- **Fount Engine** (`apps/fount/`): a dependency-free WebGL2 FPS engine designed so Claude authors a game entirely as text and the finished game runs with zero API calls. Includes a shadow-mapped renderer with procedural material generation, Quake-style swept-AABB brush collision with a Source-feel character controller, 16-particle verlet ragdolls that inherit the victim's momentum and the killing impulse, a declarative entity output/input system, procedural audio synthesis, an in-browser editor that round-trips with map JSON, and two playable demo maps.
- `fount-gamedev` skill: teaches the map format, entity library, IO system and custom-behaviour API for the Fount engine, with three task-split reference files.
