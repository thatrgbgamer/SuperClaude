# writing-assistant

## Problem

General-purpose drafting and editing — emails, short posts, bios, farewell notes, cover paragraphs, announcements — tends to come out sounding like generic AI prose: uniformly hedged, uniformly formal-ish, the same regardless of who's asking or what they'll actually send it as. Without a preferences layer, matching someone's actual voice means re-explaining it in every single prompt.

## Trigger phrases

- "Draft an email to my landlord about the leaking faucet."
- "Write a short bio for my website."
- "Rewrite this paragraph to sound more professional."
- "Help me write a farewell message to my team."
- "Polish this draft before I send it."
- "Write a two-sentence announcement that the office is closed Friday."
- "Can you punch up this cover letter opening?"
- "Turn these bullet points into a short paragraph."

## Non-triggers

- "Write a Python function that sorts a list." — code, not prose.
- "Summarize this article for me." — condensing existing source material is a different job (`source-summarizer`), not drafting new content.
- "Write a commit message for these changes." — a specific, convention-driven format (future `commit-and-pr`).
- "Review this code for bugs." — code review, not writing.
- "What's the weather like today?" — not a writing/drafting task at all.
- "Write a cold outreach email to someone I've never met." — the strategic angle is the open question here; that's `email-drafter`, which produces multiple angled variants.

## Inputs

A description of what to write, or existing text to edit/rewrite. Optionally: a target format (email, post, bio, message), audience, and length.

## Output

The drafted or edited text itself, formatted per the user's preferences (or repo defaults). No unrequested meta-commentary — deliver the draft, then briefly offer to adjust tone/length if that seems useful. On request, produce a small number of variants (e.g. "give me two versions") rather than one take.

## Preferences consumed

- `voice.formality`, `voice.verbosity`, `voice.humor`, `voice.emoji`, `voice.hedging`, `voice.person` — the core of what makes output sound like the user, not generic.
- `formatting.style`, `formatting.heading_depth`, `formatting.tables`, `formatting.banned_phrases`, `formatting.max_length.*`
- `identity.spelling` — US vs UK spelling in the draft.
- `privacy.never_include`, `privacy.redact`, `privacy.placeholders_for_names_locations`
- `content.audience`, `content.platforms`, `content.brand_voice_file`

## Bundled resources

None beyond `SKILL.md` for this first version — the mapping from preference values to writing choices is short enough to keep inline. If this grows to cover many distinct formats with format-specific conventions, split `references/` by format at that point (see `docs/AUTHORING.md`).

## Test cases

See `evals/evals.json`. Includes ordinary positive/negative trigger cases, and one explicit `preference-divergence` case: the same prompt run under two different preference profiles, with the expected output shown for each, to prove the preferences layer actually changes the result.

## Done when

- The same prompt produces visibly different output under two different preferences files (the Phase 3 proof).
- An explicit in-request instruction ("make this one formal") overrides a conflicting preference, silently.
- `formatting.banned_phrases` and `privacy.never_include` are actually honored in the draft, not just acknowledged.
- No preferences file present → skill still works, using `config/defaults.yaml`.
