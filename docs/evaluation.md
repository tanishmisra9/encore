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

Metric: **members bridged per place**. Each stated taste is resolved to a Qloo tag; a place bridges a member when it carries that tag. The same function scores both lists, so the baseline is not handicapped by a different yardstick. The count is a floor, because a place can fit a taste without carrying the exact tag.

| Scenario (group size) | Qloo bridged per place | Baseline bridged per place | In radius | Places shared | Latency |
| --- | --- | --- | --- | --- | --- |
| Williamsburg night out (3) | 1.00 | 0.00 | yes | 0 of 3 | 704 ms |
| Visiting friends, wine and music (2) | 0.00 | 0.00 | yes | 1 of 3 | 1923 ms |
| Team after work, casual (2) | 0.00 | 0.00 | yes | 0 of 3 | 366 ms |

What this shows: in 1 of 3 scenarios Qloo's list bridges members and the popularity list bridges none; in all 3 the shortlist differs from the baseline and stays inside the radius. What it does not show: a general quality lift. Two of three scenarios score zero for both lists, so the metric cannot separate them there, and no place bridged two members at once. Known misses: "thoughtful wine" and "casual food" resolve to broad Qloo tags that few places carry verbatim, and a hotel can still appear in a night-out list. The blind review above is still required before claiming improvement.

## Iteration log

| Change | Effect |
| --- | --- |
| Tag lookup used `query=`, which Qloo rejects | Every real request failed until `filter.query` |
| Prefer place tags (cuisine, ambience, offerings) over music or occupation tags | Night-out list moved from a wedding venue and a pier to bars and a parkhouse |
| Fall back from the full phrase to its last word when no tag matches | "thoughtful wine" resolves to "wine" |
| Budget filter dropped places with unknown price | Every Qloo place has an unknown price, so a stated budget emptied the list; unknown price now passes and is labeled |
| Rank by members bridged, then Qloo order | Each pick states who it fits and through which tag |
