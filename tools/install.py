#!/usr/bin/env python3
"""Install SuperClaude skills into a Claude Code skills directory.

    python3 tools/install.py --list
    python3 tools/install.py --starter
    python3 tools/install.py --all
    python3 tools/install.py writing-assistant fount-gamedev
    python3 tools/install.py --all --project
    python3 tools/install.py --uninstall --all

Stdlib only, no network access. Installing is a plain directory copy —
Claude Code picks up anything under the skills directory with no
registration step.
"""

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"

# evals/ is a development artifact for this repo's own testing; an installed
# skill never reads it, so it is left behind the same way package_skill.py does.
EXCLUDED = {"evals"}

STARTER_SET = ["preferences-setup", "writing-assistant"]

GREEN, YELLOW, RED, DIM, BOLD, RESET = (
    ("\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[1m", "\033[0m")
    if sys.stdout.isatty() else ("", "", "", "", "", "")
)


def available_skills():
    if not SKILLS_DIR.is_dir():
        return []
    return sorted(p.name for p in SKILLS_DIR.iterdir() if (p / "SKILL.md").is_file())


def read_description(name):
    """Pull the frontmatter description so --list is useful without opening files."""
    skill_md = SKILLS_DIR / name / "SKILL.md"
    try:
        lines = skill_md.read_text(encoding="utf-8").splitlines()
    except OSError:
        return ""
    if not lines or lines[0].strip() != "---":
        return ""
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("description:"):
            text = line.split(":", 1)[1].strip()
            return text.split(". ")[0].rstrip(".")
    return ""


def target_dir(args):
    if args.target:
        return Path(args.target).expanduser().resolve()
    if args.project:
        return Path.cwd() / ".claude" / "skills"
    return Path.home() / ".claude" / "skills"


def manifest_path(target):
    # Kept beside the skills directory rather than inside each skill, so
    # installed skills stay byte-identical to what is in the repo.
    return target.parent / ".superclaude-manifest.json"


def load_manifest(target):
    path = manifest_path(target)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"installed": {}}


def save_manifest(target, manifest):
    path = manifest_path(target)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def skill_version(name):
    skill_md = SKILLS_DIR / name / "SKILL.md"
    try:
        lines = skill_md.read_text(encoding="utf-8").splitlines()
    except OSError:
        return "unknown"
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("version:"):
            return line.split(":", 1)[1].strip()
    return "unknown"


def copy_skill(source, dest):
    shutil.copytree(
        source, dest,
        ignore=lambda directory, names: {n for n in names if n in EXCLUDED},
    )


def install(names, args):
    target = target_dir(args)
    manifest = load_manifest(target)
    installed, updated, skipped = [], [], []

    for name in names:
        source = SKILLS_DIR / name
        dest = target / name
        tracked = name in manifest["installed"]

        if dest.exists() and not tracked and not args.force:
            # Something we did not put there. Could be the user's own work.
            print(f"  {YELLOW}skip{RESET}    {name} {DIM}(already exists and was not installed by us — use --force){RESET}")
            skipped.append(name)
            continue

        action = "update" if dest.exists() else "install"
        if args.dry_run:
            print(f"  {DIM}would {action}{RESET} {name}")
            continue

        if dest.exists():
            shutil.rmtree(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        copy_skill(source, dest)

        manifest["installed"][name] = {
            "version": skill_version(name),
            "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        print(f"  {GREEN}{'installed' if action == 'install' else 'updated'}{RESET} {name}")
        (updated if action == "update" else installed).append(name)

    if not args.dry_run:
        save_manifest(target, manifest)

    print()
    if args.dry_run:
        print(f"{DIM}Dry run — nothing was written.{RESET}")
        return 0

    print(f"{BOLD}{len(installed)} installed, {len(updated)} updated"
          + (f", {len(skipped)} skipped" if skipped else "") + f"{RESET}")
    print(f"Location: {target}")

    prefs = Path.home() / ".claude" / "skills-preferences.yaml"
    project_prefs = Path.cwd() / ".claude" / "preferences.yaml"
    if not prefs.exists() and not project_prefs.exists():
        print()
        print("Next: open Claude Code and say \"set up my SuperClaude preferences\" —")
        print("that runs preferences-setup and tailors every skill to you.")
        print(f"{DIM}Skills work fine without it, using the neutral defaults.{RESET}")
    return 0


def uninstall(names, args):
    target = target_dir(args)
    manifest = load_manifest(target)
    removed, skipped = [], []

    for name in names:
        dest = target / name
        if not dest.exists():
            continue
        if name not in manifest["installed"] and not args.force:
            # Refusing here is the point: an untracked directory with a
            # matching name may well be the user's own customised skill.
            print(f"  {YELLOW}skip{RESET}    {name} {DIM}(not installed by us — use --force to remove anyway){RESET}")
            skipped.append(name)
            continue
        if args.dry_run:
            print(f"  {DIM}would remove{RESET} {name}")
            continue
        shutil.rmtree(dest)
        manifest["installed"].pop(name, None)
        print(f"  {GREEN}removed{RESET} {name}")
        removed.append(name)

    if not args.dry_run:
        save_manifest(target, manifest)
        print()
        print(f"{BOLD}{len(removed)} removed"
              + (f", {len(skipped)} skipped" if skipped else "") + f"{RESET}")
    return 0


def list_skills(args):
    target = target_dir(args)
    manifest = load_manifest(target)
    names = available_skills()
    if not names:
        print("No skills found in this repo's skills/ directory.")
        return 1

    width = max(len(n) for n in names)
    print(f"\n{BOLD}Available skills{RESET}  {DIM}(target: {target}){RESET}\n")
    for name in names:
        entry = manifest["installed"].get(name)
        if entry:
            mark = f"{GREEN}installed{RESET}"
        elif (target / name).exists():
            mark = f"{YELLOW}present{RESET}  "
        else:
            mark = f"{DIM}—{RESET}        "
        star = "*" if name in STARTER_SET else " "
        print(f"  {star} {name.ljust(width)}  {mark}  {DIM}{read_description(name)[:70]}{RESET}")
    print(f"\n  {DIM}* = starter set (install with --starter){RESET}\n")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Install SuperClaude skills into a Claude Code skills directory.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("\n\n", 1)[1],
    )
    parser.add_argument("names", nargs="*", help="skill names to install")
    parser.add_argument("--all", action="store_true", help="every skill in the collection")
    parser.add_argument("--starter", action="store_true",
                        help=f"the recommended starter set ({', '.join(STARTER_SET)})")
    parser.add_argument("--list", action="store_true", help="show skills and their install state")
    parser.add_argument("--uninstall", action="store_true", help="remove instead of install")
    parser.add_argument("--project", action="store_true",
                        help="install into ./.claude/skills instead of your home directory")
    parser.add_argument("--target", help="explicit skills directory")
    parser.add_argument("--force", action="store_true",
                        help="overwrite or remove directories this installer did not create")
    parser.add_argument("--dry-run", action="store_true", help="show what would happen")
    args = parser.parse_args()

    if args.list:
        return list_skills(args)

    known = available_skills()
    if args.all:
        names = known
    elif args.starter:
        names = [n for n in STARTER_SET if n in known]
    else:
        names = args.names

    if not names:
        parser.print_help()
        print(f"\n{YELLOW}Nothing selected.{RESET} Try --starter, --all, or --list.")
        return 1

    unknown = [n for n in names if n not in known]
    if unknown:
        print(f"{RED}Unknown skill(s): {', '.join(unknown)}{RESET}")
        print(f"Available: {', '.join(known)}")
        return 1

    verb = "Uninstalling" if args.uninstall else "Installing"
    print(f"\n{BOLD}{verb} {len(names)} skill(s){RESET}\n")
    return uninstall(names, args) if args.uninstall else install(names, args)


if __name__ == "__main__":
    sys.exit(main())
