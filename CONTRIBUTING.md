# Contributing

SuperClaude is currently a personal project. Issues (bug reports, skill proposals, improvement ideas) are welcome from anyone. Pull requests are not being actively solicited yet, but the checklist below is the bar any contribution — from the maintainer or otherwise — has to clear, so it's here from day one rather than bolted on later.

## Before proposing a new skill

A new skill needs a demonstrated use case, not just an idea. Before writing one, be able to answer:

- What goes wrong today without this skill?
- What would a user actually type to trigger it?
- What should *not* trigger it, even though it looks adjacent?
- Does an existing skill in the catalog already cover this territory? (Check the trigger map in `docs/AUTHORING.md`.)
- Is this something Claude can already do well by itself? If a skill only tells Claude to use a tool it already has, it doesn't earn a place here.

## Per-skill specification

Every skill starts as a short spec in `skills/<name>/README.md`, written *before* implementation:

- **Problem** — what goes wrong without this skill
- **Trigger phrases** — five to ten realistic things a user would say
- **Non-triggers** — three to five adjacent things that should not fire it
- **Inputs** — what it expects to be given
- **Output** — exact shape of what it produces
- **Preferences consumed** — which preference keys change its behavior, and how
- **Bundled resources** — what goes in `references/`, `scripts/`, `assets/`, and why
- **Test cases** — two or three realistic prompts, plus negatives
- **Done when** — concrete completion criteria

## Review bar

A skill does not ship unless:

1. It has been tested with realistic prompts, including negative cases (see `skills/<name>/evals/evals.json`).
2. Running the same task with and without the skill shows a clear improvement — otherwise it isn't earning its place.
3. It contains no personal data: no real names, hostnames, private URLs, API keys, or anything specific to one person's setup. Everything personalized flows through the preferences file, never hardcoded into the skill.
4. It passes CI: frontmatter validation, line-count limits, link checks, secret scanning, and the personal-data scan.
5. Its frontmatter `description` is scoped tightly enough not to collide with an existing skill's trigger territory.

## No personal data, ever

This is a public repo. Nothing committed to it — skill content, examples, docs, commit messages — may contain real names, real hostnames, private URLs, API keys, tokens, or anything traceable to one person's setup. All personalization happens through each user's own local, gitignored preferences file. PRs and issues are checked for this before anything else.

## Getting started

1. Read `docs/PLAN.md` for the overall architecture and phase plan.
2. Read `docs/AUTHORING.md` for skill-writing conventions and the trigger map.
3. Open an issue describing what you want to add or fix before doing the work, so scope and overlap can be discussed first.
