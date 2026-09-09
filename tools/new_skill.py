#!/usr/bin/env python3
"""Scaffold a new skill under skills/<name>/ following this repo's conventions.

Usage:
    python3 tools/new_skill.py <skill-name>

Creates SKILL.md, README.md, and evals/evals.json with placeholder content
that is structurally valid (passes tools/validate_skills.py as-is) but
still needs real content before it ships — every TODO must be replaced
before this counts as done. See CONTRIBUTING.md and docs/PLAN.md Section 7.
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
NAME_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

SKILL_MD_TEMPLATE = """---
name: {name}
description: TODO — state exactly what this skill does and when to use it, including phrasings a user would actually say. This is the entire triggering mechanism; nothing in the body below is visible before this skill fires. Also state what it should NOT be used for if anything adjacent could be confused with it.
version: 0.1.0
---

# {title}

## Preferences

Load preferences before acting, if this skill's behavior should vary by voice, formatting, or workflow settings: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal; proceed with sensible built-in defaults. An explicit instruction in the current request always beats a conflicting preference, applied silently. Full contract: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection). Delete this section if the skill genuinely has nothing to adapt.

## TODO: replace this whole section with the real skill body

Explain what to do, step by step, in imperative voice. Explain *why* a rule matters instead of stacking capitalized MUSTs — a model that understands the reason generalizes. Include at least one worked example with real input and real output.

## Output format

TODO: give the exact shape of what this skill produces, if it's a structured artifact. Ambiguity about output shape is the most common cause of inconsistent results.
"""

README_TEMPLATE = """# {name}

## Problem

TODO — what goes wrong without this skill?

## Trigger phrases

TODO — five to ten realistic things a user would say.

## Non-triggers

TODO — three to five adjacent things that should NOT fire this skill.

## Inputs

TODO — what does it expect to be given?

## Output

TODO — exact shape of what it produces.

## Preferences consumed

TODO — which preference keys change its behavior, and how. Write "None" if genuinely none.

## Bundled resources

TODO — what goes in references/, scripts/, assets/, and why. Write "None" if the guidance fits in SKILL.md alone.

## Test cases

See `evals/evals.json`. TODO — describe what they cover.

## Done when

TODO — concrete completion criteria.
"""

EVALS_TEMPLATE = """{{
  "skill": "{name}",
  "prompts": [
    {{
      "type": "positive",
      "prompt": "TODO — a realistic prompt that should fire this skill.",
      "expected": "TODO — what a correct response looks like."
    }},
    {{
      "type": "negative",
      "prompt": "TODO — an adjacent prompt that should NOT fire this skill.",
      "expected": "TODO — why this doesn't belong to this skill."
    }}
  ]
}}
"""


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 tools/new_skill.py <skill-name>", file=sys.stderr)
        return 1

    name = sys.argv[1]
    if not NAME_PATTERN.match(name):
        print(f"Invalid skill name '{name}': must be lowercase, hyphenated, no spaces (e.g. 'code-review').", file=sys.stderr)
        return 1

    skill_dir = REPO_ROOT / "skills" / name
    if skill_dir.exists():
        print(f"skills/{name} already exists — not overwriting.", file=sys.stderr)
        return 1

    (skill_dir / "evals").mkdir(parents=True)

    title = name.replace("-", " ").capitalize()
    (skill_dir / "SKILL.md").write_text(SKILL_MD_TEMPLATE.format(name=name, title=title))
    (skill_dir / "README.md").write_text(README_TEMPLATE.format(name=name))
    (skill_dir / "evals" / "evals.json").write_text(EVALS_TEMPLATE.format(name=name))

    print(f"Scaffolded skills/{name}/")
    print("Every TODO in SKILL.md, README.md, and evals/evals.json needs real content before this ships.")
    print(f"Run `python3 tools/validate_skills.py` when done — the scaffold passes structurally as-is, but that isn't the same as being finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
