# SuperClaude!

A public, open source collection of [Claude Skills](https://code.claude.com/docs/en/claude-code-on-the-web) — built so any skill in the collection adapts to *your* tone, stack, and workflow through one small preferences file, instead of being hardcoded to one person's setup.

## Why

Most shared prompts and skills are written for their author. SuperClaude separates *what a skill does* from *how it talks to you*: skills ship with neutral defaults, and a single preferences file you own controls voice, formatting, stack, and workflow across every skill in the collection at once.

## Status

This repo is being built one vertical slice at a time: the preferences system plus one complete skill first, proven with tests and docs, before anything else is added. See [`docs/PLAN.md`](docs/PLAN.md) for the full build plan and phase gates.

## Quickstart

1. Copy the skill(s) you want into your personal skills directory:

   ```sh
   cp -r skills/preferences-setup ~/.claude/skills/
   cp -r skills/writing-assistant ~/.claude/skills/
   ```

2. In a Claude Code session, ask it to set up your preferences (e.g. "set up my SuperClaude preferences") — this runs `preferences-setup`, asks a handful of questions, and writes `~/.claude/skills-preferences.yaml`.
3. Ask for something to be written (e.g. "draft an email to my landlord about a leaking faucet") — `writing-assistant` picks up your preferences automatically.

No preferences file yet? Every skill still works — it falls back to the neutral defaults in `config/defaults.yaml`.

A full guide to every install path (personal, project, packaged bundles) lands in `docs/INSTALL.md` in Phase 6.

## Catalog

| Skill | Purpose |
|---|---|
| [`preferences-setup`](skills/preferences-setup/) | Interviews you and writes your preferences file; also handles incremental edits later. |
| [`writing-assistant`](skills/writing-assistant/) | General-purpose drafting and editing that respects your voice, formatting, and banned-phrase preferences. |
| [`skill-scaffold`](skills/skill-scaffold/) | Creates a new skill in this repo following every convention — for contributors, not end users. |
| [`email-drafter`](skills/email-drafter/) | Strategic emails (outreach, follow-ups, declines, negotiation) as multiple angled variants, not one take. |
| [`repo-onboarding`](skills/repo-onboarding/) | Explains an unfamiliar codebase — entry points, architecture, conventions, where a change belongs. |
| [`source-summarizer`](skills/source-summarizer/) | Condenses articles, papers, transcripts, or docs at a configurable depth. |

More skills are added one at a time, each fully tested and documented before the next starts — see [`docs/PLAN.md`](docs/PLAN.md) Section 8 for the full planned catalog.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). This is currently a personal project — issues are welcome, PRs are not yet being actively solicited.

## License

MIT — see [`LICENSE`](LICENSE).
