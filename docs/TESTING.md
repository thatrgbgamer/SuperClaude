# Testing skills

This repo doesn't have a conventional test suite — a skill's "correctness" is mostly about judgment quality, not assertions a computer can check. This document is how evals work here instead.

## What `evals/evals.json` is for

Every skill has `evals/evals.json`: a small set of realistic prompts, each marked as `positive` (should fire this skill) or `negative` (should not, even though it might look adjacent). `tools/validate_skills.py` enforces the structural minimum — at least two prompts, at least one negative — but passing that check is not the same as the skill actually being good. It just means the skill has *some* evidence attached.

Format:

```json
{
  "skill": "<name>",
  "prompts": [
    { "type": "positive", "prompt": "...", "expected": "..." },
    { "type": "negative", "prompt": "...", "expected": "..." }
  ]
}
```

A skill whose behavior should visibly change based on preferences (like `writing-assistant`) can also include a `preference-divergence` entry: the same prompt, two different preference profiles, and the expected output under each. This is the closest thing to an automated check that the preferences layer is actually doing something — see `skills/writing-assistant/evals/evals.json` for the pattern.

## How to actually run evals

There's no runner script — these are prompts for a human (or an agent session) to try, not unit tests. For each skill:

1. Read through `evals/evals.json`.
2. Run each `positive` prompt with the skill installed and available. Confirm it fires and the output roughly matches `expected`.
3. Run each `negative` prompt and confirm the skill does *not* fire — that a more general or different skill (or no skill at all) handles it instead.
4. For a `preference-divergence` entry, set up both preference profiles (temporarily, in a scratch location — never overwrite your real preferences file) and run the same prompt under each. Confirm the outputs actually differ in the ways described, and that neither drops information the other includes.
5. **Also run each positive prompt with the skill unavailable** (temporarily moved out of the skills directory) and compare. If the with-skill output isn't clearly better, per `docs/PLAN.md` Section 9, the skill isn't earning its place — this is the check that catches "wrapper skills" that just restate a tool Claude already has.

## What to assert vs. what to judge

Write hard checks only for objectively checkable properties: a file was produced, a required section is present, output is valid JSON/YAML, a word-count cap was respected. Don't force a checkbox onto something subjective like tone or warmth — read the output and judge it. `docs/PLAN.md` Section 9 calls this out explicitly: assertions on subjective qualities produce false confidence, not real coverage.

## When a skill fails an eval

Generalize from the failure — don't patch just enough to pass the specific prompt in front of you. If a fix only helps the exact test prompts in `evals.json`, it's overfitting and will fall apart on the next realistic prompt that's slightly different. When a problem is stubborn, try reframing the instruction or the worked example in `SKILL.md` rather than stacking another constraint on top of the existing ones (see `docs/AUTHORING.md` "Writing style" on why explaining *why* beats stacking MUSTs).

Also read the transcript, not just the final output, when something goes wrong. A skill that gets to the right answer only after wasting several steps has a problem worth fixing even though the eval "passed."

## Recording results

There's no dashboard — record what you found in the PR description or commit message when you touch a skill's behavior: what you tested, what changed, and why. `CHANGELOG.md` is for the history of what shipped; eval results belong in the change that produced them, so a later regression has something to diff against.
