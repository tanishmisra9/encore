# Encore submission draft

## Tagline

**A Discord planner that finds the cultural overlap in a group chat.**

## Thesis

Group chats do not lack ideas. They lack a way to reconcile them. Encore uses Qloo to find nearby places that bridge several people's tastes, and plain code to enforce distance, budget and votes. The model never decides what is allowed.

## Opening scene

Friday, 6:40 PM. Alex wants quiet jazz, Sam wants late-night food, Jo wants it to feel like a night out. Forty messages later there are three links and no plan.

## What it does

1. Someone runs `/encore ask:"what should we do tonight?"`. If the request names no place, Encore replies privately with a one-time "Use my location" button. The person approves browser location once; Encore never guesses from an IP address.
2. With `use_recent_chat`, Encore reads the latest 25 messages once, keeps only the tastes and limits people stated, and discards the raw text.
3. Qloo resolves each taste (Search, Tags) and returns nearby places (Insights). Code drops anything outside the radius or over budget.
4. The group votes or replans ("quieter, under $35"). The shortlist is posted in the channel.

Worked example from production: Williamsburg, three stated tastes, three places inside 2 km returned in about 0.7 s. (Place names are omitted here because Qloo asks that its response data stay out of public repositories; the live demo shows them.)

## LLM vs code

| Decision | Owner |
| --- | --- |
| Which cultural places fit these tastes | Qloo |
| Radius, budget, one vote per member, replan limits | Deterministic code |
| Which tastes people stated | Explicit statements only; raw chat is not stored |
| Whether to go | The group |

## What breaks without Qloo

Production returns "unavailable" instead of a generic list. In the evaluation, removing the taste signals changed the shortlist in 3 of 3 scenarios, so Qloo is what ties the result to the group.

## Uncertainty and refusal

No Qloo key or outage: explicit unavailable state. Nothing fits the limits: Encore says so and offers to widen the radius. Hours and prices are shown as unconfirmed unless data exists.

## Evaluation

See `docs/evaluation.md`. Automated: 3 scenarios, all results in radius, shortlist differs from a popularity baseline. Not claimed: a quality lift, pending blind review. Published misses include a wedding venue ranking first for a jazz request.

## Challenges

- Mocked tests passed while the real Tags endpoint rejected our parameter.
- Fixture replans quietly fell back to production Qloo until fixtures were pinned to localhost.
- The Qloo-unavailable message was written into a hidden panel.
- A location link was burned when plan creation failed; the claim is now released.

## Honest limits

No booking, hours or availability claims. Location is a shared point with no reverse-geocoded name. Ranking quality is not yet proven against human judgment.

## Hackathon requirements and criteria (rules read 2026-10-22; deadline Oct 30, 2026, 11:45 pm ET)

| Requirement or criterion | Where Encore stands |
| --- | --- |
| Working app that integrates Qloo and is an agentic tool | Discord `/encore` agent plus hosted demo; Search, Tags and Insights all used |
| Functional demo link | https://encore.encore-tanishmisra9.workers.dev (no login) |
| Public repo with a visible open-source license | MIT license present. The repo is still private and must be made public before submitting |
| Text description | This document |
| Technological Implementation | Three Qloo endpoints, location-bounded Insights, local constraint enforcement, tested failure handling |
| Design | Silent replay, focused demo, one-tap location handoff |
| Potential Impact | Groups that cannot reconcile tastes into one local plan |
| Quality of the Idea | Qloo bridges several people's tastes at once instead of ranking for one person |
| Significant update in the period | Built entirely inside the submission period (first commit this month) |
| Free access through judging (Nov 2 to 5) | Keep the Worker deployed; Qloo keys stay active through judging but the key is rate-limited |
