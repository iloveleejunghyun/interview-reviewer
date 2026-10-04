// Recording -> transcript (AssemblyAI) -> review (Qianfan). Each step's result
// is saved before the next starts, so a failure can be retried from where it
// stopped. Failures are stored with the real error message; nothing is faked.
import { AIServiceError, createAssemblyAITranscriber, createQianfanTextModel } from '@factory/ai-client';

import { analytics } from '../analytics';
import { formatTranscript, parseReview, REVIEW_SYSTEM_PROMPT } from './review';
import { audioUri, saveInterview, type Interview } from './store';

const transcriber = createAssemblyAITranscriber({
  apiKey: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY,
});
const reviewer = createQianfanTextModel({
  apiKey: process.env.EXPO_PUBLIC_QIANFAN_API_KEY,
  model: 'ernie-4.5-turbo-128k',
});

// Below this many characters there's nothing an interview review can say.
const MIN_TRANSCRIPT_CHARS = 200;

// iOS suspends the app soon after it leaves the foreground, which kills
// in-flight requests. Those failures (and app-closed interruptions) are
// retried automatically when the user comes back.
const isRetryable = (e: unknown) =>
  e instanceof AIServiceError && (e.code === 'network' || e.code === 'timeout');

export async function processInterview(start: Interview, onUpdate: (i: Interview) => void) {
  let current = start;
  const update = (patch: Partial<Interview>) => {
    current = { ...current, ...patch };
    saveInterview(current);
    onUpdate(current);
  };
  const fail = (step: 'transcribe' | 'review', e: unknown) =>
    update({ status: 'failed', failedStep: step, error: (e as Error).message, retryable: isRetryable(e) });

  if (!current.transcript) {
    update({ status: 'transcribing', error: undefined, failedStep: undefined, retryable: undefined });
    let transcript;
    try {
      transcript = await transcriber.transcribeFile(audioUri(current), {
        language: 'en',
        resumeJobId: current.transcriptJobId,
        onJobCreated: (transcriptJobId) => update({ transcriptJobId }),
      });
    } catch (e) {
      analytics.track('transcript_failed', { reason: (e as Error).message.slice(0, 200) });
      // A failed or expired job can't be resumed; the next attempt starts a new one.
      const code = e instanceof AIServiceError ? e.code : undefined;
      if (code === 'job_error' || code === '404') update({ transcriptJobId: undefined });
      fail('transcribe', e);
      return;
    }
    const chars = transcript.segments.reduce((n, s) => n + s.text.length, 0);
    if (chars < MIN_TRANSCRIPT_CHARS) {
      analytics.track('transcript_failed', { reason: 'no_speech' });
      update({ status: 'no-speech' });
      return;
    }
    analytics.track('transcript_succeeded', {
      duration_sec: Math.round(current.durationMs / 1000),
      speakers: transcript.speakers.length,
    });
    update({ transcript });
  }

  update({ status: 'reviewing', error: undefined, failedStep: undefined, retryable: undefined });
  try {
    const raw = await reviewer.complete({
      system: REVIEW_SYSTEM_PROMPT,
      prompt: `Transcript:\n${formatTranscript(current.transcript!)}`,
      json: true,
    });
    update({ status: 'done', review: parseReview(raw) });
  } catch (e) {
    fail('review', e);
  }
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
    error: 'Processing was interrupted when the app closed.',
    retryable: true,
  };
  saveInterview(fixed);
  return fixed;
}
