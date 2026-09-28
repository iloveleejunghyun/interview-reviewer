// The funnel from docs/idea-validation.md. Keep event names in sync with it.
import { createAnalytics } from '@factory/analytics';

type Events = {
  onboarding_answered: { expected_interviews: '0' | '1' | '2+' };
  consent_agreed: undefined;
  consent_declined: undefined;
  recording_started: undefined;
  recording_finished: { duration_sec: number };
  transcript_succeeded: { duration_sec: number; speakers: number };
  transcript_failed: { reason: string };
  review_opened: { interview_index: number };
};

export const analytics = createAnalytics<Events>({
  apiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
});
