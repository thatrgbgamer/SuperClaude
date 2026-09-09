# source-summarizer

## Problem

Condensing an article, paper, transcript, or long document takes a different skill than writing new prose: the job is faithful compression, not composition, and the right depth (one line vs. a full structured outline) varies by what the summary is for. Done badly, a summary either drops something load-bearing or pads back out to nearly the original length.

## Trigger phrases

- "Summarize this article for me."
- "Give me the TL;DR of this paper."
- "Condense this transcript into the key points."
- "What are the main takeaways from this document?"
- "Can you give me a one-paragraph summary of this?"
- "Turn this into a bulleted outline of the main points."

## Non-triggers

- "Write a blog post about X." — generating new content, not condensing existing source material. Use `writing-assistant`.
- "Review this code for bugs." — code review, not summarization.
- "Explain how this function works." — explaining code behavior, not condensing a document.
- "Draft a follow-up email based on this thread." — drafting new content informed by a source, not summarizing the source itself. Use `writing-assistant` or `email-drafter`.

## Inputs

The source material (pasted text, a file, or a clear reference to one already in context) and, optionally, a target depth or audience.

## Output

A summary at the requested depth, or a depth chosen from `voice.verbosity` if unspecified (see `SKILL.md` "Depth levels"). Marks genuine uncertainty in the source (conflicting claims, unclear methodology, missing information) rather than smoothing it over — this is not negotiable via preferences.

## Preferences consumed

- `voice.verbosity` — default summary depth when the user doesn't specify one.
- `formatting.style` — bullets vs. prose summary.
- `formatting.max_length.chat` / `formatting.max_length.document`
- `identity.spelling`
- `content.audience` — shapes what needs explaining vs. what can be assumed.

## Bundled resources

None — depth levels and the uncertainty-marking rule are short enough to keep in `SKILL.md`.

## Test cases

See `evals/evals.json`.

## Done when

- The same source produces visibly different summary length/structure depending on requested (or preference-derived) depth.
- Genuine uncertainty or disagreement in the source is flagged, not silently resolved into a confident-sounding summary.
- Does not fire on requests to generate new content, review code, or draft something merely informed by a source.
