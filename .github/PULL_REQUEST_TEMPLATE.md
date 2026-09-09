## Summary

<!-- What does this PR add or change, and why? -->

## Checklist

- [ ] No real names, hostnames, private URLs, API keys, or personal-setup specifics anywhere in this diff (skills, examples, docs, commit messages)
- [ ] Any personalization goes through the preferences file, not hardcoded into a skill
- [ ] If this adds/changes a skill: `skills/<name>/README.md` spec is present and filled out
- [ ] If this adds/changes a skill: `skills/<name>/evals/evals.json` has at least two prompts, including one negative case
- [ ] Frontmatter (`name`, `description`) is present, `name` matches the directory name
- [ ] SKILL.md is under 500 lines (hard fail at 600); detail moved to `references/` if it's getting long
- [ ] Ran the eval prompts and compared with/without the skill — the skill visibly earns its place
- [ ] CI passes (frontmatter validation, line counts, link checks, secret scan, personal-data scan, markdown lint)
- [ ] If this changes the preferences schema or a skill's output format: called out as a breaking change in `CHANGELOG.md`

## Related issue

<!-- Link the issue this PR addresses, if any -->
