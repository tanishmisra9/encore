# Judge audit

| Criterion | Evidence | Release condition |
| --- | --- | --- |
| Working application | Hosted homepage, `/demo.html`, and Discord interaction endpoint | Done 2026-10-22: production `POST /api/demo` returns `source: qloo` with 3 places inside 2 km |
| Agentic tool | Natural request, optional context, recommendation, vote, and replan loop | `/encore` is registered; the bot has not been invited to a real server yet |
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
- A stated budget removed every Qloo place, because Qloo returns no dollar price for most venues. Found by the sandbox's `budget under $40` seed; unknown price now passes and is shown as unconfirmed.
- Qloo 429s now retry twice with backoff, and identical Qloo lookups are cached in memory for 10 minutes (private server cache, allowed by Qloo's terms).

## Sandbox

`npm run sandbox` (16 checks): signature enforcement, location handoff in a real browser, one-time link, plan post, no raw chat echo, vote, leading marker, replan, vote reset, cross-channel isolation, named-place path, no-taste stop, and a canary check on the database. CI runs the offline checks on every push.
