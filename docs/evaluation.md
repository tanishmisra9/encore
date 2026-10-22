# Evaluation protocol

Encore has two modes:

| Mode | Candidate source | Ranking signal | Result label |
| --- | --- | --- | --- |
| Provisional | Fictional fixtures during the hosted demo, or OpenStreetMap during local development | Supplied tags plus optional OpenAI reasoning | `PROVISIONAL DEMO` |
| Qloo | Qloo `/search` and `/v2/insights` | Artist affinity, bounded by venue radius | `QLOO-POWERED` |

## Fixed scenarios

Run every scenario in both modes after Qloo access is available.

| Artist | Venue | Group statements | Constraint change |
| --- | --- | --- | --- |
| The Marías | Brooklyn Steel | “I prefer quiet cafés”; “I want late night food” | Under $20 per person |
| The National | The Fillmore Philadelphia | “I love conversation”; “I prefer a drink” | Radius 1 km |
| Kaytranada | The Salt Shed | “I want somewhere lively”; “I need food” | Quiet place after 11 p.m. |

## Judging procedure

Give three blinded reviewers the artist, venue, stated preferences, and the two three-place lists in randomized order. Each reviewer chooses the list that best fits the group and records a one-sentence reason. Record ties and failures. Do not count a place as open, bookable, or within budget unless that fact is independently verified.

Report the number of completed comparisons, the winner count for each source, ties, and every mismatch. The repository does not claim a Qloo lift until this procedure is completed with the issued key.

## Deterministic checks

`npm test` checks that distance and budget constraints survive ranking, votes are constrained to one current vote per member, Discord signatures reject tampering, raw chat content is discarded after extraction, and the Qloo path never falls back to provisional data after a Qloo failure.
