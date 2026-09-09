# Claude Skills Collection: Build Plan and Kickoff Prompt

A complete specification for building a public, open source collection of Claude Skills with a user preferences layer instead of hardcoded personalization.

Hand this whole file to Claude Code. Section 2 is the prompt to paste; everything after it is the spec Claude Code should work from.

---

## 1. How to use this document

1. Create an empty repo and drop this file in at `docs/PLAN.md`.
2. Paste Section 2 into Claude Code as the opening message.
3. Let Claude Code work through the phases in Section 10, checking in at each phase gate.
4. Answer the open questions in Section 18 when Claude Code asks. Do not let it guess on those.

---

## 2. Kickoff prompt

> You are building a public, open source collection of Claude Skills. The full specification is in `docs/PLAN.md` in this repo. Read it completely before writing anything.
>
> Key constraints:
> - This is a public repo. Nothing in it may contain personal information, real names, real hostnames, private URLs, API keys, or anything specific to one person's setup. All personalization happens through a user preferences file that each user fills in locally and that is gitignored.
> - Build one vertical slice first: the preferences system plus a single complete skill that consumes it, with tests, docs, and CI passing. Do not scaffold thirty skill folders on day one.
> - Stop at each phase gate in Section 10 and show me what you have before continuing.
>
> Start by reading `docs/PLAN.md`, then ask me the open questions in Section 18. Do not begin implementation until I have answered them.

---

## 3. Goals and non goals

### Goals

- A collection of Claude Skills that are useful to a general audience, not to one person.
- A preferences layer so any user can make every skill in the collection match their own tone, stack, formatting, and workflow without editing the skills themselves.
- Skills that install cleanly through the normal distribution paths (personal skills, project skills, and a plugin marketplace).
- A repo that a stranger can clone, understand in ten minutes, and contribute to.
- Every skill tested against realistic prompts, including negative cases where it should not fire.

### Non goals

- Not a framework. Skills are markdown with optional bundled files. Resist inventing a runtime.
- Not a replacement for tools Claude already has. A skill that says "use the search tool" adds nothing.
- Not a dumping ground. A skill that has never been tested does not ship.
- No telemetry, no phoning home, nothing that reads user data and sends it anywhere.

---

## 4. Repo layout

```
repo-root/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── .gitignore                      # must ignore the local preferences file
├── .github/
│   ├── workflows/                  # CI: lint, validate, test
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── PLAN.md                     # this file
│   ├── AUTHORING.md                # how to write a skill for this repo
│   ├── PREFERENCES.md              # the preferences contract, canonical reference
│   ├── INSTALL.md                  # every install path, step by step
│   └── TESTING.md                  # how evals work here
├── config/
│   ├── preferences.example.yaml    # committed template, fully commented
│   └── defaults.yaml               # what skills assume when no prefs exist
├── skills/
│   ├── <skill-name>/
│   │   ├── SKILL.md                # required
│   │   ├── README.md               # short, for repo browsers
│   │   ├── references/             # loaded on demand
│   │   ├── scripts/                # executable helpers
│   │   ├── assets/                 # templates, fonts, icons
│   │   └── evals/
│   │       └── evals.json          # test prompts, including negative cases
│   └── ...
├── shared/
│   ├── preferences-loader.md       # the one canonical "load prefs" block
│   └── conventions.md              # shared output conventions skills can cite
├── tools/
│   ├── validate_skills.*           # frontmatter, line counts, link checks
│   ├── package_skill.*             # produce installable .skill bundles
│   └── new_skill.*                 # scaffold a skill from the template
└── plugin/
    └── marketplace manifest        # if distributing as a plugin bundle
```

Rules:

- One skill per directory. Directory name matches the `name` in frontmatter exactly.
- `shared/` holds text that skills reference, never code that skills import at runtime. Skills must remain individually installable. If someone copies one skill folder out of the repo, it has to still work, with the shared material degrading to a sensible default.
- Anything in `scripts/` must run with no network access and no credentials.

---

## 5. The preferences system

This is the core design decision of the repo. Get it right before writing skills.

### 5.1 What it is

A single, small, human editable file that the user owns. Every skill reads it at trigger time and adapts its output. The skills themselves ship with neutral defaults and zero personal content.

### 5.2 Resolution order

Skills look for preferences in this order and use the first file found:

1. `.claude/preferences.yaml` in the current project or working directory (project specific overrides)
2. `~/.claude/skills-preferences.yaml` (the user's global preferences)
3. `config/defaults.yaml` from the repo (neutral fallback)

If none exist, skills proceed with built in defaults and do not nag. Missing preferences is a normal state, not an error. A skill that refuses to run without a config file is broken.

### 5.3 Precedence

Explicit instruction in the current request beats project preferences, which beat global preferences, which beat repo defaults. If a user says "make this one formal" and their preferences say casual, the request wins, silently. Never announce the override.

### 5.4 Format

YAML with a free text notes block. Structured keys are machine friendly; the notes block catches nuance that no schema anticipates.

Proposed key groups (Claude Code should refine, but keep it flat and short; a preferences file longer than a screen and a half will not be maintained):

- **identity**: display name or handle, timezone, locale, units (metric or imperial), date format, spelling variant (US or UK)
- **voice**: formality level, verbosity, humor, emoji use, hedging tolerance, first person or third person
- **formatting**: prose vs bullets, heading depth, table use, code fence language tags, banned punctuation or phrases, maximum response length for chat vs documents
- **stack**: primary languages, package managers, test frameworks, OS, shell, editor, container runtime, cloud provider
- **workflow**: commit message convention, branch naming, PR description style, review depth, whether to run tests before proposing changes, whether to ask before creating files
- **content**: publishing platforms, audience description, path to an optional brand voice file
- **privacy**: things never to include in output (a user supplied list), redaction behavior, whether to use placeholders for names and locations
- **safety**: confirm before destructive operations, confirm before network calls, confirm before installing packages
- **notes**: free text, anything the schema missed

### 5.5 Hard limits on what preferences can do

Document this in `docs/PREFERENCES.md` and enforce it in the loader text. Preferences change how things are said, never whether a real problem gets raised. Specifically, a preferences file must not be able to:

- Suppress disagreement, criticism, or error reporting
- Instruct skills to treat unverified claims as established
- Grant elevated permissions or claim special authorization
- Disable safety confirmations for destructive operations
- Instruct skills to ignore repo conventions or Claude's own guidelines

If a preferences file contains a key that tries to do any of that, skills ignore that key and continue. Say so plainly in the docs so users know the boundary up front. This matters more in a public repo than a private one: someone will try it.

### 5.6 The loader block

Write the canonical loading instruction once, in `shared/preferences-loader.md`. Every SKILL.md includes a short standard block near the top, roughly three to five lines, that points there and states the fallback. Do not restate the whole resolution order in thirty different files; when it changes you will miss some.

The block should be short enough that it costs almost nothing in context, and specific enough that Claude actually goes and reads the file rather than assuming defaults.

### 5.7 Setup experience

Ship a `preferences-setup` skill that interviews the user in a handful of questions and writes the file for them. Most people will not read a schema. The interview should:

- Ask few questions, with sensible defaults offered for each
- Write the file to the global location by default, offering the project location as an alternative
- Show the user the resulting file and offer to adjust
- Work incrementally, so a user can come back later and change one section without redoing the interview

Also ship `preferences.example.yaml`, heavily commented, for people who prefer editing by hand.

### 5.8 Gitignore

`.gitignore` must include the local preferences paths. Add a CI check that fails if a file matching the preferences filename pattern is ever committed. This is the single most likely way personal data leaks into a public repo.

---

## 6. Skill authoring conventions

Put all of this in `docs/AUTHORING.md` and follow it in every skill.

### 6.1 Frontmatter

Required: `name`, `description`. Optional: `compatibility` (required tools or dependencies), `version`.

`name` is the skill identifier and matches the directory name. Lowercase, hyphenated, no spaces.

`description` is the entire triggering mechanism. It must state what the skill does and when to use it, including the phrasings a user would actually say. All "when to use" information lives here, never in the body, because the body is not in context at trigger time.

Descriptions should lean slightly assertive, because the common failure is a skill not firing when it would have helped. But see 6.5: in a large collection, over assertive descriptions collide with each other, so assertiveness has to be paired with sharp scoping.

### 6.2 Progressive disclosure

Three levels:

1. Name and description, always in context, roughly 100 words
2. SKILL.md body, in context when the skill fires, under 500 lines
3. Bundled references and scripts, loaded or executed only when needed, effectively unlimited

If a SKILL.md approaches 500 lines, add hierarchy: move detail into `references/` and leave clear pointers about when to go read each one. For reference files over about 300 lines, include a table of contents at the top.

When a skill covers several variants (frameworks, platforms, output formats), organize `references/` by variant so only the relevant one gets read.

### 6.3 Writing style

- Imperative voice for instructions.
- Explain why a rule matters rather than stacking capitalized MUSTs. A model that understands the reason generalizes; a model following a rule list overfits.
- Include worked examples with input and output. Two good examples beat a page of abstraction.
- Write general guidance, not guidance welded to the specific examples used during development.
- Draft, then reread with fresh eyes and cut. Most first drafts are twice as long as they need to be.

### 6.4 Output format specification

Where a skill produces a structured artifact, give the exact template in the skill. Ambiguity about output shape is the most common cause of inconsistent results.

### 6.5 Trigger disambiguation across a large collection

This is the problem unique to shipping many skills together, and it deserves real attention.

- Give each skill a distinct trigger vocabulary. If two skills both claim "write a document", one of them is scoped wrong.
- Prefer a small number of broad, well built skills over many narrow overlapping ones. Merge before you split.
- Every skill's evals must include negative cases: prompts that look adjacent but should not fire this skill. Track false trigger rate as seriously as trigger rate.
- Maintain a trigger map in `docs/AUTHORING.md`: a table of every skill and its claimed territory. Review it whenever a skill is added. If a new skill's territory overlaps an existing one, resolve the overlap before merging.
- Simple one step tasks will not trigger skills regardless of description quality, because Claude handles them directly. Do not tune descriptions against test prompts that are too simple to need a skill.

### 6.6 Safety and trust

- No skill may contain exploit code, credential harvesting, or anything that exfiltrates user data.
- A skill's behavior must not surprise a user who read its description.
- Scripts must not make network calls without an explicit statement in the skill body about what they contact and why.
- Skills that touch the filesystem destructively must confirm first, and that confirmation cannot be disabled by preferences.

---

## 7. Per skill specification template

Every skill gets a short spec written before implementation, checked into `skills/<name>/README.md`:

- **Problem**: what goes wrong without this skill
- **Trigger phrases**: five to ten realistic things a user would say
- **Non triggers**: three to five adjacent things that should not fire it
- **Inputs**: what it expects to be given
- **Output**: exact shape of what it produces
- **Preferences consumed**: which preference keys change its behavior, and how
- **Bundled resources**: what goes in references, scripts, assets, and why
- **Test cases**: two or three realistic prompts, plus negatives
- **Done when**: concrete completion criteria

---

## 8. Skill catalog

Organized by tier. Tier 1 ships first and proves the architecture. Do not start Tier 2 until Tier 1 is complete, tested, documented, and installed successfully by someone who is not the author.

### Tier 1: foundation and proof (build these first)

| Skill | Purpose |
|---|---|
| `preferences-setup` | Interviews the user and writes their preferences file. Also handles incremental edits later. |
| `skill-scaffold` | Creates a new skill in this repo following every convention here, including the spec, evals, and docs. Dogfoods the repo. |
| `writing-assistant` | General purpose drafting and editing that respects voice, formatting, and banned phrase preferences. The best single demonstration that the preferences layer works, because the difference is visible immediately. |

### Tier 2: high value, broad audience

| Skill | Purpose |
|---|---|
| `email-drafter` | Outreach, replies, follow ups, declines. Produces multiple strategic variants rather than one take. Honors formality and length preferences. |
| `code-review` | Structured review against a configurable checklist. Severity tiers. Respects stack preferences for idiom. |
| `repo-onboarding` | Explains an unfamiliar codebase: entry points, architecture, conventions, where to make a given change. |
| `commit-and-pr` | Commit messages and PR descriptions following the user's stated convention. |
| `debug-triage` | Systematic narrowing of a bug: reproduce, isolate, hypothesize, test. Prevents the flailing pattern. |
| `document-formatter` | Turns rough notes into a clean structured document in the user's preferred format and heading style. |
| `source-summarizer` | Articles, papers, docs, transcripts. Configurable depth, from one paragraph to detailed outline. |
| `data-cleanup` | Messy tabular data into clean, documented output with a record of every transformation applied. |
| `research-brief` | Multi source research with source quality vetting and explicit uncertainty marking. Honors any user preference about which sources they trust. |

### Tier 3: valuable but narrower

| Skill | Purpose |
|---|---|
| `meeting-to-actions` | Notes or transcript into decisions, owners, and dated action items. |
| `weekly-review` | Structured personal or team review with configurable sections. |
| `release-notes` | Changelog and release notes from commit history, at a configurable audience level. |
| `api-integration` | Reading API docs and producing a working integration plan with auth, errors, rate limits, retries. |
| `test-writer` | Test suites following the user's framework preference, with coverage reasoning rather than volume. |
| `shell-scripting` | Robust scripts with error handling, argument parsing, and dry run support as a default. |
| `runbook-writer` | Operational runbooks for services, with failure modes and recovery steps. |
| `diagram-spec` | Architecture and flow diagrams with consistent conventions. |
| `slide-outline` | Deck structure and speaker notes before any visual work begins. |
| `spec-comparison` | Comparing products or options on stated criteria without marketing language. |
| `hardware-planner` | Parts lists with compatibility, power budget, thermals, and total cost. |
| `parametric-modeling` | Parametric 3D models via code driven CAD, producing printable output. |
| `content-planner` | Publishing pipeline for video, writing, or streams: ideas, hooks, structure, checklists. Neutral to platform. |
| `learning-path` | Structured curriculum for a topic with checkpoints and practice tasks. |
| `decision-record` | Architecture decision records: context, options, decision, consequences. |
| `redaction` | Strips personal or sensitive content from a document before sharing. Consumes the privacy preference list directly. |

### Tier 4: backlog, only if demand appears

Prompt library management, dataset documentation, accessibility audit, i18n string extraction, SQL query review, log analysis, incident postmortem, budget modeling, travel planning, recipe scaling, workout programming, reading list curation.

Do not build Tier 4 speculatively. A skill nobody uses still costs context in every session it sits in.

---

## 9. Testing and evaluation

Full detail goes in `docs/TESTING.md`.

For each skill:

1. Write two or three realistic test prompts before implementing. Save to `skills/<name>/evals/evals.json` with the prompt and a description of the expected result.
2. Add negative cases: prompts that should not trigger this skill.
3. Run each prompt twice, once with the skill available and once without, and compare. If the with skill output is not clearly better, the skill is not earning its place.
4. Write assertions only for objectively checkable properties (file produced, required sections present, format valid). Do not force assertions onto subjective qualities like tone; judge those by reading.
5. Record results per iteration so regressions are visible.
6. Rewrite the skill based on what failed, then rerun. Repeat until stable.

Generalize from failures. If a fix only helps the three test prompts, it is overfitting. When a problem is stubborn, try a different framing or metaphor in the skill rather than adding another constraint.

Also read the transcripts, not just the outputs. If the skill is making Claude waste steps, cut the part causing it and retest.

---

## 10. Build phases and gates

**Phase 0: decisions.** Claude Code asks the open questions in Section 18 and gets answers. No code yet.

**Phase 1: skeleton.** Repo layout, README, LICENSE, CONTRIBUTING, gitignore, CI stub. Gate: repo is browsable and CI runs green on an empty skill set.

**Phase 2: preferences system.** `docs/PREFERENCES.md`, `config/preferences.example.yaml`, `config/defaults.yaml`, `shared/preferences-loader.md`, and the `preferences-setup` skill. Gate: a fresh user can run setup, get a file, and see it read back correctly.

**Phase 3: first vertical slice.** Build `writing-assistant` end to end: spec, SKILL.md, references, evals, tests run, docs, packaged, installed, used. Gate: the same prompt produces visibly different output under two different preferences files. This is the proof the whole architecture works. Do not proceed until it does.

**Phase 4: authoring tooling.** `skill-scaffold`, `tools/new_skill`, `tools/validate_skills`, CI checks wired up. Gate: scaffolding a new skill produces something that passes validation with no manual fixes.

**Phase 5: Tier 2 build out.** One skill at a time, each fully complete before starting the next. Gate after every third skill: run the trigger map review from 6.5 and check for collisions.

**Phase 6: distribution.** Packaging, plugin manifest, install docs covering every path, a quickstart that works from a clean machine. Gate: someone who has never seen the repo installs it from the README alone.

**Phase 7: Tier 3, ongoing.** Same discipline. Add only what gets used.

---

## 11. Distribution and installation

Document every path in `docs/INSTALL.md`:

- Personal skills directory, for individual use across all projects
- Project skills directory, checked into a user's own repo for team use
- Packaged `.skill` bundles for individual skills
- Plugin marketplace bundle for installing the whole collection at once

Provide a way to install a subset. Nobody wants all thirty. A recommended starter set of three to five is more useful than an all or nothing install.

State clearly, per skill, whether it requires any tool or dependency beyond a plain Claude session.

---

## 12. CI and quality gates

Automate in `.github/workflows/`:

- Frontmatter validation: `name` present and matching the directory, `description` present and within a sane length
- Line count check: warn over 400 lines in a SKILL.md, fail over 600
- Link checking: every reference file cited in a SKILL.md exists, no dead relative paths
- Secret scanning: fail on anything resembling a key, token, or credential
- Personal data scan: fail if the local preferences filename pattern is committed, and flag committed files containing email addresses, IP addresses, or absolute home directory paths
- Evals presence: every skill has an `evals/evals.json` with at least two prompts including one negative
- Markdown lint with a shared config

---

## 13. Documentation

- **README**: what this is, the five second pitch, quickstart, the starter set, link to full catalog. Keep it short; the README is the only doc most people will read.
- **Catalog page**: table of every skill, one line each, with links.
- **AUTHORING.md**: Section 6 of this plan, expanded, plus the trigger map.
- **PREFERENCES.md**: the full schema, resolution order, precedence, and the hard limits from 5.5.
- **INSTALL.md**: all install paths.
- **TESTING.md**: how to run evals and what good looks like.
- **CONTRIBUTING.md**: the per skill spec template, the review bar, how to propose a new skill, and an explicit statement that new skills need a demonstrated use case, not just an idea.

---

## 14. Community and legal

- Permissive license (MIT or Apache 2.0). Pick one and be consistent.
- Code of conduct.
- Issue templates: bug, new skill proposal, skill improvement.
- PR template with a checklist mapping to Section 12.
- A clear statement that contributed skills must not contain personal data, and that PRs will be checked for it.

---

## 15. Privacy and security review

Before the repo goes public, and before every release:

- Grep the entire history, not just the working tree, for emails, real names, IP addresses, hostnames, absolute home paths, and API keys. History rewrites are painful later; do this before the first public push.
- Confirm every example in every skill uses obvious placeholders.
- Confirm no script makes an undocumented network call.
- Confirm the preferences file is gitignored and the CI check for it actually fails when tested.
- Review each skill against the question: would a user be surprised by anything this does, given only its description?

---

## 16. Versioning and releases

- Semantic versioning at the collection level. Individual skills carry an optional `version` in frontmatter.
- CHANGELOG entries grouped as Added, Changed, Fixed, Removed.
- Breaking change definition: any change to the preferences schema, or any change that alters a skill's output format in a way that would surprise an existing user.
- Deprecation path: mark a skill deprecated in its description for one release before removal.

---

## 17. Anti patterns to avoid

- **Skill sprawl.** Thirty mediocre skills is worse than eight good ones, because they collide in triggering and cost context.
- **Wrapper skills.** A skill that only tells Claude to use a tool it already has is noise.
- **Preferences creep.** Every key added is a key every skill has to consider. Add one only when at least two skills would consume it.
- **Overfitting to test prompts.** If the fix only works on the examples, it is not a fix.
- **MUST stacking.** When a skill misbehaves, the reflex is to add a rule. Usually the better move is to explain the reasoning or cut the part causing the problem.
- **Personalization leaking back in.** Watch for it in examples especially. An example email addressed to a real person is a leak.
- **Untested merges.** No skill ships without evals run and results recorded.
- **Docs written last.** They will not get written. Write the per skill README before the SKILL.md.

---

## 18. Open questions for the maintainer

Claude Code should ask these before Phase 1 and not proceed without answers:

1. Repo name and owner handle for URLs and install instructions?
2. License: MIT or Apache 2.0?
3. Preferences file format: YAML as proposed, or plain markdown with sections?
4. Preferences filename and global location: confirm `~/.claude/skills-preferences.yaml` or specify another.
5. Which Tier 2 skills are actually wanted, and in what order? The list in Section 8 is a menu, not a mandate.
6. Should the collection ship as a plugin bundle from day one, or start with individual skill installs only?
7. What language should tooling scripts be written in, given the target audience needs to run them with minimal setup?
8. Is there an existing skill collection this should stay compatible with or avoid duplicating?
9. Target audience: developers primarily, general knowledge workers, or both? This changes description vocabulary significantly.
10. Contribution policy: open to outside PRs from the start, or personal project with issues open?
