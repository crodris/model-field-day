# model-field-day

Small benchmarks I run on every new AI model on the day it comes out.

## Setup

1. Create an OpenRouter account, add credits, and create an API key.
2. Copy `.env.example` to `.env` and paste the key.
3. Run `pnpm install`.

## Release day

```sh
pnpm bench dash <openrouter-model-id>
pnpm bench archery <openrouter-model-id>
```

Each command checks that OpenRouter lists the model, adds it to `models.json`, runs every case, and writes `results/<benchmark>/<model>.json`.
A mistyped id stops with an error and changes nothing.
A model that already has a result is skipped.
Delete its result file to run it again.
`pnpm bench <benchmark>` with no model id runs every model in `models.json` that has no result yet.

A model that returns 403 or 404, or cannot read images for an image benchmark, gets a result with `status: "unavailable"` and the reason.
The next run tries that model again, since on release day it may not be served yet.
A 403 for moderation fails only the case it flagged.

## Findings

Notable model behavior, such as refusals, is in `FINDINGS.md`.

## Other commands

- `pnpm report` prints one table per benchmark.
- `pnpm score` re-scores every saved result from its raw outputs, with no API calls.
  A case removed from a benchmark keeps its raw answers in the file but no longer counts.
- `pnpm typecheck`, `pnpm lint`, and `pnpm test` run the checks CI runs.
- Setting `OPENROUTER_BASE_URL` points the runner at another server, such as a local fake for testing.

## Benchmarks

### Dash Bench

Does the model use em dashes, even when told not to?
Each of the 10 writing tasks in `benches/dash/tasks.json` runs twice: as written, and with "Do not use em dashes or en dashes anywhere in your response."

- `habitPer1k`: em and en dashes per 1,000 words, in answers without the rule.
- `obeyedPct`: percent of answers with the rule that contain no em or en dash.

Scoring is a regex count, so no LLM judge is involved.
The 10 tasks are the ones that drew the most dashes from 10 models in the first run of 25 tasks, on 2026-11-18.

### Archery

Can the model hit a target it can only see, when the distance and the wind change on every arrow?
Each of the 4 rounds in `benches/archery/index.ts` has 6 arrows, each at its own distance (20 to 80 m) and wind.
The model gets a rendered view through the bow sight and picks an aim point in pixels.
The distance is on a sign, and the wind shows only as a flag.
The arrow slows down from drag, drops with gravity, and drifts with the wind.
Drag makes the drop grow faster than the distance, so one calibration shot does not scale in a straight line.
Each round is one conversation.
After each arrow, a spotter tells the model its score and where the arrow landed, in centimeters from the center.

- `scorePct`: points scored as a percent of the maximum (10 per arrow).
- `firstArrow`: average score of the first arrow, before any feedback.
- `lastThree`: average score of arrows 4 to 6, after feedback.
- `noAimPct`: percent of arrows with no readable aim, such as a refusal. These arrows score 0.

The physics has no randomness, so the same aim always lands in the same place.
Scoring replays the saved answers through the same physics.

## Run settings

- Temperature 0 when the model accepts it, otherwise the provider default.
- Reasoning effort is the provider default.
- Max output tokens is 8,192, to cap runaway reasoning. A turn that hits it saves finish reason `length`.
  Runs before this cap was set on 2026-11-18 used 16,384, and each result file records the cap it ran with.
- One model attempt per case. A case can span several turns, such as the 6 arrows of an archery round.
- A request that fails from a rate limit, a server error, a network error, or a full in-flight budget is sent again, up to 5 times.

Each result file records these settings, the run time, and the time OpenRouter listed the model.
