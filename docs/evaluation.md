# Evaluation protocol

## Question

Does Qloo produce a more culturally coherent local compromise than the same planner with generic ranking?

## Modes

| Mode | Candidate source | Label |
| --- | --- | --- |
| Qloo | `/search`, `/v2/tags`, and `/v2/insights` | `QLOO-POWERED` |
| Baseline | Identical constraints with generic ranking | `BASELINE` |

Production Encore does not use the baseline. It displays unavailable or clarification states when Qloo cannot produce candidates.

## Fixed scenarios

| Request | Explicit signals | Revision |
| --- | --- | --- |
| What should we do in Williamsburg tonight? | quiet jazz, late-night food, a real night out | quieter, under $35 |
| Where should our visiting friends go nearby? | thoughtful wine, conversation, local music | within 1 km |
| What should the team do after work? | casual food, low noise, no expensive cocktails | under $30 |

## Blind review

For each completed scenario, show three blinded reviewers the request, explicit signals, constraints, and randomized Qloo and baseline shortlists. Each reviewer selects the list that best fits the group and records a sentence explaining why.

Report reviewer count, scenario count, Qloo wins, baseline wins, ties, latency, unresolved requests, and every mismatch. Do not claim improvement until these results exist.

## Deterministic checks

`npm test` verifies context limits, raw-chat exclusion, location follow-up, Qloo tag and entity use, constraint filtering, vote validity, revision behavior, and failure without a production fallback.

## Results: automated run (2026-10-22, `node --import tsx scripts/eval.mts`)

Baseline = the same Qloo Insights call with the same location, radius and distance filter but no taste signals (popularity ranking). Qloo's terms ask that response data not be stored in a public repository, so this table keeps aggregates only. Rerun the script with your own key to see the shortlists.

| Scenario | In radius | Places shared with baseline | Latency |
| --- | --- | --- | --- |
| Williamsburg night out | yes | 1 of 3 | 687 ms |
| Visiting friends, wine and music | yes | 1 of 3 | 524 ms |
| Team after work, casual (Lower Manhattan) | yes | 0 of 3 | 654 ms |

What this shows: taste signals change the shortlist in 3 of 3 scenarios and every result is inside the radius. In the casual-food scenario the baseline returned landmarks and the Qloo list returned cafés. What it does not show: a quality lift. The tag-keyword hit rate I tried scored 100% for both modes, so it cannot discriminate and is not reported as evidence. Misses: a venue tagged for weddings ranked first for a jazz and late-night request, and two results were weak fits for wine and music. The blind review above is still required before claiming improvement.
