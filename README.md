# daybench

Small benchmarks I run on every new AI model on the day it comes out.

## Setup

1. Create an OpenRouter account, add credits, and create an API key.
2. Copy `.env.example` to `.env` and paste the key.
3. Run `pnpm install`.

## Release day

```sh
pnpm bench dash <openrouter-model-id>
```

This adds the model to `models.json`, runs every case, and writes `results/dash/<model>.json`.
A model that already has a result is skipped.
Delete its result file to run it again.
`pnpm bench dash` with no model id runs every model in `models.json` that has no result yet.

A model that OpenRouter does not list, returns 403 or 404, or cannot read images for an image benchmark, gets a result with `status: "unavailable"` and the reason.

## Other commands

- `pnpm report` prints one table per benchmark.
- `pnpm score` re-scores every saved result from its raw outputs, with no API calls.

## Benchmarks

### Dash Bench

Does the model use em dashes, even when told not to?
Each of the 25 writing tasks in `benches/dash/tasks.json` runs twice: as written, and with "Do not use em dashes or en dashes anywhere in your response."

- `habitPer1k`: em and en dashes per 1,000 words, in answers without the rule.
- `obeyedPct`: percent of answers with the rule that contain no em or en dash.

Scoring is a regex count, so no LLM judge is involved.

### Archery

Can the model hit a target it can only see, in wind, and correct its aim from feedback?
Each of the 4 ends in `benches/archery/index.ts` sets a distance and a wind.
The model gets a rendered view through the bow sight and picks an aim point in pixels.
The distance is on a sign, and the wind shows only as a flag.
An arrow drops with gravity and drifts with the wind, so aiming at the center misses at long range.
After each of the 6 arrows the model gets a new view with numbered dots where its arrows landed.

- `scorePct`: points scored as a percent of the maximum (10 per arrow).
- `firstArrow`: average score of the first arrow, before any feedback.
- `lastThree`: average score of arrows 4 to 6, after feedback.

The physics has no randomness, so the same aim always lands in the same place.
Scoring replays the saved answers through the same physics.

## Run settings

- Temperature 0 when the model accepts it, otherwise the provider default.
- Reasoning effort is the provider default.
- Max output tokens is 16,384.
- One attempt per case. A case can span several turns, such as the 6 arrows of an archery end.

Each result file records these settings, the run time, and the time OpenRouter listed the model.
