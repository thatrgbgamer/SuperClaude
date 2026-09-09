# email-drafter

## Problem

Strategic emails — cold outreach, following up after silence, declining something, negotiating — depend heavily on angle and tone, and there usually isn't one obviously-right version. A single generic draft, which is the right output for a routine email, actively underserves this: the value is in seeing two or three real options and picking one, not in getting talked into an angle by default.

## Trigger phrases

- "Write a cold outreach email to a potential mentor I've never met."
- "Draft a follow-up email — they haven't replied to my last one in two weeks."
- "Help me write an email declining a job offer."
- "I need to email a client to push back on scope creep without burning the relationship."
- "Can you give me a couple of options for a networking email to someone I met briefly at a conference?"
- "Write an email negotiating a later deadline."

## Non-triggers

- "Email my team that the server will be down for an hour tonight." — routine, single-purpose, no real strategic angle to choose between. Use `writing-assistant`.
- "Rewrite this email to sound more formal." — editing existing text, not choosing an outreach strategy. Use `writing-assistant`.
- "Summarize this email thread." — condensing existing content, not drafting. Use `source-summarizer`.
- "Write a thank-you note to my aunt for the gift." — personal, not professional/strategic outreach. Use `writing-assistant`.

## Inputs

The situation: who the recipient is, the relationship (or lack of one), what outcome is wanted, and any constraints (deadline, prior contact, sensitivities).

## Output

Two or three real variants, each labeled with the angle it takes (e.g. "Direct ask," "Warm, relationship-first," "Brief, low-pressure") and a one-line note on when that angle fits best — not near-duplicates with swapped adjectives. If the situation only has one sensible angle (e.g. a decline that's already fully decided), say so and give one polished draft, offering to generate alternates if useful.

## Preferences consumed

- `voice.formality`, `voice.verbosity`, `voice.humor`, `voice.emoji`, `voice.hedging`, `voice.person`
- `formatting.banned_phrases`, `formatting.max_length.chat`
- `identity.spelling`
- `privacy.never_include`, `privacy.redact`
- `content.audience`

## Bundled resources

None — the variant-generation logic is short enough to keep in `SKILL.md`.

## Test cases

See `evals/evals.json`. Includes the boundary against `writing-assistant` explicitly (a routine email should NOT trigger this skill).

## Done when

- A cold-outreach or high-stakes request produces genuinely different variants (different opening, different level of directness), not the same email reworded.
- A routine, single-purpose email request does not fire this skill.
- Preferences visibly shape tone/length/spelling the same way they do in `writing-assistant`.
