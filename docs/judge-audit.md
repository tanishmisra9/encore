# Judge audit

| Criterion | Evidence | Release condition |
| --- | --- | --- |
| Working application | Hosted homepage, `/demo.html`, and Discord interaction endpoint | Qloo-enabled live test |
| Agentic tool | Natural request, optional context, recommendation, vote, and replan loop | Fresh-user Discord test |
| Qloo implementation | Entity search, tag lookup, and place Insights form the recommendation path | Captured production trace |
| Product design | Silent replay, focused demo, privacy disclosure, and square editorial UI | Browser test on desktop and mobile |
| Impact and originality | Groups resolve competing cultural tastes into a local decision | Blind comparison results |
| Public source | MIT license, setup instructions, architecture, and evaluation protocol | Secret scan and public release |

## Skeptical judge checks

- Removing Qloo must remove culturally grounded recommendations.
- Fixture data must never appear as Qloo data.
- Raw Discord messages must never reach persistence or Qloo.
- The demo must work repeatedly from a logged-out browser.
- Claims require an artifact, test, trace, or evaluation result.
