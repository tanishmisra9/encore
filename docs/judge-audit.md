# Judge audit

| Requirement | Evidence |
| --- | --- |
| Functional demo, no login | https://memory-lane.encore-tanishmisra9.workers.dev, one tap on an example loads a live Qloo session |
| Public repo with visible license | https://github.com/tanishmisra9/memory-lane, MIT |
| Description | `docs/submission-draft.md` |
| Hosted, not local | Cloudflare Worker with D1 |
| Qloo is load-bearing | Remove Qloo and no artists, films or shows are found; the app reports the failure |

## Skeptical checks

- Production never substitutes a generic list: a Qloo failure returns an error message (`test/qloo.test.ts`).
- No health data is requested or stored; the form has four fields.
- Every number in the write-up comes from `npm run eval`, `npm test`, or the browser test.
- Qloo data stays out of the repo: docs name no Qloo results, and the cache lives in D1.
- The key is in `.dev.vars` (ignored) and a Cloudflare secret, never in the tree or history.
