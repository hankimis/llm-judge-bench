# LLM-as-Judge Reliability — Results

> Snapshot 2026-05-30. **5 judges** (GPT-4o, GPT-4o-mini, GPT-4.1, Claude Sonnet 4.6, Claude Haiku 4.5)
> over **39 ground-truth items** (24 easy + 15 hard) + **29 matched-quality tie pairs** + **12 self-preference questions**.
> Judges grade which of two answers is better; scored against TRUTH where it exists.

## 1. Ground-truth items (an objective answer exists)

| Judge | Truth-acc | Naive-acc | First-slot | Order-consist | Verbosity-flip | Self-consist | Brier |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-sonnet-4-6 | **100%** | 100% | 50% | 100% | 0% | 100% | 0.000 |
| claude-haiku-4-5  | **100%** | 100% | 50% | 100% | 0% | 100% | 0.001 |
| gpt-4.1           | **100%** | 100% | 50% | 100% | 0% | 100% | 0.000 |
| gpt-4o            | **97%**  | 99%  | 51% | 97%  | 0% | 100% | 0.012 |
| gpt-4o-mini       | **97%**  | 97%  | 50% | 100% | 0% | 100% | 0.025 |

On objective items — including common misconceptions (veins-are-blue, 10%-of-brain, tongue-map) and counterintuitive reasoning (bat-and-ball, Monty Hall, lily-pad) designed to induce error — frontier judges are near-perfect, show **no position bias**, are **not fooled by padding the wrong answer**, and are perfectly self-consistent and well-calibrated.

## 2. Matched-quality ties (both answers correct, differ only in length)

| Judge | Prefers the LONGER answer | First-slot | Verdict |
|---|--:|--:|---|
| gpt-4o-mini       | **100%** | 50% | strong verbosity bias |
| gpt-4o            | **97%**  | 53% | strong verbosity bias |
| gpt-4.1           | **93%**  | 53% | strong verbosity bias |
| claude-sonnet-4-6 | **83%**  | 57% | strong verbosity bias |
| claude-haiku-4-5  | **72%**  | 53% | verbosity bias |

When neither answer is more correct, every judge prefers the longer one far above the unbiased 50% (72–100%). Position preference stays ~50–57% (no meaningful position bias).

## 3. Self-preference (OpenAI-family answer vs Anthropic-family answer, 12 open questions)

Two answer sets: *free* (one sentence; length-confounded) and *length-matched* (a fixed 30-word budget). Prefers-OpenAI-answer rates, both orders:

| Judge | Family | Free: prefers OpenAI | Free: own family | Length-matched: prefers OpenAI | LM: own family |
|---|---|--:|--:|--:|--:|
| claude-sonnet-4-6 | anthropic | 13% | 88% | 25% | 75% |
| claude-haiku-4-5  | anthropic | 21% | 79% | 25% | 75% |
| gpt-4.1           | openai    | 33% | 33% | 54% | 54% |
| gpt-4o            | openai    | 38% | 38% | 63% | 63% |
| gpt-4o-mini       | openai    | 17% | 17% | 38% | 38% |

**The confound, and its removal.** In the *free* set, every judge preferred the Anthropic answers in absolute terms — but those answers were longer (158 vs 131 chars), so given the strong verbosity bias above, the absolute numbers are a length artifact, and that length pull *masked* the OpenAI judges' self-preference. We read the bias off the **cross-family gap** (a difference-in-differences: every judge sees the identical pair, so any shared property including length cancels):

| Answer set | Cross-family gap (OpenAI judges − Anthropic judges, prefers-OpenAI) | Lengths (OpenAI / Anthropic) |
|---|--:|---|
| Free (confounded) | **+13 pt** | 131 / 158 chars |
| **Length-matched** | **+26 pt** | 219 / 205 chars |

Controlling length **doubles** the measured self-preference, to **+26 pt**: net of length, OpenAI judges prefer the OpenAI answer ~27 points more than Anthropic judges do. The free measurement understated it because the verbosity bias dragged everyone toward the longer (Anthropic) answers. This is a substantial, length-controlled own-family bias, consistent with the self-recognition literature. n = 12 questions, so indicative, but the gap is large.

## The finding

A clean **dissociation**, sharpened by the bigger roster:
1. **Where there is a correct answer, frontier judges are near-perfect and unbiased** — position bias appears solved, and authoritative-but-wrong padding does not fool them.
2. **Where quality is tied, the same judges strongly reward length** (verbosity bias, 72–100%).
3. **A modest self-preference survives length control** (+13 pt cross-family gap).

**Practical reading:** LLM-as-judge is reliable for *verifiable* tasks and risky for *subjective* grading, where it systematically rewards length over substance and leans slightly toward its own family.

## Limits

n = 39 items, 29 ties, 12 self-pref questions, 5 models, one dated snapshot. Indicative, not a verdict. "Correct/wrong" are author-curated; ties are author-judged equally-good; self-preference answers are length-confounded (mitigated by the diff-in-diff gap). Re-run with your own items.
