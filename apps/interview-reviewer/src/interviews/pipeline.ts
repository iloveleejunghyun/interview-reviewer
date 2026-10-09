// Recording -> transcript (AssemblyAI) -> review (Gemini). Each step's result
// is saved before the next starts, so a failure can be retried from where it
// stopped. Failures are stored with the real error message; nothing is faked.
import { AIServiceError } from '@factory/ai-client';

import { textModel as reviewer, transcriber } from '../ai';
import { analytics } from '../analytics';
import { describeError, errorProps, withConnectivity } from '../errors';
import { loadBackground } from '../profile/background';
import { formatTranscript, parseReview, REVIEW_SYSTEM_PROMPT } from './review';
import { audioUri, loadInterviews, saveInterview, type Interview } from './store';

// Below this many characters there's nothing an interview review can say.
const MIN_TRANSCRIPT_CHARS = 200;

// Network/timeout failures (iOS suspends the app soon after it leaves the
// foreground, which kills in-flight requests) are marked retryable and
// resumed automatically when the user comes back; see describeError.

export async function processInterview(start: Interview, onUpdate: (i: Interview) => void) {
  let current = start;
  const update = (patch: Partial<Interview>) => {
    current = { ...current, ...patch };
    saveInterview(current);
    onUpdate(current);
  };
  // The screen shows only the plain message; analytics gets only the code.
  const fail = async (step: 'transcribe' | 'review', e: unknown) => {
    const d = await withConnectivity(describeError(e));
    analytics.track(step === 'transcribe' ? 'transcript_failed' : 'review_failed', {
      ...errorProps(d),
      auto_retry: d.retryable,
    });
    update({ status: 'failed', failedStep: step, error: d.userMessage, errorCode: d.code, retryable: d.retryable });
  };

  if (!current.transcript) {
    update({ status: 'transcribing', error: undefined, errorCode: undefined, failedStep: undefined, retryable: undefined });
    let transcript;
    try {
      transcript = await transcriber.transcribeFile(audioUri(current), {
        language: 'en',
        resumeJobId: current.transcriptJobId,
        onJobCreated: (transcriptJobId) => update({ transcriptJobId }),
      });
    } catch (e) {
      // A failed or expired job can't be resumed; the next attempt starts a new one.
      const code = e instanceof AIServiceError ? e.code : undefined;
      if (code === 'job_error' || code === '404') update({ transcriptJobId: undefined });
      await fail('transcribe', e);
      return;
    }
    const chars = transcript.segments.reduce((n, s) => n + s.text.length, 0);
    if (chars < MIN_TRANSCRIPT_CHARS) {
      analytics.track('transcript_no_speech', { duration_sec: Math.round(current.durationMs / 1000) });
      update({ status: 'no-speech' });
      return;
    }
    analytics.track('transcript_succeeded', {
      duration_sec: Math.round(current.durationMs / 1000),
      speakers: transcript.speakers.length,
    });
    update({ transcript });
  }

  update({ status: 'reviewing', error: undefined, errorCode: undefined, failedStep: undefined, retryable: undefined });
  try {
    // The resume, if the user added one, lets stronger answers use their real
    // experience instead of [placeholders].
    const background = await loadBackground();
    const earlierAreas = await areaNamesBefore(current.createdAt);
    const raw = await reviewer.complete({
      system: REVIEW_SYSTEM_PROMPT,
      prompt:
        (background?.text ? `CANDIDATE RESUME:\n${background.text}\n\n` : '') +
        (earlierAreas.length ? `AREA NAMES FROM EARLIER INTERVIEWS: ${earlierAreas.join(', ')}\n\n` : '') +
        `Transcript:\n${formatTranscript(current.transcript!)}`,
      json: true,
    });
    const review = parseReview(raw);
    analytics.track('review_succeeded', {
      questions: review.questions.length,
      has_resume: !!background?.text,
      round: review.interviewType?.round ?? 'unknown',
    });
    update({ status: 'done', review });
  } catch (e) {
    await fail('review', e);
  }
}

// Area names already used in earlier reviews (newest first), so the model reuses
// them for the same topics and scores can be compared across interviews.
async function areaNamesBefore(createdAt: number): Promise<string[]> {
  const names = new Set<string>();
  for (const i of await loadInterviews()) {
    if (i.createdAt >= createdAt) continue;
    for (const a of i.review?.areas ?? []) names.add(a.name);
  }
  return [...names].slice(0, 40);
}

// On launch, anything still "in progress" was interrupted by the app closing.
// Mark it retryable so it resumes automatically.
export function markInterrupted(i: Interview): Interview {
  // 'recorded' too: the app can close between saving the recording and starting.
  if (i.status !== 'recorded' && i.status !== 'transcribing' && i.status !== 'reviewing') return i;
  const fixed: Interview = {
    ...i,
    status: 'failed',
    failedStep: i.transcript ? 'review' : 'transcribe',
    error: 'Processing paused when the app closed. It continues automatically.',
    errorCode: 'interrupted',
    retryable: true,
  };
  saveInterview(fixed);
  return fixed;
}
