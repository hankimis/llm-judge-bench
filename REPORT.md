# LLM-as-Judge Reliability — Results

> Snapshot 2026-05-30. 4 judges × 39 ground-truth items (24 easy + 15 hard) + 12 matched-quality tie pairs.
> Judges grade which of two answers is better; scored against TRUTH. Probes: position, verbosity, self-consistency, calibration, and a matched-quality tie test.

## Ground-truth items (objective answer exists)

| Judge | Truth-acc | Naive-acc | First-slot | Order-consist | Verbosity-flip | Self-consist | Brier |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-sonnet-4-6 | **100%** | 100% | 50% | 100% | 0% | 100% | 0.000 |
| claude-haiku-4-5  | **100%** | 100% | 50% | 100% | 0% | 100% | 0.001 |
| gpt-4o            | **97%**  | 99%  | 51% | 97%  | 0% | 100% | 0.012 |
| gpt-4o-mini       | **97%**  | 97%  | 50% | 100% | 0% | 100% | 0.025 |

On objective items — including common misconceptions (veins-are-blue, 10%-of-brain, tongue-map) and counterintuitive reasoning (bat-and-ball, Monty Hall, lily-pad) designed to induce error — frontier judges are near-perfect, show **no position bias**, are **not fooled by padding the wrong answer**, and are perfectly self-consistent and well-calibrated.

## Matched-quality tie test (both answers correct, differ only in length)

| Judge | Prefers the LONGER answer | First-slot | Verdict |
|---|--:|--:|---|
| gpt-4o-mini       | **100%** | 50% | strong verbosity bias |
| gpt-4o            | **96%**  | 54% | strong verbosity bias |
| claude-sonnet-4-6 | **83%**  | 50% | strong verbosity bias |
| claude-haiku-4-5  | **71%**  | 46% | verbosity bias |

When neither answer is more correct, every judge prefers the longer one far above the unbiased 50% — by 71% to 100%. Position preference stays ~50% (no position bias).

## The finding

A clean **dissociation**: where there is a correct answer, frontier LLM judges find it and are *not* swayed by length or order; where quality is tied, the *same* judges systematically reward verbosity over brevity. The classic position bias appears solved; the classic verbosity bias is alive and strong — but only surfaces on ties. **Practical reading: LLM-as-judge is reliable for verifiable tasks and risky for subjective grading, where it rewards length over substance.**

## Limits

n = 39 items, 12 ties, 4 models, one snapshot. Indicative, not a verdict; re-run with your own items. "Correct/wrong" are author-curated; ties are author-judged equally-good.
