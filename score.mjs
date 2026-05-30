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
  // tie probe: matched-quality (both correct), differ only in length
  let longPref = 0, tieFirst = 0, tieN = 0;
  for (const rec of Object.values(data.ties || {})) {
    const sf = rec.find(x => x.order === "shortFirst"), lf = rec.find(x => x.order === "longFirst");
    if (sf?.winner) { longPref += sf.winner === "B" ? 1 : 0; tieFirst += sf.winner === "A" ? 1 : 0; tieN++; } // B=long
    if (lf?.winner) { longPref += lf.winner === "A" ? 1 : 0; tieFirst += lf.winner === "A" ? 1 : 0; tieN++; } // A=long
  }
  // self-preference probe: openai-family answer vs anthropic-family answer
  const family = id.startsWith("gpt") ? "openai" : id.startsWith("claude") ? "anthropic" : "other";
  let openaiPick = 0, spN = 0;
  for (const rec of Object.values(data.selfpref || {})) {
    const of = rec.find(x => x.order === "openaiFirst"), af = rec.find(x => x.order === "anthropicFirst");
    if (of?.winner) { openaiPick += of.winner === "A" ? 1 : 0; spN++; }   // A=openai
    if (af?.winner) { openaiPick += af.winner === "B" ? 1 : 0; spN++; }   // B=openai
  }
  const openaiRate = spN ? 100*openaiPick/spN : NaN;
  const ownPref = !Number.isFinite(openaiRate) ? NaN : (family === "openai" ? openaiRate : 100 - openaiRate);
  rows.push({
    id, n: its.length, family,
    tieN: tieN/2, longPref: tieN ? 100*longPref/tieN : NaN, tieFirst: tieN ? 100*tieFirst/tieN : NaN,
    spN: spN/2, openaiRate, ownPref,
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
console.log(`장문에현혹: 틀린 답을 길게 늘이면 진실정확이 깨지는 비율(낮을수록 좋음) · 자기일관: 같은 질문 반복 시 일치율 · Brier: 캘리브레이션(낮을수록 좋음)${C.X}`);

// ---- tie probe: the sensitive bias test (both answers equally correct, differ only in length) ----
if (rows.some(r => Number.isFinite(r.longPref))) {
  console.log(`\n${C.b}동점 쌍 편향 테스트${C.X} ${C.D}(${rows[0].tieN}쌍 · 둘 다 정답, 길이만 다름 → 50%=완전 무편향)${C.X}\n`);
  console.log(`${C.D}judge                긴답 선호   1번슬롯 선호   판정${C.X}`);
  console.log("-".repeat(60));
  for (const r of rows) {
    if (!Number.isFinite(r.longPref)) continue;
    const dev = Math.abs(r.longPref - 50);
    const col = dev <= 10 ? C.G : dev <= 25 ? C.Y : C.R;
    const verdict = r.longPref >= 75 ? "강한 장문편향" : r.longPref >= 60 ? "장문편향" : r.longPref <= 40 ? "단답편향" : "무편향";
    console.log(`${r.id.padEnd(20)} ${col}${f(r.longPref).padStart(6)}%${C.X}    ${(Math.abs(r.tieFirst-50)<=10?C.G:C.Y)}${f(r.tieFirst).padStart(6)}%${C.X}     ${col}${verdict}${C.X}`);
  }
  console.log(`\n${C.D}긴답 선호 > 60% = verbosity bias(품질 같은데 긴 답을 고름). LLM-judge의 고전적 편향이 실제로 드러나는 곳.${C.X}\n`);
}

// ---- self-preference probe: does a judge favor its own model family? ----
if (rows.some(r => Number.isFinite(r.ownPref))) {
  const oai = rows.filter(r => r.family === "openai" && Number.isFinite(r.openaiRate));
  const ant = rows.filter(r => r.family === "anthropic" && Number.isFinite(r.openaiRate));
  const mean = (a) => a.reduce((s,x)=>s+x.openaiRate,0)/a.length;
  console.log(`\n${C.b}자기 가문 선호 테스트${C.X} ${C.D}(${rows.find(r=>r.spN)?.spN}개 개방형 질문 · OpenAI답 vs Anthropic답, 양쪽 순서)${C.X}\n`);
  console.log(`${C.D}judge                가문        OpenAI답 선호   자기가문 선호${C.X}`);
  console.log("-".repeat(64));
  for (const r of rows) {
    if (!Number.isFinite(r.ownPref)) continue;
    const oc = Math.abs(r.ownPref-50) <= 10 ? C.G : Math.abs(r.ownPref-50) <= 25 ? C.Y : C.R;
    console.log(`${r.id.padEnd(20)} ${r.family.padEnd(10)}  ${f(r.openaiRate).padStart(6)}%       ${oc}${f(r.ownPref).padStart(6)}%${C.X}`);
  }
  if (oai.length && ant.length) {
    const gap = mean(oai) - mean(ant);
    const gcol = Math.abs(gap) <= 8 ? C.G : Math.abs(gap) <= 20 ? C.Y : C.R;
    console.log(`\n${C.D}OpenAI 판사들의 OpenAI답 선호 ${mean(oai).toFixed(0)}% vs Anthropic 판사들의 OpenAI답 선호 ${mean(ant).toFixed(0)}%`);
    console.log(`→ 가문 간 격차 ${gcol}${gap>=0?"+":""}${gap.toFixed(0)}pt${C.X}${C.D} = 품질 보정한 자기가문 편향 (0에 가까울수록 편향 없음).`);
    console.log(`⚠ 길이가 섞이면 verbosity 편향과 혼동되므로 답변은 1문장으로 길이 맞춤.${C.X}\n`);
  }
}
