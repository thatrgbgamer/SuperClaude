# preferences-setup

## Problem

Nobody reads a YAML schema before using a tool. Without a guided setup, most users will either skip preferences entirely (and get generic defaults from every skill forever) or hand-edit a file once, get something wrong, and never touch it again.

## Trigger phrases

- "Set up my SuperClaude preferences"
- "Configure SuperClaude for me"
- "I want Claude to be less formal by default"
- "Make my preferences more casual"
- "Add 'synergy' to my banned phrases"
- "What are my current preferences?"
- "Change my preferences so you confirm before installing packages"
- "Update my preferences to use UK spelling"

## Non-triggers

- "Make this one email more casual" — a one-off request-level override, applied directly to that output, not a persisted preference change.
- "What's a good way to store user settings as YAML in general?" — a generic technical question, not about this repo's preferences file.
- "Install my preferred code editor" — about installing software, not about the preferences file.
- "Review this code against my usual standards" — invokes whatever the *consuming* skill is (e.g. a code-review skill reading `workflow.review_depth`), not this one.

## Inputs

Nothing required. Optionally: an existing preferences file at the standard resolution paths, and free-text answers to the interview questions.

## Output

A YAML file at `~/.claude/skills-preferences.yaml` (default) or `.claude/preferences.yaml` (if the user specifies project scope), matching the schema in `docs/PREFERENCES.md` / `references/schema.md`, containing only the keys the user actually specified.

## Preferences consumed

None — this skill writes the file other skills consume; it doesn't need to load it to change its own behavior, though it should stay stylistically consistent with an existing file's `voice`/`formatting` settings while running the interview.

## Bundled resources

- `references/schema.md` — condensed schema, kept in sync with `docs/PREFERENCES.md`, so this skill still works if installed as a standalone folder outside the full repo.

## Test cases

See `evals/evals.json`. Covers: fresh setup, incremental single-section edit, and view-only, plus negative cases for one-off style overrides and unrelated questions.

## Done when

- A fresh user with no preferences file can run this skill and end up with a valid, minimal file at the global path.
- Re-running it later for a single change (e.g. "make me more casual") edits only that key, leaves the rest of the file untouched, and doesn't re-ask the whole interview.
- The user sees the exact file contents and confirms before anything is written, every time, including edits.
- The written file passes the schema check (valid YAML, only known top-level groups, no unknown key that isn't just extra free text under `notes`).
