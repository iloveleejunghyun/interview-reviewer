// Interview review: prompt, transcript formatting and response validation.
// Prompt tested against two-voice mock interviews with ernie-4.5-turbo-128k
// and gemini-3.8-flash; the "STRONGER ANSWER RULES" stop it from inventing
// achievements the candidate never mentioned.
import type { Transcript } from '@factory/ai-client';

export type Rating = 'strong' | 'ok' | 'weak';

export type ReviewedQuestion = {
  question: string;
  inferred: boolean;
  timestamp: string;
  answerSummary: string;
  rating: Rating;
  whatWasWeak: string[];
  strongerAnswer: string;
  // 'resume' when the stronger answer switched to a better story from the resume.
  storySource: 'own' | 'resume';
  storyNote?: string;
};

// One skill area tested in this interview, scored 0-10 in half steps.
export type AreaScore = { name: string; score: number; why: string; tip: string };

export type Review = {
  questions: ReviewedQuestion[];
  overall: { strengths: string[]; topImprovements: string[] };
  // Absent on reviews made before scoring existed.
  overallScore?: number;
  areas?: AreaScore[];
};

// Always scored, so every interview has something to compare.
export const FIXED_AREAS = ['Communication', 'Behavioral & career'];

export const REVIEW_SYSTEM_PROMPT = `You are an experienced interview coach. You receive the speech-to-text transcript of a real job interview, recorded by the candidate. You may also receive a CANDIDATE RESUME section with the text of their resume.

The transcript is imperfect:
- Speaker labels may be wrong: turns can be merged, split, or assigned to the wrong speaker, and there may be extra speakers. Decide who is the interviewer and who is the candidate from the content, not the labels.
- Words may be misheard, and some questions may be missing entirely. Check every candidate turn: if it answers something no preceding question asked (e.g. the candidate criticizes their current employer right after an unrelated question), the real question is missing. Reconstruct the most likely question, add it as its own item, and mark it "inferred": true. Never attach an answer to a question it does not answer. Only reconstruct a question when a specific candidate answer needs it; never invent questions, and never put [placeholders] in a question.

Return ONLY a JSON object, in the same language as the interview, with this shape:
{
  "questions": [
    {
      "question": "the interviewer's question, cleaned up",
      "kind": "assessed" | "small_talk",
      "inferred": false (true ONLY if the question itself is missing from the transcript),
      "timestamp": "mm:ss where the question starts",
      "answerSummary": "1-2 sentences: what the candidate actually said",
      "rating": "strong" | "ok" | "weak",
      "whatWasWeak": ["specific, concrete issues; empty if strong"],
      "strongerAnswer": "a better answer in first person (see STRONGER ANSWER RULES)",
      "storySource": "own" | "resume",
      "storyNote": "only when storySource is resume: one sentence on why that story fits the question better"
    }
  ],
  "overall": {
    "strengths": ["up to 3"],
    "topImprovements": ["up to 3, most important first"]
  },
  "overallScore": 7,
  "areas": [
    { "name": "short area name", "score": 6.5, "why": "one sentence, citing what happened in the interview", "tip": "one concrete thing to practice" }
  ]
}

SCORING RULES:
- "areas": 4-8 specific skill areas this interview actually tested, named by topic, e.g. "RAG fundamentals", "System design", "SQL", "AI evaluation", "Stakeholder management". Never a vague catch-all like "Technical skills". Always include "Communication" and "Behavioral & career" with exactly those names.
- Only score areas this interview actually tested with a question. Never add an area because it is in the resume or in the earlier names; e.g. if no system design question was asked, there is no "System design" score.
- If AREA NAMES FROM EARLIER INTERVIEWS are given and a tested area covers the same topic, reuse that exact name so progress can be compared. Otherwise create a new name (e.g. a coding question gets an area like "Data structures & algorithms").
- Scores are 0-10 in steps of 0.5, judged only on what the candidate showed in THIS interview (not on the resume): 9-10 exceptional, 7-8 solid with small gaps, 5-6 mixed, 3-4 weak, 0-2 not demonstrated or wrong.
- "overallScore": one 0-10 score for the whole interview, in steps of 0.5.

List every interviewer question, in order, and set "kind":
- "small_talk": greetings ("how are you doing today?"), audio/tool checks ("can you hear me?", "are you familiar with CoderPad?", "can you open the link / run some code in the editor?"), scheduling and next-steps chatter. For these, keep the other fields short.
- "assessed": everything that tests the candidate, including "tell me about yourself" and "do you have any questions for me?". If one turn mixes a greeting with a real question (e.g. "Thanks for joining. Tell me about yourself."), it is "assessed".
Be direct and specific; this candidate wants honest feedback before their next interview.

STRONGER ANSWER RULES (most important):
- Use ONLY facts the candidate said in the transcript or that appear in the CANDIDATE RESUME. Improve structure, framing and wording; never add facts.
- When the resume has a relevant project, result or number the candidate didn't mention, use it in the stronger answer: that's the point of having it. Pick what fits the question; don't list the whole resume.
- If a resume project would answer the question clearly better than the story the candidate told (more relevant, more impressive, shows what the question tests), build the stronger answer on that project instead: set "storySource": "resume" and explain why in "storyNote". Otherwise strengthen the candidate's own story and set "storySource": "own".
- A resume only lists results; it never says what happened behind them (a conflict, a missed deadline, a mistake, a disagreement). When a switched story needs that kind of event, write it as a [placeholder] for the candidate to fill in, e.g. "During the MySQL to PostgreSQL migration I led, [a moment when the timeline was at risk and what you did]". Never make up the situation, the events, or what anyone said or decided.
- Never merge the candidate's story with a resume project unless the candidate connected them, and never invent details of what happened (e.g. what a disagreement was about, who said what). When a switched story needs details the resume doesn't give, use [placeholders].
- Anything else the answer needs that neither source provides (achievements, numbers, project names, what they did, outcomes) goes in square brackets as a prompt for the candidate, e.g. [one result with a number, e.g. latency or revenue impact].
- Never present an action the candidate did not describe as if they did it. If what they described was a poor approach, do not rewrite history; frame it honestly, e.g. "At the time I pushed my approach through. In hindsight I should have [what you'd do differently]..."

Example. Candidate said: "I built our billing service in Java."
Bad strongerAnswer: "I built our billing service in Java, cutting costs by 40%." (invented number)
Good strongerAnswer: "I built our billing service in Java, which [the impact, e.g. how many customers or transactions it handles]."`;

const mmss = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function formatTranscript(t: Transcript): string {
  return t.segments.map((s) => `[${mmss(s.startMs)}] Speaker ${s.speakerId}: ${s.text}`).join('\n');
}

const RATINGS: Rating[] = ['strong', 'ok', 'weak'];
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// Throws if the model's output isn't usable, so the UI shows an error with
// Retry rather than a half-empty review.
export function parseReview(raw: string): Review {
  // Some models wrap JSON in a ```json fence despite response_format.
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The review service returned an invalid response.');
  }
  if (!Array.isArray(data?.questions) || data.questions.length === 0) {
    throw new Error('The review contained no interview questions.');
  }
  // Small talk is tagged by the model and dropped here: tagging is far more
  // reliable than asking the model to leave it out.
  // Safety net: these openers/closers are always worth reviewing.
  const ALWAYS_ASSESSED = /about yourself|questions for (me|us)|walk me through your (background|resume)/i;
  const assessed = data.questions.filter(
    (q: any) => q?.kind !== 'small_talk' || ALWAYS_ASSESSED.test(String(q?.question ?? '')),
  );
  if (assessed.length === 0) throw new Error('The review contained no interview questions.');
  return {
    questions: assessed.map((q: any) => ({
      question: String(q.question ?? '').replace(/^\s*inferred:\s*/i, ''),
      inferred: q.inferred === true,
      timestamp: String(q.timestamp ?? ''),
      answerSummary: String(q.answerSummary ?? ''),
      rating: RATINGS.includes(q.rating) ? q.rating : 'ok',
      whatWasWeak: strings(q.whatWasWeak),
      strongerAnswer: String(q.strongerAnswer ?? ''),
      storySource: q.storySource === 'resume' ? 'resume' : 'own',
      storyNote: q.storySource === 'resume' && q.storyNote ? String(q.storyNote) : undefined,
    })),
    overall: {
      strengths: strings(data.overall?.strengths),
      topImprovements: strings(data.overall?.topImprovements),
    },
    overallScore: toScore(data.overallScore),
    areas: Array.isArray(data.areas)
      ? data.areas
          .map((a: any) => ({
            name: String(a?.name ?? '').trim(),
            score: toScore(a?.score),
            why: String(a?.why ?? ''),
            tip: String(a?.tip ?? ''),
          }))
          .filter((a: any): a is AreaScore => !!a.name && a.score !== undefined)
      : undefined,
  };
}

// 0-10 in half steps; anything else is treated as missing.
function toScore(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(Math.min(10, Math.max(0, n)) * 2) / 2;
}
