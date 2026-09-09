#!/usr/bin/env python3
"""Package a single skill folder into an installable .skill bundle.

Usage:
    python3 tools/package_skill.py <skill-name>

Produces dist/<skill-name>.skill — a zip archive of everything a user
needs to install and run the skill (SKILL.md, README.md, references/,
scripts/, assets/). evals/ is excluded: it's a repo development
artifact, not something an installed skill needs. dist/ is gitignored.
"""

import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXCLUDED_DIR_NAMES = {"evals"}


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 tools/package_skill.py <skill-name>", file=sys.stderr)
        return 1

    name = sys.argv[1]
    skill_dir = REPO_ROOT / "skills" / name
    if not skill_dir.is_dir():
        print(f"skills/{name} does not exist.", file=sys.stderr)
        return 1

    dist_dir = REPO_ROOT / "dist"
    dist_dir.mkdir(exist_ok=True)
    bundle_path = dist_dir / f"{name}.skill"

    files = [
        p for p in skill_dir.rglob("*")
        if p.is_file() and EXCLUDED_DIR_NAMES.isdisjoint(p.relative_to(skill_dir).parts)
    ]

    with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in files:
            arcname = Path(name) / file_path.relative_to(skill_dir)
            zf.write(file_path, arcname)

    print(f"Packaged {len(files)} file(s) into {bundle_path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
