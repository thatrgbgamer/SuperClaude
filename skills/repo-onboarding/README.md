# repo-onboarding

## Problem

Getting oriented in an unfamiliar codebase — where does execution start, how is it organized, what are its conventions, where would a given change actually go — normally means a slow crawl through files, or asking scattered questions and stitching the answers together yourself. This skill front-loads that orientation into one coherent walkthrough, scaled to how much the person actually wants to read.

## Trigger phrases

- "Can you give me a tour of this codebase?"
- "I'm new here — where do I even start reading?"
- "Explain how this project is organized."
- "Where would I make a change to add a new API endpoint?"
- "What's the entry point for this application?"
- "What conventions does this codebase follow?"

## Non-triggers

- "Create a CLAUDE.md file for this repo." — writing a persistent instructions file for Claude's own future use is a distinct, already-covered job (the `init` skill), not a human-facing walkthrough.
- "Review this pull request." — code review, not orientation (the `code-review` skill).
- "Why is this function throwing an error?" — debugging a specific problem, not general orientation (future `debug-triage`).
- "Add a login page to this app." — implementing a feature, not explaining the codebase (though this skill's output is exactly what should precede that work).

## Inputs

Access to the repository (already checked out). Optionally, a specific question ("where would X change go") that narrows the walkthrough instead of covering everything.

## Output

See the template in `SKILL.md` "Output format": entry points, architecture overview, conventions, and — if a specific change was asked about — a direct pointer to where it belongs. Does not write any file by default; this is a conversational answer unless the user asks to save it somewhere.

## Preferences consumed

- `voice.verbosity` — short tour vs. detailed walkthrough by default.
- `formatting.style`, `formatting.heading_depth` — bullets vs. prose, how much structure.
- `identity.spelling`

## Bundled resources

None — the walkthrough structure is short enough to keep in `SKILL.md`.

## Test cases

See `evals/evals.json`.

## Done when

- A general "give me a tour" request produces the full template (entry points, architecture, conventions) scaled to `voice.verbosity`.
- A narrow "where would X go" request skips the full tour and answers just that, with enough surrounding context to trust the answer.
- Does not fire on requests that belong to `init`, `code-review`, or a live debugging task.
