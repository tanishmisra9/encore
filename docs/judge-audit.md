# Judge audit

| Criterion | Evidence | Release condition |
| --- | --- | --- |
| Working application | Hosted homepage, `/demo.html`, and Discord interaction endpoint | Done 2026-10-22: production `POST /api/demo` returns `source: qloo` with 3 places inside 2 km |
| Agentic tool | Natural request, optional context, recommendation, vote, and replan loop | Pending: `DISCORD_BOT_TOKEN` is not set, so commands are not registered |
| Qloo implementation | Entity search, tag lookup, and place Insights form the recommendation path | Production request above; Discord-side trace pending a bot token |
| Product design | Silent replay, focused demo, privacy disclosure, and square editorial UI | Browser test on desktop and mobile |
| Impact and originality | Groups resolve competing cultural tastes into a local decision | Blind comparison results |
| Public source | MIT license, setup instructions, architecture, and evaluation protocol | Secret scan and public release |

## Skeptical judge checks

- Removing Qloo must remove culturally grounded recommendations.
- Fixture data must never appear as Qloo data.
- Raw Discord messages must never reach persistence or Qloo.
- The demo must work repeatedly from a logged-out browser.
- Claims require an artifact, test, trace, or evaluation result.

## Bugs the live API exposed

- `/v2/tags` rejects `query=` and needs `filter.query=`; the mocked tests had hidden this and a real request would have failed outright.
- Real place coordinates live at `entity.location.{lat,lon}`; a `properties.geocode` object without coordinates masked them.
- One failed taste lookup used to abort the plan; lookups now fail independently and only a full outage reports Qloo unavailable.
- A location link was consumed even when plan creation failed; the claim is now released so the person can retry.
- Qloo's hackathon key returns 429 under bursts (about 1 in 12 cold requests in a repeat test). The seeded demo result is cached per Worker instance for 10 minutes, and a 429 now shows a retry message instead of a generic failure. Raising the limit needs a request in the Qloo hackathon Discord #api-help.

## Adversarial pass (2026-10-22)

- Clean clone with no key: typecheck and 10 tests pass.
- Persistence: D1 writes only `plans` and `pending_locations` JSON; Session stores extracted tastes and counts, not message text.
- Repeated logged-out `POST /api/demo`: 19 of 20 returned Qloo results; the miss was the 429 above.
- Key scan of tree and history: no match.
