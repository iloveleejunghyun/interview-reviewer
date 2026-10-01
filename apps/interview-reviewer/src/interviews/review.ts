// Interview review: prompt, transcript formatting and response validation.
// Prompt tested 2026-09-29 against a two-voice mock interview with
// ernie-4.5-turbo-128k; the "STRONGER ANSWER RULES" stop it from inventing
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
};

export type Review = {
  questions: ReviewedQuestion[];
  overall: { strengths: string[]; topImprovements: string[] };
};

export const REVIEW_SYSTEM_PROMPT = `You are an experienced interview coach. You receive the speech-to-text transcript of a real job interview, recorded by the candidate.

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
      "strongerAnswer": "a better answer in first person (see STRONGER ANSWER RULES)"
    }
  ],
  "overall": {
    "strengths": ["up to 3"],
    "topImprovements": ["up to 3, most important first"]
  }
}

List every interviewer question, in order, and set "kind":
- "small_talk": greetings ("how are you doing today?"), audio/tool checks ("can you hear me?", "are you familiar with CoderPad?", "can you open the link / run some code in the editor?"), scheduling and next-steps chatter. For these, keep the other fields short.
- "assessed": everything that tests the candidate, including "tell me about yourself" and "do you have any questions for me?". If one turn mixes a greeting with a real question (e.g. "Thanks for joining. Tell me about yourself."), it is "assessed".
Be direct and specific; this candidate wants honest feedback before their next interview.

STRONGER ANSWER RULES (most important):
- Use ONLY facts the candidate actually said. Improve structure, framing and wording; never add facts.
- Anything else the answer needs (achievements, numbers, project names, what they did, outcomes) goes in square brackets as a prompt for the candidate, e.g. [one result with a number, e.g. latency or revenue impact].
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
    })),
    overall: {
      strengths: strings(data.overall?.strengths),
      topImprovements: strings(data.overall?.topImprovements),
    },
  };
}
