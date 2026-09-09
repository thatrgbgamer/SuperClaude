---
name: research-brief
description: Produces a sourced research brief on an open-ended question or comparison — findings grouped by theme, each labeled with a confidence level and source, consensus separated explicitly from disagreement, and remaining gaps stated plainly. Use when the user asks to research a topic, wants a sourced overview or comparison, or explicitly wants to see where sources agree or disagree. Do not use for a question with a settled, immediate answer, for summarizing one specific given source (source-summarizer), for a quick factual lookup, or for a request for opinion rather than sourced findings.
version: 0.1.0
---

# Research brief

## Preferences

Load preferences before researching: check `.claude/preferences.yaml` (project), then `~/.claude/skills-preferences.yaml` (global), then `config/defaults.yaml` (repo fallback) — use the first one found. None found is normal. Full contract: `shared/preferences-loader.md` (or `docs/PREFERENCES.md` if this skill was copied out of the collection).

## The rule this skill exists to enforce

A research brief is only useful if its confidence is calibrated to the actual state of the sources. Never let `voice.hedging: low` compress "sources disagree" or "this is genuinely unclear" into a single confident claim — that's not a style choice, it's misrepresenting what was found. See `docs/PREFERENCES.md` "Hard limits": preferences change how something is said, never whether a real uncertainty gets raised.

## Workflow

1. Break the question into the sub-questions that actually need answering.
2. Gather sources for each — prefer primary sources and recent, specific ones over vague secondary summaries. Note where a claim comes from a single source vs. multiple independent ones.
3. For each finding, assign a confidence label:
   - **Established**: multiple independent, credible sources agree, and there's no significant contrary evidence.
   - **Likely**: good evidence, but from limited sources or with some caveats.
   - **Disputed**: credible sources meaningfully disagree.
   - **Unclear**: insufficient or low-quality evidence either way.
4. Separate consensus from disagreement explicitly in the output — don't bury a "disputed" finding inside prose that reads as settled.
5. State what's still unknown or unanswered by the available sources, rather than stretching what was found to cover the whole question.

## Output format

```text
Question: <restated>

Findings
- <finding> — [established/likely/disputed/unclear] (source: <source>)
- <finding> — [established/likely/disputed/unclear] (source: <source>)

Where sources agree
- <consensus point(s)>

Where sources disagree
- <the actual disagreement, naming which sources take which position>

Still unclear / not covered by available sources
- <gaps>

Sources
- <list>
```

Use a comparison table instead of the findings list when comparing multiple options across the same set of attributes and `formatting.tables` doesn't disfavor it.

## What this skill will not do

It will not present a single source's claim as consensus, will not omit a source that contradicts the headline finding, and will not fill a genuine gap with a plausible-sounding guess presented as a finding.
