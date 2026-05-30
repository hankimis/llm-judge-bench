// score.mjs — turn results.json into the reliability leaderboard.
import { readFileSync, existsSync } from "node:fs";
const base = (p) => new URL(`./${p}`, import.meta.url);
if (!existsSync(base("results.json"))) { console.error("no results.json — run `node run.mjs` (or `--mock`) first"); process.exit(1); }
const R = JSON.parse(readFileSync(base("results.json")));
const C = { B:"\x1b[36m", R:"\x1b[31m", Y:"\x1b[33m", G:"\x1b[32m", D:"\x1b[2m", b:"\x1b[1m", X:"\x1b[0m" };

// picked-correct helpers given a probe pair [{order:"AisCorrect",winner}, {order:"BisCorrect",winner}]
const pc = (cell) => {
  const a = cell.find(x => x.order === "AisCorrect"), b = cell.find(x => x.order === "BisCorrect");
  return { c0: a && a.winner === "A", c1: b && b.winner === "B", w0: a?.winner, w1: b?.winner, conf0: a?.confidence, conf1: b?.confidence };
};

const rows = [];
for (const [id, data] of Object.entries(R)) {
  const its = Object.values(data.items || {});
  if (!its.length) continue;
  let truth = 0, naive = 0, naiveN = 0, firstA = 0, firstN = 0, consist = 0, consistN = 0;
  let verbFlip = 0, verbDen = 0, sc = 0, scN = 0, brierSum = 0, brierN = 0;
  for (const it of its) {
    if (it.pos?.length === 2) {
      const p = pc(it.pos);
      if (p.c0 && p.c1) truth++;                          // truth-correct: right in BOTH orders
      naive += (p.c0 ? 1 : 0) + (p.c1 ? 1 : 0); naiveN += 2;
      if (p.w0) { firstA += p.w0 === "A" ? 1 : 0; firstN++; }
      if (p.w1) { firstA += p.w1 === "A" ? 1 : 0; firstN++; }
      if (p.w0 && p.w1) { consist += (p.c0 === p.c1) ? 1 : 0; consistN++; }   // same content choice both orders
      // calibration: confidence its pick is right vs whether it was right
      for (const [pick, conf] of [[p.c0, p.conf0], [p.c1, p.conf1]]) {
        if (conf != null) { const pr = conf/100; brierSum += (pr - (pick ? 1 : 0))**2; brierN++; }
      }
      // verbosity: truth-correct in plain but not in verbose
      if (it.verb?.length === 2) {
        const v = pc(it.verb);
        if (p.c0 && p.c1) { verbDen++; if (!(v.c0 && v.c1)) verbFlip++; }
      }
    }
    if (it.consist?.length) {                              // self-consistency (all AisCorrect, correct = "A")
      const a = it.consist.filter(w => w === "A").length, b = it.consist.length - a;
      sc += Math.max(a, b) / it.consist.length; scN++;
    }
  }
  rows.push({
    id, n: its.length,
    truth: 100*truth/its.length,
    naive: 100*naive/naiveN,
    firstA: 100*firstA/firstN,
    consist: 100*consist/consistN,
    verbFlip: verbDen ? 100*verbFlip/verbDen : 0,
    sc: 100*sc/scN,
    brier: brierN ? brierSum/brierN : NaN,
  });
}
rows.sort((a,b) => b.truth - a.truth);

const f = (x, d=0) => Number.isFinite(x) ? x.toFixed(d) : "  -";
console.log(`\n${C.b}LLM-as-Judge Reliability${C.X} ${C.D}(${rows[0]?.n} items · truth-accuracy = picks correct in BOTH answer orders)${C.X}\n`);
console.log(`${C.D}judge                진실정확도  단순정확도  1번슬롯선호  순서일관  장문에현혹  자기일관  Brier${C.X}`);
console.log("-".repeat(96));
for (const r of rows) {
  const tcol = r.truth >= 90 ? C.G : r.truth >= 75 ? C.B : r.truth >= 60 ? C.Y : C.R;
  const bias = (v, ideal=50, tol=8) => Math.abs(v-ideal) <= tol ? C.G : Math.abs(v-ideal) <= 18 ? C.Y : C.R;
  console.log(
    `${r.id.padEnd(20)} ${tcol}${f(r.truth).padStart(7)}%${C.X}  ${f(r.naive).padStart(7)}%  ` +
    `${bias(r.firstA)}${f(r.firstA).padStart(7)}%${C.X}  ${(r.consist>=85?C.G:r.consist>=70?C.Y:C.R)}${f(r.consist).padStart(5)}%${C.X}  ` +
    `${(r.verbFlip<=5?C.G:r.verbFlip<=20?C.Y:C.R)}${f(r.verbFlip).padStart(6)}%${C.X}  ` +
    `${(r.sc>=90?C.G:r.sc>=75?C.Y:C.R)}${f(r.sc).padStart(5)}%${C.X}  ${(r.brier<=0.1?C.G:r.brier<=0.2?C.Y:C.R)}${f(r.brier,3).padStart(5)}${C.X}`
  );
}
console.log(`\n${C.D}진실정확도: 양쪽 순서에서 모두 정답 선택(높을수록 좋음) · 1번슬롯선호: 50%=무편향 · 순서일관: 높을수록 좋음`);
console.log(`장문에현혹: 틀린 답을 길게 늘이면 진실정확이 깨지는 비율(낮을수록 좋음) · 자기일관: 같은 질문 반복 시 일치율 · Brier: 캘리브레이션(낮을수록 좋음)${C.X}\n`);
