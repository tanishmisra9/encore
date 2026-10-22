# Encore

Encore helps a Discord concert group decide where to go after a show. One person starts `/encore`, participants add tastes, the group votes, and the plan can change when the night does.

The public web demo exercises the same planning engine without requiring a Discord server.

## What Encore does

- Reads up to 25 recent channel messages only when `/encore use_recent_chat:true` is requested.
- Extracts explicit statements such as “I prefer quiet cafés,” then discards raw chat content.
- Shows taste rationale separately from practical details such as distance, price, and unconfirmed hours.
- Enforces budget and walking radius in code, records one current vote per person, and clears votes when the plan changes.
- Deletes expired plans after seven days.

## Data sources

Until a Qloo key is available, the public demo uses fictional places and labels results as provisional. Local development can use a small OpenStreetMap Overpass query through `recommend(..., 'live')`; automated tests only use fixtures.

When `QLOO_API_KEY` is configured, Encore resolves the artist with Qloo `/search`, then uses Qloo `/v2/insights` to rank nearby places. A Qloo error is shown as unavailable; it never silently falls back to generic recommendations.

## Run locally

```sh
npm install
npx wrangler d1 migrations apply encore --local
npm run dev
```

Open `http://localhost:8787`.

```sh
npm test
node test/browser.mjs
```

## Configure Discord

Create a Discord application and configure the following worker values:

```text
DISCORD_APPLICATION_ID=<application id>
DISCORD_PUBLIC_KEY=<public key>
DISCORD_BOT_TOKEN=<bot token, kept only in .env and Cloudflare secrets>
```

Enable Message Content Intent, and grant View Channels, Send Messages, and Read Message History. Set the interaction endpoint to:

```text
https://<worker>.<subdomain>.workers.dev/discord/interactions
```

Then register the command:

```sh
npm run discord:register
```

The command accepts an artist, one of the demo venues, and an optional `use_recent_chat` checkbox.

## Deploy

```sh
npx wrangler d1 migrations apply encore --remote
npx wrangler deploy
```

Set secrets through Wrangler, never in `wrangler.jsonc`:

```sh
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put QLOO_API_KEY
```

## Privacy

Read the live policy at `/privacy.html`. A shared demo link can be edited by anyone who has it, so do not add personal or sensitive information to a plan.

## Evaluation and submission notes

The fixed evaluation protocol is in [`docs/evaluation.md`](docs/evaluation.md). A fact-checked starting point for the Devpost entry is in [`docs/submission-draft.md`](docs/submission-draft.md).

## License

[MIT](LICENSE)
