#!/usr/bin/env python3
"""Validate every skill under skills/ against this repo's authoring conventions.

Checks, per skill directory:
  - SKILL.md exists, starts with a closed '---' frontmatter block
  - frontmatter 'name' matches the directory name
  - frontmatter 'description' is present and a sane length
  - SKILL.md line count: warn over 400, fail over 600
  - every references/, scripts/, or assets/ path mentioned in SKILL.md exists
  - evals/evals.json exists, is valid JSON, has at least two prompts,
    and at least one of type "negative"

No network access, no third-party dependencies (stdlib only) — this runs
in CI and locally with a plain `python3 tools/validate_skills.py`.
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"

MIN_DESCRIPTION_LENGTH = 20
MAX_DESCRIPTION_LENGTH = 1500
WARN_LINE_COUNT = 400
FAIL_LINE_COUNT = 600
REFERENCE_PATTERN = re.compile(r"(?:references|scripts|assets)/[\w./-]+")


def fail(messages, msg):
    print(f"::error::{msg}")
    messages.append(msg)


def warn(msg):
    print(f"::warning::{msg}")


def validate_frontmatter(skill_dir, lines, errors):
    name = skill_dir.name
    if not lines or lines[0].strip() != "---":
        fail(errors, f"{name}: SKILL.md must start with a '---' frontmatter block")
        return

    try:
        end = lines[1:].index("---") + 1
    except ValueError:
        fail(errors, f"{name}: SKILL.md frontmatter block is never closed with '---'")
        return

    frontmatter = lines[1:end]
    fm_name = next(
        (l.split(":", 1)[1].strip() for l in frontmatter if l.startswith("name:")),
        None,
    )
    fm_desc_line = next((l for l in frontmatter if l.startswith("description:")), None)

    if fm_name != name:
        fail(errors, f"{name}: frontmatter name '{fm_name}' must match directory name")

    if not fm_desc_line:
        fail(errors, f"{name}: frontmatter missing 'description'")
    else:
        desc = fm_desc_line.split(":", 1)[1].strip()
        if len(desc) < MIN_DESCRIPTION_LENGTH:
            fail(errors, f"{name}: frontmatter description is too short to describe triggers")
        elif len(desc) > MAX_DESCRIPTION_LENGTH:
            warn(f"{name}: frontmatter description is over {MAX_DESCRIPTION_LENGTH} characters — consider tightening it")


def validate_line_count(skill_dir, lines, errors):
    name = skill_dir.name
    count = len(lines)
    if count > FAIL_LINE_COUNT:
        fail(errors, f"{name}: SKILL.md is {count} lines, over the {FAIL_LINE_COUNT}-line hard limit")
    elif count > WARN_LINE_COUNT:
        warn(f"{name}: SKILL.md is {count} lines — consider moving detail into references/")


def validate_references(skill_dir, text, errors):
    name = skill_dir.name
    for ref in sorted(set(REFERENCE_PATTERN.findall(text))):
        if not (skill_dir / ref).exists():
            fail(errors, f"{name}: SKILL.md references '{ref}', which does not exist")


def validate_evals(skill_dir, errors):
    name = skill_dir.name
    evals_path = skill_dir / "evals" / "evals.json"
    if not evals_path.exists():
        fail(errors, f"{name}: missing evals/evals.json")
        return

    try:
        evals = json.loads(evals_path.read_text())
    except json.JSONDecodeError as e:
        fail(errors, f"{name}: evals/evals.json is not valid JSON ({e})")
        return

    prompts = evals.get("prompts", [])
    if len(prompts) < 2:
        fail(errors, f"{name}: evals/evals.json needs at least two prompts, has {len(prompts)}")
    if not any(p.get("type") == "negative" for p in prompts):
        fail(errors, f"{name}: evals/evals.json needs at least one negative-case prompt")


def validate_skill(skill_dir):
    errors = []
    name = skill_dir.name
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        fail(errors, f"{name}: missing SKILL.md")
        return errors

    text = skill_md.read_text()
    lines = text.splitlines()

    validate_frontmatter(skill_dir, lines, errors)
    validate_line_count(skill_dir, lines, errors)
    validate_references(skill_dir, text, errors)
    validate_evals(skill_dir, errors)
    return errors


def main():
    if not SKILLS_DIR.exists() or not any(SKILLS_DIR.iterdir()):
        print("No skills/ directory yet — nothing to validate.")
        return 0

    all_errors = []
    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if skill_dir.is_dir():
            all_errors.extend(validate_skill(skill_dir))

    if all_errors:
        print(f"\n{len(all_errors)} error(s) found.")
        return 1

    print("All skills passed validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
