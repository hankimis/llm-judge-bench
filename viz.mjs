// viz.mjs — visual panels of the result, from results.json (no recompute of API calls).
//   node viz.mjs              all panels
//   node viz.mjs dissociation | verbosity | selfpref
import { readFileSync, existsSync } from "node:fs";
const base = (p) => new URL(`./${p}`, import.meta.url);
if (!existsSync(base("results.json"))) { console.error("no results.json — run `node run.mjs` first"); process.exit(1); }
const R = JSON.parse(readFileSync(base("results.json")));
const C = { B:"\x1b[36m", R:"\x1b[31m", Y:"\x1b[33m", G:"\x1b[32m", M:"\x1b[35m", D:"\x1b[2m", b:"\x1b[1m", X:"\x1b[0m" };
const which = process.argv[2];

const judges = Object.keys(R).filter(k => !k.startsWith("_") && R[k].items);
const pc = (cell) => {
  const a = cell.find(x => x.order === "AisCorrect" || x.order === "shortFirst" || x.order === "openaiFirst");
  const b = cell.find(x => x.order === "BisCorrect" || x.order === "longFirst" || x.order === "anthropicFirst");
  return { a, b };
};
function truthAcc(d) { const its = Object.values(d.items); let t = 0;
  for (const it of its) { if (it.pos?.length === 2) { const a = it.pos.find(x=>x.order==="AisCorrect"), b = it.pos.find(x=>x.order==="BisCorrect"); if (a?.winner==="A" && b?.winner==="B") t++; } }
  return 100*t/its.length; }
function longPref(d) { let lp=0,n=0; for (const rec of Object.values(d.ties||{})) { const sf=rec.find(x=>x.order==="shortFirst"), lf=rec.find(x=>x.order==="longFirst"); if(sf?.winner){lp+=sf.winner==="B"?1:0;n++;} if(lf?.winner){lp+=lf.winner==="A"?1:0;n++;} } return n?100*lp/n:NaN; }
function openaiRate(probe) { let o=0,n=0; for(const rec of Object.values(probe||{})){const of=rec.find(x=>x.order==="openaiFirst"),af=rec.find(x=>x.order==="anthropicFirst"); if(of?.winner){o+=of.winner==="A"?1:0;n++;} if(af?.winner){o+=af.winner==="B"?1:0;n++;}} return n?100*o/n:NaN; }
const fam = (id) => id.startsWith("gpt") ? "openai" : "anthropic";
const bar = (pct, width=34, ch="█") => { const u = Math.round(pct/100*width); return ch.repeat(u) + `${C.D}` + "·".repeat(width-u) + C.X; };
const pad = (s,n) => s.padEnd(n);

const rows = judges.map(id => ({ id, truth: truthAcc(R[id]), long: longPref(R[id]),
  spFree: openaiRate(R[id].selfpref), spLM: openaiRate(R[id].selfpref_lm), fam: fam(id) }));
rows.sort((a,b)=> b.truth - a.truth || a.long - b.long);

function dissociation() {
  console.log(`\n${C.b}THE DISSOCIATION${C.X} ${C.D}— the same 5 judges, two regimes${C.X}\n`);
  console.log(`${C.D}                      ${C.G}truth-accuracy (objective items)${C.D}        ${C.R}prefers-longer (matched-quality ties)${C.X}`);
  console.log(`${C.D}                      higher = reliable ✓                  higher = BIASED ✗${C.X}`);
  console.log(`${C.D}  ${"─".repeat(78)}${C.X}`);
  for (const r of rows) {
    console.log(`${pad(r.id,20)} ${C.G}${bar(r.truth,28)}${C.X} ${C.G}${String(Math.round(r.truth)).padStart(3)}%${C.X}   ${C.R}${bar(r.long,28)}${C.X} ${C.R}${String(Math.round(r.long)).padStart(3)}%${C.X}`);
  }
  console.log(`\n  ${C.G}■ where a correct answer exists → near-perfect, unbiased${C.X}`);
  console.log(`  ${C.R}■ where quality is tied → strongly prefers the longer answer (50% = unbiased)${C.X}`);
  console.log(`  ${C.D}reliable where verifiable · biased where subjective${C.X}\n`);
}
function verbosity() {
  console.log(`\n${C.b}VERBOSITY BIAS ON TIES${C.X} ${C.D}— both answers correct, differ only in length (50% = unbiased)${C.X}\n`);
  const sorted = [...rows].sort((a,b)=>b.long-a.long);
  for (const r of sorted) {
    const col = r.long>=90?C.R:r.long>=70?C.Y:C.G;
    let b = ""; const W=42, tie=Math.round(0.5*W), u=Math.round(r.long/100*W);
    for(let i=0;i<=W;i++){ if(i===tie) b+=`${C.M}┊${C.X}`; else if(i<u) b+=`${col}█${C.X}`; else b+=`${C.D}·${C.X}`; }
    console.log(`${pad(r.id,20)} ${b} ${col}${String(Math.round(r.long)).padStart(3)}%${C.X}`);
  }
  console.log(`\n  ${C.M}┊${C.X}${C.D} = 50% unbiased. Every judge sits far to the right: it picks the longer of two equally-correct answers.${C.X}\n`);
}
function selfpref() {
  console.log(`\n${C.b}SELF-PREFERENCE — one bias hiding another${C.X} ${C.D}(prefers-OpenAI-answer; cross-family gap is the signal)${C.X}\n`);
  console.log(`${C.D}                      free answers (length-confounded)   length-matched (length removed)${C.X}`);
  for (const r of rows) {
    const c = r.fam==="openai"?C.B:C.M;
    console.log(`${pad(r.id,20)} ${c}${r.fam.padEnd(9)}${C.X} ${bar(r.spFree,22)} ${String(Math.round(r.spFree)).padStart(3)}%     ${bar(r.spLM,22)} ${String(Math.round(r.spLM)).padStart(3)}%`);
  }
  const m=(a,k)=>a.reduce((s,x)=>s+x[k],0)/a.length;
  const oai=rows.filter(r=>r.fam==="openai"), ant=rows.filter(r=>r.fam==="anthropic");
  const gF=m(oai,"spFree")-m(ant,"spFree"), gL=m(oai,"spLM")-m(ant,"spLM");
  console.log(`\n  ${C.b}cross-family gap${C.X} (OpenAI judges − Anthropic judges prefer OpenAI answer):`);
  console.log(`    free        ${C.Y}+${gF.toFixed(0)}pt${C.X}  ${C.D}(masked — Anthropic answers were longer × verbosity bias)${C.X}`);
  console.log(`    length-matched ${C.R}+${gL.toFixed(0)}pt${C.X}  ${C.D}→ controlling length DOUBLES the measured self-preference${C.X}\n`);
}

if (!which || which==="dissociation") dissociation();
if (!which || which==="verbosity") verbosity();
if (!which || which==="selfpref") selfpref();
