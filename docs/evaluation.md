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
