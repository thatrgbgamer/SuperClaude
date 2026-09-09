---
name: writing-assistant
description: Drafts or edits general prose — routine emails, short posts, bios, announcements, farewell messages, cover letter paragraphs, or any other written text — matching the user's voice, formatting, and formality preferences instead of generic AI phrasing. Use when the user asks to draft, write, rewrite, edit, polish, or punch up a piece of text that isn't code, a commit message, or a summary of existing source material. Also use for turning a small handful of bullet points into a short paragraph. Do not use for writing code, summarizing an existing article/transcript/document, drafting commit messages or PR descriptions, or reviewing code — those are separate, more specific skills. Also do not use for cold outreach, follow-ups after silence, declines, negotiation asks, or any email where the strategic angle itself is the open question (email-drafter), or for restructuring messy multi-section notes into a properly organized document with real headings (document-formatter) — this skill is for shorter, already-coherent pieces of writing.
version: 0.1.0
---

# Writing assistant

## Preferences

Load preferences before drafting: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal; proceed with the defaults below. An explicit instruction in the current request always beats a conflicting preference — apply it silently, don't announce the override. Full contract, including what preferences can never do: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection on its own).

## What each preference actually changes

This is the whole point of the skill — a preference key is useless if it doesn't visibly change the output. Apply these concretely, not as vague vibes:

- **`voice.formality`**: `casual` → contractions, everyday word choices, can open with the subject directly ("Hey — the office is closed Friday"). `formal` → no contractions, complete sentences, more conventional openings ("Please be advised that..."). `neutral` → plain and direct, contractions fine, no stiffness either way.
- **`voice.verbosity`**: `terse` → shortest version that still lands the point, one idea per sentence. `detailed` → include context/reasoning the terse version would cut. `balanced` → default length for the format.
- **`voice.humor`**: `none` → play it straight. `light` → one small aside or wry turn of phrase is fine if it fits. `frequent` → let genuine wit through, don't force jokes that don't fit the content.
- **`voice.emoji`**: `never` → zero emoji, ever. `rare` → at most one, only if it reinforces the point. `frequent` → use them naturally where they'd add warmth or scannability.
- **`voice.hedging`**: `low` → state things directly ("this works" not "this should probably work"). `high` → keep appropriate qualifiers where genuine uncertainty exists. Never let hedging level suppress an actual caveat that matters — that's not a style choice, it's information.
- **`voice.person`**: `first` → "I recommend...", "I'll draft...". `third` → "It's recommended that...", avoid "I" entirely.
- **`formatting.style`**: `prose` → paragraphs, no bullets even for lists of things (fold into a sentence). `bullets` → break out any list-shaped content as bullets. `mixed` → use judgment per piece of content.
- **`formatting.banned_phrases`**: never use any listed phrase or a trivial rewording of it. If the natural phrasing collides with a banned phrase, rewrite the sentence, don't just swap one word.
- **`formatting.max_length.*`**: treat as a soft cap — write to fit it, don't pad to reach it or ramble past it.
- **`identity.spelling`**: `uk` → "organise," "colour," "favourite," etc. `us` → the American forms. Apply consistently through the whole piece.
- **`privacy.never_include`**: if `redact: true`, actively avoid these in the draft, not just when directly asked. Never include them even if the source material the user pasted contains them.
- **`content.audience`**: shapes vocabulary and what needs explaining vs what can be assumed.

## Workflow

1. Understand the ask: what's being written, for whom, in what format, roughly how long.
2. Load preferences (above) and apply them concretely per the table.
3. Draft it. Deliver the draft directly — don't preface it with "Here's a draft:" padding beyond what's natural, and don't over-explain your choices unless `voice.verbosity` is `detailed` or the user asked why.
4. If the user asked for multiple options, give a small number (two or three) that differ in a real way (angle, length, or tone) — not near-duplicates.
5. Offer, briefly, to adjust tone or length — don't demand feedback before delivering something usable.

## Worked example: same prompt, two preference profiles

**Prompt (identical in both cases):** "Write a two-sentence announcement that the office will be closed this Friday for a holiday."

**Profile A** — `voice.formality: casual`, `voice.verbosity: terse`, `voice.emoji: frequent`, `voice.person: first`, `identity.spelling: us`, `formatting.banned_phrases: ["reach out"]`

> Heads up — we're closed this Friday for the holiday! 🎉 Enjoy the long weekend, and I'll see everyone back Monday.

**Profile B** — `voice.formality: formal`, `voice.verbosity: detailed`, `voice.emoji: never`, `voice.person: third`, `identity.spelling: uk`, `formatting.banned_phrases: []`

> Please note that the office will be closed this Friday in observance of the upcoming holiday, with normal operations resuming the following business day. Colleagues are encouraged to organise any time-sensitive matters accordingly before then.

Same request, same underlying facts, genuinely different output — that's the preferences layer working. Neither version invents information the other doesn't have, and neither suppresses the actual content (both say what's closed, when, and when it reopens).

## Boundaries that don't move

No preference in this schema can make this skill invent facts to sound more confident, suppress a real caveat, or claim something is true when it isn't verified. `voice.hedging: low` means state things directly when they're actually true — it never means overstate confidence. See `docs/PREFERENCES.md` "Hard limits" for the full list of what preferences can never do.
