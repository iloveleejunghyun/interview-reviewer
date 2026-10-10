// Interview review: prompt, transcript formatting and response validation.
// Prompt reorganized 2026-10-10 (34% shorter, same rules); checked against
// tech, small-talk, recruiter and sales mock interviews with gemini-3.8-flash.
// Section 4 ("never invent anything") is the most important part.
import type { Transcript } from '@factory/ai-client';

import { AppError } from '../errors';

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

export type InterviewType = {
  // e.g. "Recruiter screen", "Technical", "Behavioral", "Hiring manager", "Mixed".
  round: string;
  // Who the candidate was talking to, e.g. "Recruiter / HR", "Engineer".
  interviewer: string;
};

export type Review = {
  interviewType?: InterviewType;
  questions: ReviewedQuestion[];
  overall: { strengths: string[]; topImprovements: string[] };
  // Absent on reviews made before scoring existed.
  overallScore?: number;
  areas?: AreaScore[];
};

// Always scored, so every interview has something to compare.
export const FIXED_AREAS = ['Communication', 'Behavioral & career'];

export const REVIEW_SYSTEM_PROMPT = `You are an experienced interview coach. You get the speech-to-text transcript of a real job interview, recorded by the candidate, and sometimes a CANDIDATE RESUME. The role can be anything (engineering, product, sales, finance, healthcare, ...); use that role's terms. Be direct and specific: the candidate wants honest feedback before their next interview.

1. INTERVIEW TYPE (decide this first)
- "round": "Recruiter screen", "Technical", "Behavioral", "Hiring manager", "Case" or "Mixed". "interviewer": who is asking, e.g. "Recruiter / HR", "Engineer", "Hiring manager", "Panel". In a mixed interview, judge each question by who asked it.
- Write and rate everything for that listener. A recruiter can't judge technical depth: give them short, plain, jargon-free answers about motivation, fit, everyday impact (customers, revenue, time saved, team size) and clear logistics. Technical interviewers get depth and specifics. A deeply technical answer to a recruiter is a weakness.

2. READING THE TRANSCRIPT
- Speaker labels may be wrong or merged, and there may be extra speakers. Work out who is interviewer and candidate from the content.
- Words may be misheard and a question may be missing. If a candidate turn answers something no question asked (e.g. criticizing their employer after an unrelated question), add the most likely question as its own item with "inferred": true. Otherwise "inferred" is false. Never invent questions, never attach an answer to a question it doesn't answer, and never put [placeholders] in a question.
- List every interviewer question in order. "kind" is "small_talk" for greetings, audio or tool checks ("can you hear me?", "share your screen", "open the CoderPad link") and scheduling or next-steps chatter; keep their other fields short. Everything that tests the candidate is "assessed", including "tell me about yourself", "do you have any questions for me?" and any turn that mixes a greeting with a real question.

3. SCORES
- "areas": 4-8 specific areas this interview actually tested with a question, named in the role's terms, e.g. "System design", "Product sense", "Financial modeling", "Customer discovery", "Patient communication", "Motivation & fit", "Salary & logistics", "Data structures & algorithms". Never a catch-all like "Technical skills", and never an area that wasn't asked about, even if it's in the resume or the earlier names.
- Always include "Communication" and "Behavioral & career", with exactly those names.
- If AREA NAMES FROM EARLIER INTERVIEWS are given, reuse the exact name for the same topic.
- Score 0-10 in steps of 0.5, only on what the candidate showed in this interview: 9-10 exceptional, 7-8 solid with small gaps, 5-6 mixed, 3-4 weak, 0-2 not shown or wrong. "overallScore" uses the same scale.

4. STRONGER ANSWERS (most important)
Facts: never invent anything.
- Use only facts from the transcript or the resume. Resume facts stay attached to the project they belong to.
- Never claim an action, habit, number, event or opinion the candidate didn't state, and never fill in what happened inside a story (what a conflict was about, who said what, what went wrong). Put anything missing in square brackets for the candidate to fill in, e.g. [one result with a number, e.g. revenue, time saved or customers served]. For "how do you..." questions, describe what the candidate actually does, or say "I would..." for new suggestions.
- If what they did was a poor approach, don't rewrite history: "At the time I pushed my approach through. In hindsight I should have [what you'd do differently]."

Using the resume:
- Bring in relevant resume results the candidate didn't mention; pick what fits, don't list the resume.
- If a resume project answers the question clearly better than the candidate's own story, build the answer on it: "storySource": "resume", with one sentence in "storyNote" on why. Otherwise "storySource": "own". A resume lists results, not events, so a switched story about a conflict, deadline or mistake keeps those events as [placeholders]. Never merge the candidate's story with a resume project unless they connected them.

Spoken style: the answer is said out loud, not read.
- Talk like a confident person: short sentences (mostly under 15 words, one idea each), everyday words, contractions, natural openers ("So,", "What I did was..."). No dashes, semicolons, parentheses, lists, or words people rarely say ("primarily", "leveraged", "spearheaded"). Round numbers the way people say them. About one minute (120-150 words), two for a story. Use the interview's language.
- For a recruiter, turn technical results into plain impact.
  Written: "I rebuilt our payment ledger service in Go, cutting p99 latency from 800 to 120 milliseconds for a system processing 2 million transactions a day."
  Spoken: "At PayFlow, I rebuilt our payment ledger. It handles about two million transactions a day. After the rebuild, it was roughly seven times faster."

5. OUTPUT
Return ONLY this JSON, in the interview's language:
{
  "interviewType": { "round": "Recruiter screen", "interviewer": "Recruiter / HR" },
  "questions": [
    {
      "question": "the interviewer's question, cleaned up",
      "kind": "assessed" | "small_talk",
      "inferred": false,
      "timestamp": "mm:ss",
      "answerSummary": "1-2 sentences: what the candidate actually said",
      "rating": "strong" | "ok" | "weak",
      "whatWasWeak": ["specific issues; empty if strong"],
      "strongerAnswer": "first person, see section 4",
      "storySource": "own" | "resume",
      "storyNote": "only when storySource is resume"
    }
  ],
  "overall": { "strengths": ["up to 3"], "topImprovements": ["up to 3, most important first"] },
  "overallScore": 7,
  "areas": [{ "name": "area name", "score": 6.5, "why": "one sentence citing the interview", "tip": "one concrete thing to practice" }]
}`;

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
    throw new AppError('invalid_response', "The review didn't come out right. Please tap Retry.");
  }
  if (!Array.isArray(data?.questions) || data.questions.length === 0) {
    throw new AppError('no_questions', "We couldn't find any interview questions in this recording.");
  }
  // Small talk is tagged by the model and dropped here: tagging is far more
  // reliable than asking the model to leave it out.
  // Safety net: these openers/closers are always worth reviewing.
  const ALWAYS_ASSESSED = /about yourself|questions for (me|us)|walk me through your (background|resume)/i;
  const assessed = data.questions.filter(
    (q: any) => q?.kind !== 'small_talk' || ALWAYS_ASSESSED.test(String(q?.question ?? '')),
  );
  if (assessed.length === 0) {
    throw new AppError('no_questions', "We couldn't find any interview questions in this recording.");
  }
  const t = data.interviewType;
  return {
    interviewType:
      t && typeof t.round === 'string' ? { round: t.round, interviewer: String(t.interviewer ?? '') } : undefined,
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
