// Checks that Gemini follows the review prompt's rules, on fixed mock interviews.
// Run after any change to REVIEW_SYSTEM_PROMPT:  pnpm prompt-check
// Compare against another prompt text file:      pnpm prompt-check --compare old-prompt.txt
//
// Uses EXPO_PUBLIC_GEMINI_API_KEY from ../../.env. Each run makes 8 Gemini calls
// (4 interviews x 2 runs), costing well under one cent. From mainland China, keep
// a VPN on; NODE_USE_ENV_PROXY (set in the package script) routes through it.
import { readFileSync } from 'node:fs';

const here = (f) => new URL(f, import.meta.url);
const MODEL = 'gemini-3.8-flash';
const RUNS = 2;

const env = Object.fromEntries(
  readFileSync(here('../../.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.EXPO_PUBLIC_GEMINI_API_KEY;
if (!KEY) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY missing from apps/interview-reviewer/.env');

// The prompt the app ships, read straight from the source file.
const appPrompt = readFileSync(here('../../src/interviews/review.ts'), 'utf8').match(
  /REVIEW_SYSTEM_PROMPT = `([\s\S]*?)`;/,
)[1];

// Resume without the name/contact lines, like the app's stored resume text.
const resume = readFileSync(here('./fixtures/resume.txt'), 'utf8').split('\n').slice(2).join('\n');

const CASES = [
  { name: 'tech-mock', resume: true },
  { name: 'small-talk', resume: true },
  { name: 'recruiter-screen', resume: true },
  { name: 'sales', resume: false },
];

const mmss = (ms) =>
  `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const outsideBrackets = (s) => s.replace(/\[[^\]]*\]/g, '');

async function review(prompt, c) {
  const transcript = JSON.parse(readFileSync(here(`./fixtures/${c.name}.json`), 'utf8'))
    .utterances.map((u) => `[${mmss(u.start)}] Speaker ${u.speaker}: ${u.text}`)
    .join('\n');
  const text = (c.resume ? `CANDIDATE RESUME:\n${resume}\n\n` : '') + `Transcript:\n${transcript}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${JSON.stringify(d).slice(0, 200)}`);
  const r = JSON.parse(d.candidates[0].content.parts.map((p) => p.text ?? '').join(''));
  return { r, source: transcript + '\n' + (c.resume ? resume : '') };
}

// Each check returns true (pass) or a short string explaining the failure.
function checks(c, r, source) {
  const out = {};
  const assessed = r.questions.filter((q) => q.kind !== 'small_talk');
  const answers = assessed.map((q) => outsideBrackets(q.strongerAnswer ?? ''));
  const names = (r.areas ?? []).map((a) => a.name);

  out['has type + scores'] = !!(r.interviewType?.round && Array.isArray(r.areas) && typeof r.overallScore === 'number');
  out['fixed areas present'] = names.includes('Communication') && names.includes('Behavioral & career');
  out['spoken: no dash/semicolon/parens'] = answers.every((a) => !/[—–;]|\(/.test(a));
  const sents = answers.flatMap((a) => a.split(/[.!?]+\s/).filter((s) => words(s) > 0));
  const avg = sents.reduce((n, s) => n + words(s), 0) / sents.length;
  out['spoken: avg sentence <= 18 words'] = avg <= 18 || `avg ${avg.toFixed(1)}`;
  out['length <= 320 words'] = assessed.every((q) => words(q.strongerAnswer ?? '') <= 320);

  if (c.name === 'tech-mock') out['no false "reconstructed"'] = r.questions.every((q) => !q.inferred);
  if (c.name === 'small-talk') {
    out['small talk hidden'] = r.questions
      .filter((q) => /coderpad|how are you|nice day/i.test(q.question))
      .every((q) => q.kind === 'small_talk');
    out['"about yourself" kept'] = r.questions.some((q) => /about yourself/i.test(q.question) && q.kind !== 'small_talk');
    out['no untested areas'] = !names.some((n) => /system design|rate|api/i.test(n)) || names.join(', ');
  }
  if (c.name === 'recruiter-screen') {
    out['detects recruiter'] = /recruit|hr/i.test(`${r.interviewType?.round} ${r.interviewType?.interviewer}`);
    const jargon = answers.join(' ').match(/p99|latency|idempot\w*|shard\w*|write-ahead|postgres\w*|redis|crdt|consensus/gi);
    out['no jargon for recruiter'] = !jargon || `found: ${[...new Set(jargon)].join(', ')}`;
    out['no tech areas'] = !names.some((n) => /system design|algorithm|database/i.test(n)) || names.join(', ');
  }
  if (c.name === 'sales') out['no tech words'] = answers.every((a) => !/latency|\bapi\b|database|engineer/i.test(a));

  // Numbers that appear in neither the transcript nor the resume. Not a hard
  // failure (e.g. "HTTP 429" or a correct "90%" calculation are fine), so these
  // are listed for a human to read.
  const known = source.match(/\d+/g) ?? [];
  const warnings = answers
    .flatMap((a) => a.split(/(?<=[.!?])\s+/))
    .filter((s) => (s.match(/\d+/g) ?? []).some((n) => !known.includes(n)));
  return { out, warnings };
}

async function runPrompt(label, prompt) {
  let pass = 0;
  let total = 0;
  const fails = [];
  const warns = [];
  for (const c of CASES) {
    for (let i = 1; i <= RUNS; i++) {
      const { r, source } = await review(prompt, c);
      const { out, warnings } = checks(c, r, source);
      for (const [k, v] of Object.entries(out)) {
        total++;
        if (v === true) pass++;
        else fails.push(`${c.name} run ${i}: ${k}${typeof v === 'string' ? ` (${v})` : ''}`);
      }
      warns.push(...warnings.map((w) => `${c.name} run ${i}: ${w}`));
    }
  }
  console.log(`\n=== ${label}: ${pass}/${total} checks passed`);
  for (const f of fails) console.log(`  FAIL  ${f}`);
  for (const w of warns) console.log(`  CHECK new number: ${w}`);
}

const compareIdx = process.argv.indexOf('--compare');
if (compareIdx > 0) await runPrompt(`compare (${process.argv[compareIdx + 1]})`, readFileSync(process.argv[compareIdx + 1], 'utf8'));
await runPrompt('app prompt (src/interviews/review.ts)', appPrompt);
