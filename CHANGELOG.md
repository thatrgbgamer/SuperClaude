# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses semantic versioning at the collection level once a first release is tagged.

## [Unreleased]

### Added

- Repo skeleton: README, LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, `.gitignore`, CI stub.
- Build plan at `docs/PLAN.md`.
- Preferences system: `docs/PREFERENCES.md`, `shared/preferences-loader.md`, `config/defaults.yaml`, `config/preferences.example.yaml`.
- `preferences-setup` skill: interviews the user and writes/edits their preferences file.
- `writing-assistant` skill: general-purpose drafting and editing that respects voice, formatting, and banned-phrase preferences — the first proof that the same prompt produces visibly different output under different preferences.
