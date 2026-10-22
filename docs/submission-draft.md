# Encore submission draft

## Tagline

**A Discord planner that finds the cultural overlap in a group chat.**

## The problem

Group chats contain plenty of ideas. The hard part is reconciling them. One person wants quiet conversation, another wants food, another wants the night to feel special. The result is usually a thread of links and no decision.

## What Encore does

Encore turns a natural Discord request into a local social plan. A group can authorize a one-time scan of its latest 25 messages. Encore keeps explicit tastes and practical limits, discards raw messages, finds a Qloo-grounded shortlist, and lets the group vote or replan.

## Why Qloo is essential

A generic model can suggest nearby places. Encore needs Qloo to connect cultural references across people and identify nearby places that bridge them. Qloo Search resolves entities, Tags resolves usable taste signals, and Insights supplies local candidates. If Qloo is unavailable, production Encore asks for clarification or reports unavailable.

## How we built it

- Signed Discord interactions and immediate deferred responses.
- Cloudflare Worker and D1 state with seven-day expiry.
- A strict separation between model extraction, Qloo cultural grounding, deterministic constraints, and human approval.
- A public silent replay, focused logged-out demo route, and Discord demo flow.

## Honest limits

Encore never claims booking, hours, availability, or price without data. It does not claim a measured Qloo lift until the documented blind comparison is complete.
