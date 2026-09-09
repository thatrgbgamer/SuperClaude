---
name: debug-triage
description: Systematically narrows down a non-obvious bug through reproduce, isolate, hypothesize, and test steps, leaving a visible trail of what was ruled out and why before presenting a verified fix. Use when a failure's cause isn't already obvious — intermittent bugs, "works locally but not in production," a crash with no clear single cause, or when the user says they've already tried things without success. Do not use for a bug with an obvious single cause (a syntax error, an evident typo, a clearly wrong value) — just fix those directly. Not for code review of working code, or for explaining how existing code behaves.
version: 0.1.0
---

# Debug triage

## Preferences

Load preferences before starting: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal. Full contract: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection). `voice.verbosity: terse` narrates only the ruled-out hypotheses briefly, not each one in full; it never means skipping verification of the final fix.

## Why the method matters

Changing code until a symptom disappears finds *a* change that helps, not necessarily the actual cause — and it leaves no way to know if the same bug will resurface elsewhere. Each step below exists to prevent one specific failure mode of ad hoc debugging:

1. **Reproduce** — get a reliable way to trigger the failure, even if imperfect (e.g. "fails roughly 1 in 5 runs" is a real repro). Skipping this means you can't tell a real fix from noise.
2. **Isolate** — narrow down which input, code path, or condition actually matters. Change one variable at a time; don't isolate and fix simultaneously.
3. **Hypothesize** — list plausible causes given what isolation showed, ranked by likelihood. Don't jump to the first idea that comes to mind if a more likely one exists.
4. **Test each hypothesis** — for the top hypothesis, find evidence that would confirm or rule it out (a log line, a targeted print/assert, a minimal repro). Move to the next hypothesis only after this one is actually ruled out, not just "probably not it."
5. **Root cause** — state what's actually wrong and why it produces the observed symptom. If you're not sure this is the *root* cause rather than a contributing factor, say so.
6. **Fix** — the smallest change that addresses the root cause, not a broader refactor riding along.
7. **Verify** — run the original repro (and the test suite, if `workflow.run_tests_before_proposing` isn't `false`) against the fix and confirm the symptom is actually gone.

## Output format

Present the trail concisely, not as a transcript of every dead end:

```text
Reproduced: <how, and how reliably>
Isolated to: <what actually matters — narrowed from the initial report>
Ruled out: <hypothesis> — <why>
           <hypothesis> — <why>
Root cause: <what's actually wrong>
Fix: <the change, and why it's minimal>
Verified: <repro no longer triggers the symptom; tests pass>
```

If `voice.verbosity` is `terse`, compress "Ruled out" to one line total instead of one per hypothesis. Never compress away the "Verified" line — presenting an unverified fix as done is exactly the overconfidence preferences can't authorize (see `docs/PREFERENCES.md` "Hard limits").

## When to bail out of the full method

If the cause turns out to be obvious once you start looking (a clear off-by-one, an evidently wrong config value), stop the ceremony and just fix it — don't force a five-step writeup onto a one-line bug.
