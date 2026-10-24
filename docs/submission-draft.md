# Memory Lane submission

## Tagline

**The right song isn't the popular one. It's the one from when they were 19.**

## Opening scene

Sunday afternoon at the care home. A daughter pulls up "oldies" for her father and gets songs he never heard. He looks out the window. Later someone plays a song he danced to at 19, and he starts tapping the table.

For many people with dementia, music from their teens and twenties is among the last things that stays familiar. That window, roughly ages 10 to 30, is known as the reminiscence bump, and it is well documented in healthy adults; evidence in dementia is smaller but points the same way ([Kaiser and Berntsen, 2022](https://pure.au.dk/ws/files/338096928/WIRES_Cognitive_Science_-_2022_-_Kaiser.pdf)). More than 55 million people live with dementia worldwide ([WHO](https://www.who.int/news-room/fact-sheets/detail/dementia)), and almost all of their caregivers are families with no way to find the right songs.

## Why the obvious approach fails

A search for "oldies" returns what was popular for everyone, in one country. A language model invents plausible titles. Neither knows this person's culture, decade, or taste. Measured on Qloo's data, a generic popular list fits a person's youth 17% of the time and puts an upsetting lyrical theme in 83% of its top six.

**Thesis: Qloo finds what someone's tastes are close to, plain code decides what is safe and from their years, and every reaction reshapes the next session.**

## What it does

1. A caregiver enters a birth year and one to three artists the person loved (autocomplete from Qloo, or a starter shelf for 12 countries).
2. An agent asks Qloo for artists near them, keeps only those active during ages 10 to 30 that are familiar and have gentle lyrical themes, re-anchors on what it found, and repeats until it has enough. Named artists are dated through iTunes, so their songs show an exact year and age.
3. The page shows six songs with 30-second previews, two films or shows from the same years, and three conversation prompts built from the real titles.
4. The caregiver taps Smiled, Okay or Upset on each item. Upset bans the artist and replaces the song; Smiled warms that genre. The session prints as a "what works" page for family or care staff, and can be deleted.

## How Qloo is used, and what breaks without it

Search resolves the artists the caregiver names. Insights returns artists, films and shows near them, across a culture Memory Lane has no list for (the Greek, Mexican, Indian, Brazilian and Jamaican examples need no hand-built data). Without Qloo there is no way to go from "Nana Mouskouri" to Manos Hadjidakis and George Dalaras; the app shows Qloo's failure instead of a generic list.

## LLM versus code

There is no language model. Qloo supplies candidates. Code decides era (born +10 to +30, unknown years excluded), familiarity, gentle themes, audio availability, de-duplication, and how reactions change the plan. Prompts are fixed templates filled with real titles. The caregiver decides everything else.

## Evaluation

Eight personas, three arms (full table in `docs/evaluation.md`). A generic popular list fits the person's era 17% of the time, has upsetting themes in 83% of its top six, and is identical for every persona. Memory Lane's lists are era-fit and share nothing across personas. The agent loop finds about 22% more safe in-era artists than a single Qloo call (21.4 against 17.6 on average, 7 against 5 at the minimum). Audio previews exist for 96% of songs. Not shown: whether the songs are the right ones for a real person. That needs caregivers, and it is not claimed.

## Challenges

- A `null` end year became 0, so every active artist looked retired. A unit test caught it.
- Qloo's search results carry no era fields, so the first build dropped Frank Sinatra as "not active". Named artists are now dated through iTunes.
- The agent's third round repeated its second query until it re-anchored on artists it had not used.
- "Bob Marley" and "Bob Marley & The Wailers" both played "No Woman, No Cry" in one session.
- The Discord version of this project (archived on `v1-discord`) needed a server, a bot invite and a location handoff. Judges could not try it, so we rebuilt it as a page.

## Qloo criteria

| Criterion | How Memory Lane answers it |
| --- | --- |
| Technological implementation | Qloo Search, Insights across artists, movies and TV, release-year window, explainability for "found through", a re-anchoring agent loop, a deterministic safety engine, 19 tests, a real-browser test, a three-arm evaluation |
| Design | A jukebox title-strip wall, one idea per screen, 44px targets, AA contrast, no pills, mobile first |
| Potential impact | Family caregivers of the 55 million-plus people with dementia; free, no login, prints a summary for care staff |
| Quality of the idea | Cultural intelligence where a generic model fails: era-anchored, culture-aware, safety-screened reminiscence |

## Honest limits

Not therapy and makes no medical claim. No per-song year for found artists, so it shows ages. Films and shows are weaker matches. No human review of the songs yet. Qloo's hackathon key is rate-limited; repeated lookups are cached on the server.
