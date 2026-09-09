# document-formatter

## Problem

Rough notes — a stream-of-consciousness brain dump, disorganized meeting scribbles, a pile of half-formed sections — need real structural work to become a document someone else could actually read: grouping related points, choosing section boundaries, picking a heading depth, deciding what's a table vs. a list vs. prose. That's a different job from drafting a short piece of prose from a clean brief, and a different job from condensing an already-polished source.

## Trigger phrases

- "Turn my messy meeting notes into a well-organized document with sections for decisions, action items, and open questions."
- "Clean up this document — it's got the right content but no real structure."
- "Organize these scattered notes into a proper report."
- "Reformat this doc to match our usual heading style."
- "I have a bunch of half-written sections — can you turn this into one coherent document?"

## Non-triggers

- "Turn these three bullet points into a short paragraph." — small enough to stay one paragraph of prose; use `writing-assistant`.
- "Summarize this article." — condensing existing polished source material, not restructuring rough notes; use `source-summarizer`.
- "Write a bio for my website." — drafting new short-form prose from a brief, not restructuring existing rough material; use `writing-assistant`.
- "Create a Word document with a table of contents and page numbers." — a specific file format's features are the `docx` skill's job; this skill produces well-structured content, not a `.docx` file.

## Inputs

Rough, disorganized, or partially-written material — notes, a stream of half-sections, a document that has content but no coherent structure.

## Output

A clean, well-organized document in Markdown/plain text: sensible section boundaries and headings, lists vs. tables vs. prose chosen per content shape, respecting `formatting.heading_depth`, `formatting.style`, and `formatting.tables`. Does not invent content that wasn't in the source material or reasonably implied by it.

## Preferences consumed

- `formatting.heading_depth`, `formatting.style`, `formatting.tables`, `formatting.banned_phrases`, `formatting.max_length.document`
- `voice.verbosity` — how much to trim vs. preserve nuance from the rough source.
- `identity.spelling`
- `content.audience`

## Bundled resources

None — the restructuring guidance is short enough to keep in `SKILL.md`.

## Test cases

See `evals/evals.json`. Includes the boundary against `writing-assistant` (small note-to-paragraph turns stay there) and `docx` (file-format production stays there).

## Done when

- Messy, multi-topic notes come back with real structure (sections, consistent heading depth) rather than just tidier bullet formatting.
- A small "turn these bullets into a paragraph" request does not fire this skill.
- No invented content — everything in the output traces back to the source material.
