# debug-triage

## Problem

Debugging a non-obvious failure without a method tends to become flailing: try a change, see if it helps, try another, lose track of what's actually been ruled out. A systematic reproduce → isolate → hypothesize → test loop finds the root cause faster and leaves a trail showing why the fix is actually the fix, not just a change that happened to make the symptom go away.

## Trigger phrases

- "Help me debug this — the test fails intermittently and I can't tell why."
- "This crashes sometimes but I can't reproduce it reliably."
- "Walk me through figuring out why this endpoint returns the wrong data."
- "I've tried a few things and nothing's fixed this bug."
- "Why does this only fail in production and not locally?"

## Non-triggers

- "Fix this typo." — trivial, obvious cause; just fix it, no methodology needed.
- "Review this code for quality issues." — the built-in `code-review` skill, not a live failure.
- "Explain how this function works." — understanding code, not debugging a failure.
- "This throws a syntax error on line 12." — obvious, single-cause fix; apply it directly.

## Inputs

A description of the failure (symptom, when it happens, what's been tried already if anything) and access to the relevant code/logs/test output.

## Output

See `SKILL.md` "Output format": a visible trail through Reproduce → Isolate → Hypotheses (ranked) → Test each → Root cause → Fix → Verification. Not a dump of every dead end — a legible record of what was ruled out and why, then the actual fix.

## Preferences consumed

- `voice.verbosity` — how much of the trail to narrate vs. summarize.
- `workflow.review_depth` — loosely maps to how many hypotheses to seriously test before committing to a root cause.
- `workflow.run_tests_before_proposing` — whether to run the test suite to confirm the fix before presenting it.
- `safety.confirm_before_installing_packages` — if a diagnostic tool needs installing.

## Bundled resources

None — the workflow is short enough to keep in `SKILL.md`.

## Test cases

See `evals/evals.json`.

## Done when

- A genuinely non-obvious bug gets a visible reproduce/isolate/hypothesize/test trail, not a guess-and-check loop.
- A trivial, obvious-cause bug does NOT trigger the full methodology — it just gets fixed.
- The final fix is verified against the original repro before being presented as done.
