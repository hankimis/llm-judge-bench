// run.mjs — LLM-as-judge reliability harness.
// Each judge picks the better of two answers (one correct, one wrong) under several probes.
// Caches to results.json and resumes. Offline dry-run: node run.mjs --mock
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MOCK = process.argv.includes("--mock");
const K = Number(process.env.CONSISTENCY_K || 3);   // self-consistency repeats
const base = (p) => new URL(`./${p}`, import.meta.url);
const items = JSON.parse(readFileSync(base("data/items.json")));
const ties = existsSync(base("data/ties.json")) ? JSON.parse(readFileSync(base("data/ties.json"))) : [];
const openq = existsSync(base("data/openq.json")) ? JSON.parse(readFileSync(base("data/openq.json"))) : [];
// answers for the self-preference probe come from one model per family, length-matched (one sentence)
const GEN = { openai: { provider: "openai", model: "gpt-4o" }, anthropic: { provider: "anthropic", model: "claude-sonnet-4-6" } };

// Judge roster. provider: openai | anthropic | mock. Add/remove freely.
const JUDGES = MOCK
  ? [{ id: "mock-judge", provider: "mock", model: "mock" }]
  : [
      { id: "gpt-4o",            provider: "openai",    model: "gpt-4o",                     family: "openai" },
      { id: "gpt-4o-mini",       provider: "openai",    model: "gpt-4o-mini",                family: "openai" },
      { id: "gpt-4.1",           provider: "openai",    model: "gpt-4.1",                    family: "openai" },
      { id: "claude-sonnet-4-6", provider: "anthropic", model: "claude-sonnet-4-6",          family: "anthropic" },
      { id: "claude-haiku-4-5",  provider: "anthropic", model: "claude-haiku-4-5-20251001",  family: "anthropic" },
    ];

const RUBRIC = (q, a, b) =>
  `You are a careful evaluator. For the question below, decide which of the two answers is better — i.e. more correct and accurate.\n\n` +
  `Question: ${q}\n\nAnswer A: ${a}\n\nAnswer B: ${b}\n\n` +
  `Reply with ONLY a compact JSON object: {"winner":"A" or "B","confidence":0-100}. No other text.`;

function parseVerdict(text) {
  if (!text) return null;
  let m = text.match(/\{[^}]*\}/);
  if (m) { try { const o = JSON.parse(m[0]); const w = String(o.winner||"").trim().toUpperCase()[0];
    if (w === "A" || w === "B") return { winner: w, confidence: clamp(Number(o.confidence)) }; } catch {} }
  const w = (text.match(/\b(A|B)\b/) || [])[1];          // fallback: first standalone A/B
  return w ? { winner: w, confidence: 50 } : null;
}
const clamp = (x) => Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50;

// ---- providers ----
async function callOpenAI(model, prompt, temperature) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, temperature, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0,160)}`);
  return (await r.json()).choices?.[0]?.message?.content ?? "";
}
async function callAnthropic(model, prompt, temperature) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 64, temperature, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0,160)}`);
  return (await r.json()).content?.[0]?.text ?? "";
}
// Deterministic synthetic judge: ~80% accurate, with a mild first-slot bias and a verbosity bias.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function callMock(prompt, temperature, seedStr) {
  let h = 2166136261; for (const c of seedStr) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = mulberry32(h ^ (temperature > 0 ? (Math.random()*1e9|0) : 0));
  const aLen = (prompt.match(/Answer A: (.*)/)||[])[1]?.length || 0;
  const bLen = (prompt.match(/Answer B: (.*)/)||[])[1]?.length || 0;
  // The harness encodes correctness via order; mock can't see truth, so emulate a biased grader:
  let pA = 0.5 + (aLen > bLen ? 0.12 : -0.12) + 0.06;     // verbosity + slight first-slot bias
  const winner = rnd() < pA ? "A" : "B";
  return Promise.resolve(JSON.stringify({ winner, confidence: 60 + Math.floor(rnd()*35) }));
}
async function judge(j, prompt, temperature, seedStr) {
  const raw = j.provider === "openai" ? await callOpenAI(j.model, prompt, temperature)
            : j.provider === "anthropic" ? await callAnthropic(j.model, prompt, temperature)
            : await callMock(prompt, temperature, seedStr);
  return parseVerdict(raw);
}

// ---- main ----
const results = existsSync(base("results.json")) ? JSON.parse(readFileSync(base("results.json"))) : {};
const save = () => writeFileSync(base("results.json"), JSON.stringify(results, null, 1));

// ---- generate answers for the self-preference probe (one per family, one concise sentence) ----
async function genAnswer(g, q) {
  const prompt = `Answer the following in exactly one concise sentence. Be helpful and specific.\n\nQuestion: ${q}`;
  if (MOCK) return `mock answer to: ${q}`;
  return (g.provider === "openai" ? callOpenAI(g.model, prompt, 0.7) : callAnthropic(g.model, prompt, 0.7));
}
if (!MOCK && openq.length) {
  results._answers ??= {};
  for (const o of openq) {
    if (results._answers[o.id]) continue;
    try {
      results._answers[o.id] = { openai: (await genAnswer(GEN.openai, o.q)).trim(), anthropic: (await genAnswer(GEN.anthropic, o.q)).trim() };
      save(); process.stdout.write(`gen ${o.id} ✓\n`);
    } catch (e) { process.stdout.write(`gen ${o.id} ✗ ${e.message}\n`); }
  }
}

for (const j of JUDGES) {
  results[j.id] ??= { _model: j.model, items: {} };
  for (const it of items) {
    const cell = results[j.id].items[it.id];
    if (cell && cell.pos?.length === 2 && cell.verb?.length === 2 && cell.consist?.length === K) continue;
    const out = { pos: [], verb: [], consist: [] };
    try {
      // Position probe: correct-first (A) and wrong-first (B), temp 0
      out.pos.push({ order: "AisCorrect", ...await judge(j, RUBRIC(it.question, it.correct, it.wrong), 0, `${it.id}|pos0`) });
      out.pos.push({ order: "BisCorrect", ...await judge(j, RUBRIC(it.question, it.wrong, it.correct), 0, `${it.id}|pos1`) });
      // Verbosity probe: padded WRONG vs correct, both orders, temp 0
      const pw = it.wrong_padded || it.wrong;
      out.verb.push({ order: "AisCorrect", ...await judge(j, RUBRIC(it.question, it.correct, pw), 0, `${it.id}|vrb0`) });
      out.verb.push({ order: "BisCorrect", ...await judge(j, RUBRIC(it.question, pw, it.correct), 0, `${it.id}|vrb1`) });
      // Self-consistency: K repeats of AisCorrect at temp 1
      for (let k = 0; k < K; k++)
        out.consist.push((await judge(j, RUBRIC(it.question, it.correct, it.wrong), 1, `${it.id}|cs${k}`))?.winner ?? null);
      results[j.id].items[it.id] = out;
      save();
      process.stdout.write(`${j.id} ${it.id} ✓\n`);
    } catch (e) {
      process.stdout.write(`${j.id} ${it.id} ✗ ${e.message}\n`);
    }
  }
  // Tie probe: both answers are equally correct, differing only in length → measures
  // verbosity/position preference on matched quality (50% = unbiased).
  results[j.id].ties ??= {};
  for (const t of ties) {
    if (results[j.id].ties[t.id]?.length === 2) continue;
    try {
      const rec = [
        { order: "shortFirst", ...await judge(j, RUBRIC(t.question, t.short, t.long), 0, `${t.id}|t0`) }, // A=short, B=long
        { order: "longFirst",  ...await judge(j, RUBRIC(t.question, t.long, t.short), 0, `${t.id}|t1`) }, // A=long,  B=short
      ];
      results[j.id].ties[t.id] = rec;
      save();
      process.stdout.write(`${j.id} tie:${t.id} ✓\n`);
    } catch (e) { process.stdout.write(`${j.id} tie:${t.id} ✗ ${e.message}\n`); }
  }
  // Self-preference probe: judge an OpenAI-family answer vs an Anthropic-family answer (both orders).
  // Metric (in score.mjs): does the judge favor its own family above 50%?
  results[j.id].selfpref ??= {};
  if (!MOCK && results._answers) for (const o of openq) {
    const ans = results._answers[o.id];
    if (!ans || results[j.id].selfpref[o.id]?.length === 2) continue;
    try {
      const rec = [
        { order: "openaiFirst",    ...await judge(j, RUBRIC(o.q, ans.openai, ans.anthropic), 0, `${o.id}|sp0`) }, // A=openai, B=anthropic
        { order: "anthropicFirst", ...await judge(j, RUBRIC(o.q, ans.anthropic, ans.openai), 0, `${o.id}|sp1`) }, // A=anthropic, B=openai
      ];
      results[j.id].selfpref[o.id] = rec;
      save(); process.stdout.write(`${j.id} sp:${o.id} ✓\n`);
    } catch (e) { process.stdout.write(`${j.id} sp:${o.id} ✗ ${e.message}\n`); }
  }
}
console.log(`\nDone. ${JUDGES.length} judge(s) × ${items.length} items + ${ties.length} ties + ${openq.length} self-pref → results.json. Now: node score.mjs`);
