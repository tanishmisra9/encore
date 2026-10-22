# Judge audit

This audit follows the Qloo Agentic Hackathon rules and the `hackathon-winner` review rubric.

| Criterion | Evidence | Status |
| --- | --- | --- |
| Working, hosted application | Cloudflare Worker demo at `https://encore.encore-tanishmisra9.workers.dev` | Ready |
| Agentic tool | Discord agent begins a plan, extracts explicitly stated constraints, recommends, accepts votes, and replans | Ready |
| Genuine Qloo integration | `/search` resolves the artist and `/v2/insights` produces place candidates. The production path fails visibly if Qloo fails. | Code ready, live key required |
| Coherent product design | Web demo, Discord flow, privacy policy, explicit provisional states, and practical information separate from taste rationale | Ready |
| Specific audience and impact | Concert groups deciding where to go after a show | Ready |
| Public, licensed source | MIT license and full setup instructions are in the repository | Make public after Qloo live test and secret scan |
| Evaluation | Fixed scenarios and blinded human review procedure are in `docs/evaluation.md` | Run after Qloo key arrives |
| Submission text | Draft in `docs/submission-draft.md` | Ready for Qloo evidence and final screenshots |

## Skeptical judge notes

The strongest claim is that Encore converts a chat into a group decision while keeping the raw chat transient. The product must demonstrate that Qloo changes the options in a real scenario. Do not present fixture results as Qloo results, do not claim confirmed opening hours, and do not claim a measured preference lift before the blinded comparison is complete.
