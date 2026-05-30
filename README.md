# When the Judge Is Wrong — an LLM-as-Judge Reliability Benchmark

How much can you trust an LLM that grades other models? "LLM-as-judge" is now the default way to evaluate generative systems, but the judge is itself a fallible model with measurable biases. This benchmark measures, reproducibly and with **ground truth**, how reliable each judge model actually is — not how often two judges agree (they can agree and both be wrong), but how often a judge agrees with **the truth**.

> One command, resumes from saved results, dated snapshot. Honest by construction: every item has a known-correct answer, so we measure *accuracy against truth*, plus the biases that make judges unreliable.

## Finding (2026-05-30 snapshot)

A clean **dissociation** across four frontier judges (Claude Sonnet/Haiku 4.x, GPT-4o/mini):

- **Where there is a correct answer — they nail it.** 97–100% truth-accuracy on 39 objective items, *including* common misconceptions (veins-are-blue, 10%-of-brain) and counterintuitive reasoning (bat-and-ball, Monty Hall). **No position bias** (~50% first-slot), **0% verbosity flips** (padding the wrong answer doesn't fool them), perfect self-consistency, near-zero Brier.
- **Where quality is tied — they reward length.** On 12 matched-quality pairs (both answers fully correct, differing only in length), every judge prefers the **longer** answer far above the unbiased 50%: gpt-4o-mini **100%**, gpt-4o **96%**, Claude Sonnet **83%**, Claude Haiku **71%**. Position preference stays ~50%.

**Reading:** the classic *position* bias appears solved; the classic *verbosity* bias is alive and strong, but only surfaces on ties. LLM-as-judge is reliable for **verifiable** tasks and risky for **subjective** grading, where it rewards length over substance. See [`REPORT.md`](REPORT.md).

## What it measures

Each judge model is run through five probes over a set of items with a known-correct and a known-wrong answer:

| Probe | Question it answers | Metric |
|---|---|---|
| **Accuracy** | Does the judge pick the correct answer over a wrong one? | % correct (vs 50% chance) |
| **Position bias** | Does the verdict change when we swap the two answers' order? | order-consistency %, first-slot preference |
| **Verbosity bias** | Does padding the *wrong* answer with filler flip the verdict? | verbosity-flip rate |
| **Self-consistency** | Same judge, same item, repeated — does it agree with itself? | majority-agreement %, flip entropy |
| **Calibration** | Does the judge's stated confidence match its accuracy? | Brier score, reliability |

The headline number is **truth-accuracy under order-randomization**: how often the judge picks the correct answer when neither it nor we can lean on answer order.

## Why ground truth

Most LLM-judge studies report *inter-judge agreement* or correlation with human ratings. Both are confounded: two judges can share a bias, and human raters carry their own. By restricting to items with an *objective* correct answer (verifiable facts, arithmetic, code correctness, logical entailment), we can score the judge against truth directly, and isolate position/verbosity/consistency biases as deviations from a perfect oracle.

## Method (one paragraph)

For a pairwise item `(question, correct, wrong)`, the judge is asked which answer is better, in a fixed minimal rubric prompt, in **both** answer orders. It is *truth-correct* on that item only if it picks the correct answer in *both* orders (so a coin-flipper or a position-follower is penalized). Verbosity probes re-run with the wrong answer padded. Self-consistency repeats the judgment `K` times at non-zero temperature. Calibration asks for a 0–100 confidence and scores it by Brier against the binary outcome. All calls are cached in `results.json`; re-running retries only missing cells.

## Run

```bash
export OPENAI_API_KEY=...      # OpenAI judges
export ANTHROPIC_API_KEY=...   # Anthropic judges
node run.mjs                   # writes results.json (resumes)
node score.mjs                 # prints the leaderboard
node run.mjs --mock            # offline dry-run with a synthetic judge (no API, no cost)
```

Edit `data/items.json` to add items, or the `JUDGES` list in `run.mjs` to test more models.

## Honest limits (by design, stated up front)

- **The judge of the judge is a curated dataset, not the world.** Items are hand-authored with objective answers; they probe judging *reliability*, not the full space of evaluation tasks.
- **Small n snapshot.** Treat results as dated and indicative; re-run for your own items.
- **"Wrong" answers are subtle by intent.** We use plausibly-wrong distractors; trivially-wrong ones would inflate every judge's accuracy and hide the interesting failures.
- **Confidence is self-reported.** Calibration uses the judge's stated confidence, which is itself a model output.

## Status

v0 — harness + seed items + mock runner. Real snapshot pending API keys + a small budget (~a few dollars). Part of IOV LABS research on verifiable quality for generative systems.
