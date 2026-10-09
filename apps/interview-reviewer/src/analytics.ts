// The funnel from docs/idea-validation.md. Keep event names in sync with it.
// Failure events carry short codes from src/errors.ts, never free-text messages.
import { createAnalytics } from '@factory/analytics';

type ErrorProps = { code: string; vendor?: string; http_status?: number };

type Events = {
  onboarding_answered: { expected_interviews: '0' | '1' | '2+' };
  consent_agreed: undefined;
  consent_declined: undefined;
  recording_started: undefined;
  recording_finished: { duration_sec: number };
  recording_failed: ErrorProps & { stage: 'start' | 'save' };
  transcript_succeeded: { duration_sec: number; speakers: number };
  // Not an error: the recording had too little speech to review.
  transcript_no_speech: { duration_sec: number };
  transcript_failed: ErrorProps & { auto_retry: boolean };
  review_succeeded: { questions: number; has_resume: boolean; round: string };
  review_failed: ErrorProps & { auto_retry: boolean };
  review_opened: { interview_index: number };
  resume_added: undefined;
  resume_replaced: undefined;
  resume_removed: undefined;
  resume_failed: ErrorProps;
  interviews_load_failed: undefined;
};

export const analytics = createAnalytics<Events>({
  apiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
});
