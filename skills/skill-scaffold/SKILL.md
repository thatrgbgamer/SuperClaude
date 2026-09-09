---
name: skill-scaffold
description: Creates a new skill in this SuperClaude repo following every authoring convention — frontmatter, the preferences loader block, a per-skill README spec, and evals with a negative case — then runs it through validation. Use when the user asks to add a new skill, scaffold a skill, start a new skill for this repo, or propose/build a skill idea for the collection. Do not use for editing or improving an existing skill (that's a direct edit, not scaffolding), and do not use for one-off scripts or prompts that aren't meant to join this repo's skills/ directory.
version: 0.1.0
---

# Skill scaffold

This skill dogfoods the repo: it builds a new skill the same way any contributor should, per `CONTRIBUTING.md` and `docs/PLAN.md` Section 7.

## Step 1: earn the skill

Before creating anything, make sure this clears the bar in `CONTRIBUTING.md` "Before proposing a new skill": a real problem, realistic trigger phrases, a check that nothing existing already covers this territory, and a reason Claude can't already do this well without a skill. If the user hasn't already answered these, ask — don't scaffold a skill nobody has thought through yet.

## Step 2: pick the name

Lowercase, hyphenated, matches what the directory will be called (e.g. `code-review`, not `CodeReview` or `code_review`). Confirm it doesn't collide with an existing skill in `skills/`.

## Step 3: run the scaffolder

```sh
python3 tools/new_skill.py <skill-name>
```

This creates `skills/<skill-name>/SKILL.md`, `README.md`, and `evals/evals.json` with placeholder content that is structurally valid but not remotely finished — every `TODO` needs real content.

## Step 4: fill it in for real

Work through the per-skill spec template, in this order (per `docs/PLAN.md` Section 7 — write the README before the SKILL.md body, since docs written last don't get written):

1. **README.md**: Problem, trigger phrases (five to ten realistic ones), non-triggers (three to five adjacent things that should NOT fire it), inputs, output shape, preferences consumed, bundled resources, test cases, done-when criteria.
2. **SKILL.md description**: the entire triggering mechanism — state what it does and when to use it, including phrasings a user would actually say, and what it should not be used for. Lean slightly assertive (the common failure is a skill not firing when it would have helped), but scope it sharply enough not to collide with another skill's territory.
3. **SKILL.md body**: imperative voice, explain *why* a rule matters rather than stacking capitalized MUSTs, include at least one worked example with real input and output. Keep the preferences-loader block near the top if the skill's behavior should vary by voice/formatting/workflow settings — delete it if the skill genuinely has nothing to adapt.
4. **evals/evals.json**: replace both placeholder prompts with real ones, and add more — at least two or three realistic positive prompts plus negatives. If the skill's output should visibly change based on preferences (like `writing-assistant`), consider adding a `preference-divergence` case too.

## Step 5: validate

```sh
python3 tools/validate_skills.py
```

Fix anything it flags. A clean run here is necessary, not sufficient — it only checks structure (frontmatter, line counts, dead reference links, evals shape), not whether the skill is actually any good.

## Step 6: check the trigger map

Compare the new skill's description against every existing skill's territory in the trigger map in `docs/AUTHORING.md`. If two skills would both plausibly fire on the same realistic prompt, narrow one of them before merging — and update the trigger map with the new skill's own row once it's done.

## Step 7: actually test it

Run the eval prompts once with the skill available, once without, and compare — per `docs/PLAN.md` Section 9. If the with-skill output isn't clearly better, the skill isn't earning its place; cut it or rework it rather than shipping it anyway.

## What this skill will not do

It will not skip Step 1 just because a name and a rough idea were given — "build me a skill for X" without a clear problem statement gets a few clarifying questions first, not an immediate scaffold. It will not mark something done at Step 5 — passing validation is a structural check, not a quality bar.
