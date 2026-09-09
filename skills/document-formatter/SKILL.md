---
name: document-formatter
description: Restructures rough, disorganized notes or partially-written material into a clean, well-organized document — choosing section boundaries, heading depth, and where lists/tables/prose fit best. Use when the user has messy notes, scattered sections, or content with no coherent structure and wants a properly organized document out of it. Do not use for a small bullets-to-one-paragraph turn (writing-assistant), for condensing an already-polished source (source-summarizer), or for producing a specific file format like .docx with page numbers/TOC (the docx skill) — this skill structures content, it doesn't produce a file format.
version: 0.1.0
---

# Document formatter

## Preferences

Load preferences before restructuring: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal; use sensible defaults (moderate heading depth, mixed style). Full contract: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection).

## Step 1: find the actual structure

Read through everything first. Group related points regardless of where they appear in the source — rough notes rarely arrive in a sensible order. Identify natural sections (e.g. decisions vs. open questions vs. action items) before writing any headings.

## Step 2: apply formatting preferences concretely

- `formatting.heading_depth: shallow` → two levels at most (H1 sections, maybe H2 subsections). `deep` → nest further when the content actually has that much hierarchy — don't force depth that isn't there.
- `formatting.style: bullets` → prefer lists wherever content is list-shaped, even within a section that also has some prose. `prose` → fold list-shaped content into flowing paragraphs where it doesn't lose clarity (a genuine step-by-step procedure stays a list regardless — clarity beats the preference here). `mixed` → use judgment per section.
- `formatting.tables` → use a table when comparing multiple items across the same attributes; don't force a table for a simple list.
- Respect `formatting.banned_phrases` throughout.

## Step 3: don't invent content

Every claim in the output should trace back to the source material. If the source is ambiguous or contradicts itself, note that in the document (e.g. "Open question: the notes mention two different dates for this — needs confirmation") rather than picking one silently. This isn't a style choice — see `docs/PREFERENCES.md` "Hard limits" on not treating unverified claims as established.

## Worked example

**Input (rough notes):** "meeting today - decided to launch the beta march 1st. sarah's on the fence about pricing still need to figure that out. also need someone to own the migration doc. ravi said he'd do it but not confirmed. don't forget we need signoff from legal before launch"

**Output:**

```markdown
## Decisions
- Beta launch date: March 1st

## Open Questions
- Pricing — not yet resolved
- Legal signoff — required before launch, not yet obtained

## Action Items
- Own the migration doc — tentatively Ravi, not yet confirmed
```

Nothing here was invented; the grouping and headings are the restructuring work.
