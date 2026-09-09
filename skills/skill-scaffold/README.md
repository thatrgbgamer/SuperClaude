# skill-scaffold

## Problem

Every skill in this repo is supposed to follow the same conventions — frontmatter shape, a preferences loader block, a README spec written before the SKILL.md body, evals with a negative case. Without a scaffolding skill, each new skill either skips steps or reinvents the boilerplate slightly differently, and the trigger-collision check in `docs/PLAN.md` Section 6.5 gets skipped because nobody remembers it's there.

## Trigger phrases

- "Add a new skill for reviewing PRs."
- "Let's scaffold a skill for writing release notes."
- "I want to build a skill that does X — help me set it up."
- "Start a new skill called `debug-triage`."
- "Can you propose and build a skill for turning meeting notes into action items?"

## Non-triggers

- "Fix the description on the `writing-assistant` skill." — editing an existing skill, not scaffolding a new one.
- "Write me a quick script to rename some files." — a one-off script, not meant to join `skills/`.
- "Explain how Claude Skills work in general." — a question about the concept, not a request to build one here.

## Inputs

A skill idea: what problem it solves, and ideally some sense of trigger phrases. If the user only has a vague idea, this skill asks the Step 1 questions from `CONTRIBUTING.md` before scaffolding anything.

## Output

A new `skills/<name>/` directory containing a filled-in `SKILL.md`, `README.md`, and `evals/evals.json` that passes `tools/validate_skills.py` with no errors.

## Preferences consumed

None directly — this skill's own output (skill authoring artifacts) isn't itself styled by user voice/formatting preferences. It exists to help build skills that *do* consume preferences correctly.

## Bundled resources

None. The workflow is short enough to keep entirely in `SKILL.md`; it delegates the mechanical scaffolding to `tools/new_skill.py` and `tools/validate_skills.py` rather than duplicating their logic here.

## Test cases

See `evals/evals.json`.

## Done when

- Running this skill on a well-formed request produces a `skills/<name>/` directory that passes `tools/validate_skills.py` immediately.
- It refuses (asks clarifying questions instead) when the request lacks a clear problem statement or trigger phrases.
- It does not fire on requests to edit an existing skill or write an unrelated one-off script.
