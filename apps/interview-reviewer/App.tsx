import { ConsentGate } from '@factory/consent';
import { StatusBar } from 'expo-status-bar';

import { analytics } from './src/analytics';
import { OnboardingQuestion } from './src/OnboardingQuestion';
import { RecordScreen } from './src/RecordScreen';

export default function App() {
  return (
    <>
      <OnboardingQuestion>
        <ConsentGate
          appName="Interview Reviewer"
          dataSent="your interview recordings and transcripts"
          consentVersion={1}
          onDecision={(d) => analytics.track(d === 'agreed' ? 'consent_agreed' : 'consent_declined')}
          recipients={[
            {
              name: 'Volcengine (ByteDance), China',
              purpose: 'Converts your recording into a transcript.',
            },
            {
              name: 'Baidu AI Cloud Qianfan, China',
              purpose: 'Analyzes the transcript to review your interview answers.',
            },
          ]}
        >
          <RecordScreen />
        </ConsentGate>
      </OnboardingQuestion>
      <StatusBar style="auto" />
    </>
  );
}
