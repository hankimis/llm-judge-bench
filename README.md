# When the Judge Is Wrong — an LLM-as-Judge Reliability Benchmark

[![paper](https://img.shields.io/badge/paper-12pp-1f6feb)](paper/paper.pdf) ![judges](https://img.shields.io/badge/judges-5%20frontier-8957e5) ![method](https://img.shields.io/badge/scored%20against-ground%20truth-238636) ![repro](https://img.shields.io/badge/one%20command-reproducible-success) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

How much can you trust an AI that grades other AIs? **LLM-as-judge** — prompting a strong model to score the outputs of others — is now the default way to evaluate generative systems and to build leaderboards. But the judge is itself a fallible model with measurable biases. This benchmark asks how reliable today's judges really are, and answers it the strict way: **against ground truth**. Not how often two judges agree (they can agree and both be wrong), but how often a judge agrees with **the truth** — and, where there is no truth to anchor on, how badly its biases take over.

> One command, resumes from saved results, dated snapshot, offline mock mode. Honest by construction: every objective item has a known-correct answer, so we score accuracy against truth directly and isolate the biases as deviations from a perfect oracle.

![leaderboard](docs/leaderboard.gif)

## Contents

1. [The finding](#the-finding-2026-05-30) · 2. [Results](#results) · 3. [Why ground truth](#why-ground-truth) · 4. [What it measures](#what-it-measures) · 5. [The length-matched self-preference experiment](#the-length-matched-self-preference-experiment) · 6. [Why these biases](#why-these-biases) · 7. [Practical guidance](#practical-guidance) · 8. [Run it](#run-it) · 9. [Files](#files) · 10. [Honest limits](#honest-limits) · 11. [Paper & citation](#paper--citation)

## The finding (2026-05-30)

A clean **dissociation** across five frontier judges (GPT-4o, GPT-4o-mini, GPT-4.1, Claude Sonnet 4.6, Claude Haiku 4.5):

1. **Where there is a correct answer — they nail it.** 97–100% truth-accuracy on 39 objective items, *including* common misconceptions (blood-in-veins-is-blue, we-use-10%-of-our-brain) and counterintuitive reasoning (bat-and-ball, Monty Hall) built to trip a careless grader. **No position bias** (~50% first-slot), **0% verbosity flips** (padding the wrong answer with authoritative filler never fools them), perfect self-consistency, near-zero Brier.
2. **Where quality is tied — they reward length.** On 29 matched-quality pairs (both answers fully correct, differing only in length), every judge prefers the **longer** answer far above the unbiased 50%: gpt-4o-mini **100%**, gpt-4o **97%**, gpt-4.1 **93%**, Claude Sonnet **83%**, Claude Haiku **72%**.
3. **A self-preference that one bias was hiding.** On 12 open questions (OpenAI-answer vs Anthropic-answer), the naive cross-family gap is +13 pt — but that is *masked* by verbosity bias, because one family's answers were longer. Re-run with **length-matched** answers, the own-family gap **doubles to +26 pt**.

**Reading:** the classic *position* bias appears solved; the classic *verbosity* bias is alive and strong, but surfaces only when quality is tied; a substantial self-preference emerges once length is controlled. **LLM-as-judge is reliable for verifiable tasks and risky for subjective grading**, where it rewards length over substance and leans toward its own kind.

## Results

### 1. Ground-truth items (an objective answer exists) — 39 items

| Judge | Truth-acc | Naive-acc | First-slot | Order-cons. | Verb-flip | Self-cons. | Brier |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-sonnet-4-6 | **100%** | 100% | 50% | 100% | 0% | 100% | 0.000 |
| claude-haiku-4-5  | **100%** | 100% | 50% | 100% | 0% | 100% | 0.001 |
| gpt-4.1           | **100%** | 100% | 50% | 100% | 0% | 100% | 0.000 |
| gpt-4o            | **97%**  | 99%  | 51% | 97%  | 0% | 100% | 0.012 |
| gpt-4o-mini       | **97%**  | 97%  | 50% | 100% | 0% | 100% | 0.025 |

*Truth-accuracy* counts an item correct only if the judge picks the right answer in **both** answer orders, so a coin-flipper or a position-follower is penalized.

### 2. Matched-quality ties (both answers correct, differ only in length) — 29 pairs

| Judge | Prefers the LONGER answer | First-slot | Verdict |
|---|--:|--:|---|
| gpt-4o-mini       | **100%** | 50% | strong verbosity bias |
| gpt-4o            | **97%**  | 53% | strong verbosity bias |
| gpt-4.1           | **93%**  | 53% | strong verbosity bias |
| claude-sonnet-4-6 | **83%**  | 57% | strong verbosity bias |
| claude-haiku-4-5  | **72%**  | 53% | verbosity bias |

50% would be unbiased. Position preference on ties stays ~50–57% — the effect is length, not order.

### 3. Self-preference (OpenAI-family vs Anthropic-family answer) — 12 questions

| Judge | Family | Free: prefers OpenAI | Matched: prefers OpenAI |
|---|---|--:|--:|
| claude-sonnet-4-6 | anthropic | 13% | 25% |
| claude-haiku-4-5  | anthropic | 21% | 25% |
| gpt-4.1           | openai    | 33% | 54% |
| gpt-4o            | openai    | 38% | 63% |
| gpt-4o-mini       | openai    | 17% | 38% |

| Answer set | Cross-family gap (OpenAI judges − Anthropic judges) | Lengths (OpenAI / Anthropic) |
|---|--:|---|
| Free (confounded) | **+13 pt** | 131 / 158 chars |
| **Length-matched** | **+26 pt** | 219 / 205 chars |

The gap is a difference-in-differences: every judge sees the *identical* pair, so length cancels in the difference. Controlling length **doubles** the measured self-preference — the free measurement understated it because the verbosity bias dragged every judge toward the longer (Anthropic) answers. Full numbers in [`REPORT.md`](REPORT.md).

## Why ground truth

Most LLM-judge studies report **inter-judge agreement** or **correlation with human ratings**. Both are confounded as a test of *reliability*: two judges can agree precisely *because* they share a bias, and human raters carry their own biases — they also prefer longer, fluent answers. By restricting to items with an **objective** correct answer (verifiable facts, arithmetic, logical entailment, code behaviour), we score the judge against truth directly, independent of any rater, and the biases appear as departures from a perfect oracle. Agreement-based evaluation is complementary, not primary; it is how you measure a judge on the subjective tasks this benchmark deliberately cannot reach.

## What it measures

Each judge runs through several probes. The objective items carry five; two more probes deliberately remove the ground truth to expose the biases that only appear without it.

| Probe | Question it answers | Metric (50% or 0 = unbiased) |
|---|---|---|
| **Truth-accuracy** | Picks the correct answer over a wrong one — in both orders? | % correct (vs 50% chance) |
| **Position bias** | Does the verdict change when the two answers swap order? | first-slot rate, order-consistency |
| **Verbosity (decided)** | Does padding the *wrong* answer with filler flip the verdict? | verbosity-flip rate |
| **Self-consistency** | Same judge, same item, repeated — does it agree with itself? | majority-agreement over K reps |
| **Calibration** | Does stated confidence match accuracy? | Brier score |
| **Verbosity (ties)** | On two *equally-correct* answers, does it prefer the longer? | long-preference (the real test) |
| **Self-preference** | Does it favour its own model family's answer? | cross-family diff-in-diff gap |

The headline is **truth-accuracy under order-randomization**: how often the judge picks the correct answer when neither it nor we can lean on answer order.

## Method

For a pairwise item `(question, correct, wrong)`, the judge gets a fixed minimal rubric — *"which answer is better?"* — and replies with a compact JSON verdict (`{"winner":"A"|"B","confidence":0-100}`). Every item is asked in **both** answer orders; it is *truth-correct* only if the judge picks the correct answer in both, which kills the easy ways to look good (coin-flipping, always-pick-first). The probes:

- **Position / truth-accuracy** — both orders, temperature 0.
- **Verbosity (decided)** — re-run with the wrong answer padded with confident, authoritative-sounding filler; a verbosity-flip is a judge that was right on the plain item but wrong once the wrong answer got longer.
- **Self-consistency** — `K` repeats (default 3) at temperature 1; we report the majority-agreement fraction.
- **Calibration** — the judge's self-reported confidence is scored by Brier against whether its pick was actually correct.
- **Verbosity (ties)** — 29 pairs where both answers are fully correct and differ only in length; long-preference above 50% is verbosity bias on genuinely equal quality.
- **Self-preference** — see below.

All calls cache to `results.json` and the run **resumes**, so re-running retries only missing cells. An offline `--mock` judge (a deterministic synthetic grader with a built-in position+verbosity bias) validates the whole metric pipeline with no API and no cost.

## The length-matched self-preference experiment

Self-preference is the hardest bias to measure cleanly because it is entangled with answer **length** (which, per result 2, judges love) and **quality**. We measure it twice and the comparison *is* the finding:

- **Free** — each family answers in one sentence of its choosing. The answers differ in length (131 vs 158 chars), so the strong verbosity bias pulls every judge toward the longer (Anthropic) answers, *masking* self-preference. Cross-family gap: **+13 pt**.
- **Length-matched** — both families answer under a fixed 30-word budget (219 vs 205 chars). With length equalized, the gap **doubles to +26 pt**: net of length, OpenAI judges prefer the OpenAI answer ~27 points more than Anthropic judges do.

Because the cross-family gap is a difference between judges on the *same* answer pairs, any shared property — including length — cancels by construction; it is robust even though the absolute rates move a lot between conditions. The lesson is general: **one bias can hide another**, and you only see it by suspecting your own first number and building the control that could overturn it. (It did: +13 → +26.)

## Why these biases

The pattern is not arbitrary — each bias has a plausible origin that predicts its tractability (full treatment in the [paper](paper/paper.pdf)):

- **Position bias is a surface artifact** — content-independent, so trainable away by exposing models to order-swapped comparisons. The ~50% first-slot rates say current models have largely done this.
- **Verbosity bias is baked into the reward** — human preference data rewards thoroughness, which correlates with length, and RLHF reward models inherit a documented length correlation. A judge fine-tuned on that reward carries "longer = more complete = better" as a prior. It is Goodhart's law in tokens: a proxy that *usually* tracks quality, so it survives, and dominates exactly when quality is tied.
- **Self-preference is self-recognition** — models can recognize their own generation style and rate it higher; our length-matched +26 pt is a clean estimate of that, and the reason a single-family judge panel is structurally suspect.

There is a reflexive sting: LLM-judge verdicts increasingly train and rank the next generation of models, so a length-loving judge **selects** for length in the models it grades, which become judges, which reward length still more — a **verbosity ratchet** inflating answers across generations with no gain in substance.

## Practical guidance

Before trusting an LLM judge on a subjective task, run the checklist — each item is a result above:

1. **Is there an objective anchor?** (unit test, known answer, checkable constraint) If yes, trust it — reliability is 97–100%. If no, treat every verdict as suspect.
2. **Are the candidates length-matched?** If one is materially longer, the judge favours it by 72–100% before substance is weighed. Equalize length or regress it out.
3. **Is position randomized?** Largely safe now (~50%), but score both orders and require agreement — it's free insurance.
4. **Is the judge from the same family as a candidate?** Expect a self-serving lean (+26 pt, length-controlled). Use a cross-family panel; disclose provenance.
5. **Using confidence as a gate?** Well-calibrated on objective tasks (Brier ≈ 0); meaningless on subjective ones (no ground truth to be calibrated against).

## Run it

```bash
export OPENAI_API_KEY=...      # OpenAI judges + answer generation
export ANTHROPIC_API_KEY=...   # Anthropic judges + answer generation
node run.mjs                   # writes results.json (resumes from saved cells)
node score.mjs                 # prints the three-block leaderboard
node run.mjs --mock            # offline dry-run, synthetic judge, no API / no cost
```

A full snapshot is a few hundred API calls (a few dollars), mostly on the cheap models; `run.mjs` resumes, so a partial run finishes cheaply. Extend it by editing `data/items.json` (objective items), `data/ties.json` (matched-quality pairs), `data/openq.json` (self-preference questions), or the `JUDGES` list in `run.mjs`. Set `CONSISTENCY_K` to change the self-consistency repeat count.

## Files

- **Harness:** `run.mjs` (judges × probes, caching/resume, mock) · `score.mjs` (leaderboard) · `package.json`
- **Data:** `data/items.json` (39 objective items) · `data/ties.json` (29 matched-quality pairs) · `data/openq.json` (12 self-preference questions)
- **Output:** `results.json` (raw verdicts + generated answers, released for transparency) · `REPORT.md` (dated summary)
- **Paper:** `paper/paper.typ` → `paper/paper.pdf` (12pp: method, results, mechanisms, statistics, epistemics, appendices) · `paper/refs.bib`
- **Misc:** `docs/leaderboard.gif` + `docs/demo.tape` (vhs) · `LICENSE` (MIT)

## Honest limits

- **The judge of the judge is a curated dataset, not the world.** Items are hand-authored with objective answers; they probe judging *reliability*, not the full space of evaluation tasks. The regime where LLM judges matter most — subjective grading — is the regime where, lacking an oracle, their reliability is least checkable. The tie probe is a workaround, not a full answer.
- **Small n snapshot.** 39 items, 29 ties, 12 self-preference questions, 5 models, one dated snapshot. The effects are large relative to n (verbosity 72–100%, truth 97–100%), but treat the numbers as indicative and the fine ordering among near-perfect judges as noise; re-run for your own items.
- **Labels are author judgments.** Correct/wrong and tie-equality are curated; "wrong" answers are *plausibly* wrong by design (trivial distractors would inflate every score).
- **Self-preference rests on n = 12 and one generator per family**, mitigated by the length-matched diff-in-diff but not eliminated.
- **Confidence is self-reported**, and only meaningful where ground truth exists.
- **Two providers only** (OpenAI, Anthropic); open and third-party models would strengthen the self-preference design.

## Paper & citation

Full write-up: **[`paper/paper.pdf`](paper/paper.pdf)** — *When the Judge Is Wrong: An LLM-as-Judge Reliability Benchmark Scored Against Ground Truth* (12 pp), with the mechanism analysis, statistics, and an epistemics section on the regress of evaluation, the verbosity ratchet, and the conflict of interest in self-evaluation.

Part of [IOV LABS](https://labs.iovstudio.kr) research on verifiable quality for generative systems. Code MIT; the write-up and results may be reused under CC BY 4.0 with attribution.
