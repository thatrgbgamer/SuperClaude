---
name: email-drafter
description: Drafts strategic emails — cold outreach, follow-ups after silence, declines, negotiation asks, relationship-sensitive requests — as two or three genuinely different variants by angle, not one take. Use when the recipient relationship, stakes, or desired outcome make the *approach* itself a real choice (how direct, how warm, how much context to give), or when the user explicitly asks for a few options for an email. Do not use for a routine, single-purpose email with no real strategic angle to weigh (e.g. "email my team the server's down") — that belongs to writing-assistant, which drafts a single clean version instead.
version: 0.1.0
---

# Email drafter

## Preferences

Load preferences before drafting: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal; proceed with sensible defaults. An explicit instruction in the request always beats a conflicting preference, applied silently. Full contract: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection). See `writing-assistant`'s SKILL.md for the concrete voice/formatting-to-behavior mapping — it applies here identically; this file only adds what's specific to strategic email drafting.

## Step 1: is this actually a strategic choice?

If there's genuinely one right approach (an already-final decline, a purely informational note), say so and give one strong draft — padding it into three interchangeable variants wastes the user's time and defeats the point of this skill. Reserve multiple variants for when the angle itself is the open question: how direct, how much to lead with the ask vs. the relationship, how much context to volunteer.

## Step 2: draft two or three real variants

Each variant should differ in a way that would change how the recipient reads it — not just swapped synonyms. Useful axes to vary across variants:

- **Directness**: leads with the ask vs. leads with context/relationship-building first.
- **Warmth**: brief and efficient vs. more personal and detailed.
- **Framing of the ask**: as a request vs. as an offer/opportunity for the recipient.

Label each variant with its angle in a few words, and add one line on when it fits best (e.g. "Use this one if you've interacted with them before and can be direct" vs. "Use this one for a cold first contact"). Apply loaded voice/formatting preferences to *all* variants equally — preferences shape tone, not which angle to offer.

## Step 3: respect the stakes

For a decline, negotiation, or anything where the wrong tone has real relationship cost, don't let `voice.hedging: low` turn into false confidence about how the recipient will react — state the email's content directly, but don't claim to know how it'll land. That's not a style choice; overclaiming certainty about another person's reaction is exactly the kind of thing preferences can't paper over (see `docs/PREFERENCES.md` "Hard limits").

## Worked example

**Prompt:** "Write a cold outreach email to a potential mentor in my field — we've never spoken."

**Variant 1 — Direct ask** (best for someone who gets a lot of cold outreach and will appreciate brevity):

> Subject: Quick question from someone early in [field]
>
> Hi [Name], I've followed your work on [specific thing] for a while and would value 15 minutes of your time to ask about [specific question]. No pressure if you're not able to — happy to work around your schedule.

**Variant 2 — Warm, context-first** (best if there's a shared connection or specific reason you're reaching out to *them*):

> Subject: Inspired by your work on [specific thing]
>
> Hi [Name], I'm [brief context on who you are and why their work resonated]. I'd love to hear how you approached [specific aspect] — would you be open to a short call sometime in the next few weeks?

Same underlying ask, genuinely different approach — the user picks based on what they know about the recipient.

## Non-triggers, restated

A routine email with no real angle to choose is `writing-assistant`'s job, not this skill's — don't manufacture three variants of "the office is closed Friday."
