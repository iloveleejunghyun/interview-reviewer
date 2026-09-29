// Recording -> transcript (Volcengine) -> review (Qianfan). Each step's result
// is saved before the next starts, so a failure can be retried from where it
// stopped. Failures are stored with the real error message; nothing is faked.
import { createQianfanTextModel, createVolcengineTranscriber } from '@factory/ai-client';

import { analytics } from '../analytics';
import { formatTranscript, parseReview, REVIEW_SYSTEM_PROMPT } from './review';
import { audioUri, saveInterview, type Interview } from './store';

const transcriber = createVolcengineTranscriber({
  apiKey: process.env.EXPO_PUBLIC_VOLCENGINE_ASR_API_KEY,
});
const reviewer = createQianfanTextModel({
  apiKey: process.env.EXPO_PUBLIC_QIANFAN_API_KEY,
  model: 'ernie-4.5-turbo-128k',
});

// Below this many characters there's nothing an interview review can say.
const MIN_TRANSCRIPT_CHARS = 200;

export async function processInterview(start: Interview, onUpdate: (i: Interview) => void) {
  let current = start;
  const update = (patch: Partial<Interview>) => {
    current = { ...current, ...patch };
    saveInterview(current);
    onUpdate(current);
  };

  if (!current.transcript) {
    update({ status: 'transcribing', error: undefined, failedStep: undefined });
    try {
      const transcript = await transcriber.transcribeFile(audioUri(current), { language: 'en' });
      const chars = transcript.segments.reduce((n, s) => n + s.text.length, 0);
      if (chars < MIN_TRANSCRIPT_CHARS) {
        throw new Error(
          chars === 0
            ? 'No speech was detected in this recording.'
            : 'Too little speech was detected to review. Was the phone close to the speaker?',
        );
      }
      analytics.track('transcript_succeeded', {
        duration_sec: Math.round(current.durationMs / 1000),
        speakers: transcript.speakers.length,
      });
      update({ transcript });
    } catch (e) {
      analytics.track('transcript_failed', { reason: (e as Error).message.slice(0, 200) });
      update({ status: 'failed', failedStep: 'transcribe', error: (e as Error).message });
      return;
    }
  }

  update({ status: 'reviewing', error: undefined, failedStep: undefined });
  try {
    const raw = await reviewer.complete({
      system: REVIEW_SYSTEM_PROMPT,
      prompt: `Transcript:\n${formatTranscript(current.transcript!)}`,
      json: true,
    });
    update({ status: 'done', review: parseReview(raw) });
  } catch (e) {
    update({ status: 'failed', failedStep: 'review', error: (e as Error).message });
  }
}

// Requests don't survive the app being killed or suspended mid-step. On
// launch, anything still "in progress" was interrupted: mark it retryable.
export function markInterrupted(i: Interview): Interview {
  if (i.status !== 'transcribing' && i.status !== 'reviewing') return i;
  const fixed: Interview = {
    ...i,
    status: 'failed',
    failedStep: i.transcript ? 'review' : 'transcribe',
    error: 'Processing was interrupted when the app closed.',
  };
  saveInterview(fixed);
  return fixed;
}
