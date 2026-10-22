# Encore submission draft

## Tagline

**Encore turns “what should we do after the show?” into a group decision with taste, constraints, and a vote.**

## The problem

Concert plans fall apart right after the encore. A group chat has scattered preferences, someone has a walking limit, another person has a budget, and the answer turns into a list of links that nobody chooses from.

Encore begins where the show ends. Run `/encore`, optionally let it read the latest 25 channel messages once, add a taste, vote, and replan if the night changes. It keeps raw chat out of storage and shows unknown hours and availability as unconfirmed.

## Why this needs Qloo

Distance sorting can find close places. It cannot explain which one fits the group after this artist at this venue. Encore resolves the performing artist through Qloo Search and sends that cultural anchor to Qloo Insights with a bounded venue location. If Qloo is unavailable, Encore surfaces that state. It does not quietly replace Qloo with generic results in the submitted Qloo mode.

## How it works

1. A Discord user starts `/encore` with artist, venue, and an explicit choice to read the recent chat window.
2. Encore retains only explicit preference statements and concrete limits. Raw channel messages are discarded.
3. Qloo provides nearby culturally relevant places from the artist and venue context.
4. Code enforces walking radius, budget, valid voters, and one current vote each.
5. The group sees taste rationale separately from practical information and can revise the plan.

## What we built

- Discord HTTP interactions with Ed25519 signature verification and immediate deferred responses.
- A public Cloudflare Worker demo backed by D1, including a no-key fixture flow for judges.
- A seven-day plan expiry policy and an in-product privacy explanation.
- A Qloo adapter that uses `/search` for the artist and `/v2/insights` for nearby places.

## Honest limits

The public demo is explicitly provisional until a Qloo key is configured. Fictional demo places are clearly labeled. Encore does not claim opening hours, availability, booking, or a measured Qloo improvement before the planned blinded evaluation is complete.
