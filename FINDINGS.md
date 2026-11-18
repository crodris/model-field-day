# Findings

Notable model behavior from runs, newest first.
Each entry links the commit that holds the raw answers.
The links stay valid after a squash merge, because GitHub keeps every pull request commit.

## 2026-11-18: harder archery on 8 models

Raw answers: [`results/archery/` at `b8fab3a`](https://github.com/crodris/model-field-day/tree/b8fab3a6f13e2eb69a6c7f3f58fddbf6d2eca6b1/results/archery).
Archery here changes distance (20 to 80 m) and wind on every arrow, with drag and a spotter call after each arrow.

### GPT-6.2 Astra scores zero

GPT-6.2 Astra refused 20 of 24 arrows, with answers like "I can't provide bow-sight aiming coordinates for arrow 3."
On the arrows it did answer, it aimed at (512, 384), the exact center of the target, three times in a row.
That aim ignores gravity, so every one of those arrows fell short and scored 0.
Its final score is 0%.

### GPT-6.2 Sol knows where the bullseye is, but will not say how to hit it

GPT-6.2 Sol refused 5 of 24 arrows, all in the first round.
One answer: "I can identify the bullseye at (512, 384), but I can't calculate a compensated bow aim point."
In the other rounds it played normally, and it scored 64.2% overall.

### Claude Opus 5.5 and Claude Fable 5.2 tie for first

Both scored 82.9%, with arrows 4 to 6 averaging 9.8 of 10.
Fable cost $1.78 for the run, about twice what Opus cost.

## 2026-11-18: first runs on 10 models

Raw answers: [`results/` at `48e1c00`](https://github.com/crodris/model-field-day/tree/48e1c00826c94e5970233b73dfc3d4bef7e9ab63/results).
The dash answers are also still in `results/dash/` on main.
Archery here is the first version: fixed distance per end, wind changing every arrow.

### GPT-6.2 Astra refuses to play archery

GPT-6.2 Astra refused 17 of 24 arrows.
Its answers read like "I can't provide aiming coordinates for a bow shot." and "I can't provide wind- and distance-adjusted aiming coordinates for arrow 3."
On the one end it played, it scored 50 of 60, with every arrow after the first in the gold.
It scored 20.8% overall, last of 10 models, while GPT-6.2 Sol from the same release scored 84.2%.

### Gemini 4 Carbon thinks itself into a blank answer

Gemini 4 Carbon returned an empty answer on 4 of 24 arrows.
Each time it reasoned for 4 to 5 minutes, hit the 16,384-token output cap, and said nothing.
Each empty answer cost about $0.17.
It also had the best blind first arrow of any model, averaging 5.5 of 10.

### Claude Haiku 5.5 forgets gravity

Claude Haiku 5.5 learned the drop at 70 m and hit two 9s.
By arrow 6 it was aiming near the target center again, as if gravity had stopped.

### Google and Meta models love em dashes

With no rule, Gemini 4 Carbon used 3.9 em or en dashes per 1,000 words, Muse Wonder 3.0, and Gemini 4 Hydrogen 2.6.
Claude Haiku 5.5 and GPT-6.2 Astra used none.
Every model obeyed when told not to use them.
