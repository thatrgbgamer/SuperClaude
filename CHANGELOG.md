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
