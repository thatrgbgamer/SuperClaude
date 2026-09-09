# research-brief

## Problem

Open-ended research questions ("what's the current state of X," "compare A and B") invite a single confident-sounding answer stitched together from whatever's easiest to find — which quietly launders source quality and disagreement into false certainty. A real research brief needs to show its work: what sources say, how much to trust them, where they agree, and where the question is genuinely still open.

## Trigger phrases

- "Research the current landscape for X and give me a brief."
- "What's the consensus on Y? Include sources."
- "Put together a research brief comparing these two approaches, with citations."
- "Find out what's actually known about Z — I want to see where the sources disagree."
- "Give me a sourced overview of the current state of this topic."

## Non-triggers

- "What's 2+2?" or any question with a settled, immediate answer — no research brief needed.
- "Summarize this specific article for me." — a single given source, not open research across multiple ones; use `source-summarizer`.
- "What's your opinion on X?" — not a request for sourced research.
- "Look up the syntax for this function." — a quick factual lookup, not a research brief.

## Inputs

A research question or comparison, and optionally a stated audience or depth.

## Output

See `SKILL.md` "Output format": the question restated, findings grouped by theme with a confidence label per finding (established / likely / disputed / unclear) and its source, explicit separation of consensus vs. disagreement, a stated list of remaining gaps, and a source list.

## Preferences consumed

- `content.audience` — vocabulary and what needs explaining.
- `voice.hedging` — how qualifiers are phrased; never used to suppress a genuine confidence gap (see hard limits).
- `formatting.style`, `formatting.tables` — comparison tables when comparing options across the same attributes.
- `identity.spelling`

## Bundled resources

None — the output template is short enough to keep in `SKILL.md`.

## Test cases

See `evals/evals.json`.

## Done when

- Every non-trivial finding carries a confidence label and a source.
- Genuine disagreement between sources is shown as disagreement, not resolved into one confident-sounding claim.
- Remaining gaps/unknowns are stated explicitly rather than papered over to make the brief feel more complete than the research actually was.
