---
name: repo-onboarding
description: Explains an unfamiliar codebase to a person — entry points, architecture, conventions, and where a given kind of change would go — as a conversational walkthrough. Use when the user asks for a tour of a codebase, says they're new to a repo and don't know where to start, asks how a project is organized, or asks where a specific kind of change would belong. Do not use for writing a persistent CLAUDE.md instructions file (that's the init skill), reviewing a pull request (code-review), or debugging a specific failure (a live debugging task, not orientation).
version: 0.1.0
---

# Repo onboarding

## Preferences

Load preferences before answering: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal; default to a `balanced` walkthrough. `voice.verbosity: terse` means hit only the highest-value points in each section below, not skip sections entirely. Full contract: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection).

## Step 1: scope the answer

If the user asked a narrow question ("where would I add a new API endpoint?"), don't give the full tour — investigate just enough of the codebase to answer that question directly and confidently, with enough surrounding context (the pattern used by similar existing code) that the answer is actually trustworthy. If they asked for a general tour, use the full template below.

## Step 2: actually look, don't guess from file names

Read enough of the real code — entry point files, the main config, a couple of representative modules — to describe what's actually there. A plausible-sounding but wrong architecture description is worse than a shorter, verified one.

## Output format

For a general tour:

1. **Entry points** — where execution starts (main file, server bootstrap, CLI entry, etc.) and how to run/build/test the project.
2. **Architecture** — the major pieces and how they relate; a short diagram-in-words is fine ("requests come in through X, get handled by Y, persisted via Z").
3. **Conventions** — naming, file organization, testing approach, anything a contributor would need to match to fit in.
4. **Where things live** — a short map from common task types ("add an endpoint," "add a UI component," "add a migration") to the directory/pattern that handles them, if the codebase's structure makes this answerable.

For a narrow "where would X go" question: skip straight to the relevant part of section 4, with the specific file(s)/pattern to follow, and only as much surrounding context (from 1–3) as is needed to make the answer make sense.

## Boundaries

State what you found, not what a typical project of this kind usually looks like — if something is genuinely unclear from the code, say so rather than filling the gap with a plausible guess. `voice.hedging: low` means state what you verified directly; it never means presenting an unverified guess as fact.
