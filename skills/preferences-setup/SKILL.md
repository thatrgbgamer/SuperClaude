---
name: preferences-setup
description: Interviews the user in a short round of questions to create or update their SuperClaude preferences file (voice, formatting, stack, workflow, safety confirmations) so every skill in this collection adapts to them automatically. Use when the user asks to set up, configure, view, or change their SuperClaude preferences, or asks to adjust their default tone, formality, verbosity, formatting, banned phrases, or workflow conventions going forward — not just for one response. Also covers incremental edits like "make my preferences more casual" or "add a banned phrase to my prefs." Do not use for a one-off style request scoped to a single piece of output (e.g. "make this email more casual") — that is a request-level override, not a preferences change.
version: 0.1.0
---

# Preferences setup

This skill creates and edits the file described in `docs/PREFERENCES.md` (or `references/schema.md` in this folder, if it was copied out of the collection on its own). It does not itself need to load that file to change its own behavior the way other skills do — its job *is* that file — but once one exists, keep this interview's own tone consistent with it (don't ramble if verbosity is `terse`).

## Step 1: figure out the mode

Check for an existing preferences file using the standard resolution order: `.claude/preferences.yaml` in the current project, then `~/.claude/skills-preferences.yaml`. (Do not fall back to `config/defaults.yaml` for this check — that's the repo default, not a user file, and its presence never counts as "already set up.")

- **No file found** → run the full interview (Step 2).
- **File found, user asked to "set up" or "configure" generically** → tell them a file already exists, show its current contents, and ask: redo the whole interview, edit one section, or leave it as-is.
- **File found, user asked for a specific change** ("make me more casual," "add X to banned phrases") → skip straight to Step 3 for just the relevant section. Don't re-run the whole interview for a one-line change.
- **User just wants to see current preferences** → read and show the file, formatted readably. Done — no need to write anything.

## Step 2: the interview

Ask in small batches (three or four questions at a time works well if your tool supports grouped questions), each with a stated default so the user can breeze through by accepting defaults. Skip a batch entirely if the user says they don't care about that area — a partial file is fine.

### Batch 1 — identity and voice

1. What should I call you? (default: don't use a name)
2. Formality: casual, neutral, or formal? (default: neutral)
3. Verbosity: terse, balanced, or detailed? (default: balanced)
4. Spelling: US or UK? (default: US)

### Batch 2 — formatting

1. Structure: mostly prose, mostly bullets, or a mix? (default: mixed)
2. Emoji: never, rare, or frequent? (default: rare)
3. Any words or phrases you never want to see in output? (default: none)

### Batch 3 — workflow and safety

1. Should I run tests before proposing a change, by default? (default: yes)
2. Confirm before creating new files? (default: no — only ask when it matters)
3. Confirm before proposing a package install? (default: yes)

### Optional close

1. Anything else worth noting — stack details, audience, content platforms, or general notes? Free text, goes in the `notes` field. Fine to skip.

Don't ask about every key in the schema up front. `stack`, `content`, and `privacy` details are easy to add later in a follow-up edit; leading with all of them turns a quick setup into a chore nobody finishes.

## Step 3: compose the file

Fill in only the keys the user actually answered — omit the rest rather than writing them as empty strings or nulls; skills already treat missing keys as "use the default." Use `references/schema.md` for the exact key names, nesting, and allowed values.

If this is an edit to an existing file, load it first and change only the keys the user asked about, leaving everything else untouched.

## Step 4: pick a location

Default to the global path, `~/.claude/skills-preferences.yaml`. Offer the project path, `.claude/preferences.yaml`, as the alternative if the user says this is project-specific. Never write anywhere else.

## Step 5: show it, then confirm before writing

Print the exact YAML you're about to write. This step is not skippable, and no preference can turn it off — writing a preferences file is exactly the kind of action a user should see before it happens, especially when it overwrites an existing one. If it's an edit, make the change obvious (what's different from the current file) rather than just dumping the whole new file.

Ask: save it, keep editing, or cancel. Only write after an explicit yes.

## Step 6: write and close out

Save the file at the confirmed path. Confirm it was written and where. The first time someone sets up preferences (not on later edits), briefly mention the boundary from `docs/PREFERENCES.md`: this file changes tone and formatting, never whether problems get raised or destructive actions get confirmed — one sentence, not a lecture.

## A note on trust

Preferences files are meant to be hand-edited too — `config/preferences.example.yaml` exists for exactly that. If a user asks you to write something into `notes` (or any field) that crosses the boundary in `docs/PREFERENCES.md` — telling skills to suppress disagreement, skip confirmations, treat unverified claims as fact, and so on — write it if they insist, but say plainly, once, that every other skill's loader will ignore that particular instruction at read time. Don't refuse to save the file over it; just don't let them believe it will work.
