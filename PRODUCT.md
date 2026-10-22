# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Concert groups deciding where to go after a show. Hackathon judges are a second audience who need to understand the agent and try its core flow quickly.

## Product Purpose

Encore turns stated group tastes and practical limits into a shared after-show decision. Success is a group reaching a credible shortlist, voting, and adapting when the night changes.

## Positioning

Encore is a Discord agent that reads a short, explicitly requested snapshot of a channel, retains only stated preferences and constraints, and turns them into a group decision.

## Operating Context

One person begins a plan after a concert. Friends contribute a preference, vote on options, and can tighten practical constraints. The hosted web demo exercises the same planning engine without a Discord server.

## Capabilities and Constraints

- A web plan can be created, shared, contributed to, voted on, and replanned.
- Discord context is opt-in and limited to the latest 25 messages at plan start.
- Raw Discord messages are discarded after explicit tastes and constraints are extracted.
- Until a Qloo key is configured, the hosted demo uses fictional places and labels them as provisional.
- Real-world opening hours, availability, and booking status are never claimed without data.

## Brand Commitments

- Product name: Encore.
- Write in direct, concise language with no em dashes.
- Avoid pill-shaped controls or decorative badge language.
- The web demo should make the agent workflow clear to a hackathon judge in its first view.

## Evidence on Hand

- A deployed Worker at `https://encore.encore-tanishmisra9.workers.dev`.
- A working planning engine, Discord interaction handler, privacy policy, tests, evaluation plan, and submission draft.
- No verified Qloo response data or customer claims.

## Product Principles

1. Explain the decision path, then let people use it.
2. Treat stated preferences as input and constraints as enforceable rules.
3. Separate cultural rationale from practical information.
4. Make provisional status visible.

## Accessibility & Inclusion

The web demo must preserve keyboard operation, visible focus, labeled form controls, readable contrast, responsive layouts, and reduced-motion support.
