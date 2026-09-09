---
name: source-summarizer
description: Condenses an existing article, paper, transcript, or long document into a summary at a configurable depth, from one paragraph to a detailed structured outline. Use when the user asks to summarize, condense, give the TL;DR of, or extract the main takeaways from a piece of existing source material. Do not use for generating new content from scratch (writing-assistant), reviewing or explaining code, or drafting something merely informed by a source rather than summarizing the source itself.
version: 0.1.0
---

# Source summarizer

## Preferences

Load preferences before summarizing: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal; default to the `balanced` depth below. An explicit instruction in the request always beats a conflicting preference. Full contract: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection).

## Depth levels

If the user states a depth, use it. Otherwise, derive a default from `voice.verbosity`:

- **One-line** (`terse` maps here if the source is short, or on explicit request): a single sentence capturing the core point.
- **One-paragraph** (`terse` default for longer sources, or on explicit request): three to five sentences — the core point plus the one or two facts that matter most.
- **Balanced outline** (`balanced` default): a short paragraph plus three to six bullets covering the main points, in the source's own order or grouped by theme if that reads better.
- **Detailed outline** (`detailed` default, or on explicit request): full structured breakdown — sections mirroring the source's own structure where it has one, with supporting detail under each, plus a short "why this matters" or "key takeaway" line at the top.

Match `formatting.style` for whether the non-"one-line" levels lean toward prose or bullets when both would work.

## Rules that don't bend with depth

- Never drop a caveat, limitation, or piece of conflicting information from the source to make the summary read cleaner — compress it, don't smooth it away. If the source hedges or disagrees with itself, say so, even at the shortest depth ("note: the article is uncertain about X").
- Don't add information, context, or interpretation the source doesn't contain. If you're inferring something the source implies but doesn't state, say that explicitly.
- If the source is long enough that you're working from a partial read, say so rather than presenting the summary as covering the whole thing.

## Worked example

**Source (excerpt):** A product update post announcing a new feature, noting early users reported both strong satisfaction and a recurring complaint about a specific edge case, with the team saying a fix is planned but undated.

**One-paragraph summary:** The team launched [feature]. Early feedback is largely positive, though users have repeatedly flagged an issue with [edge case]; a fix is planned but has no committed date.

**Detailed outline:**

- **What shipped**: [feature], launched [when, if stated].
- **Reception**: largely positive early feedback.
- **Known issue**: recurring complaints about [edge case] — not yet resolved.
- **Fix status**: planned, no committed timeline as of this post.

Both versions keep the unresolved issue and undated fix — a summary that dropped either to sound more polished would misrepresent the source.
