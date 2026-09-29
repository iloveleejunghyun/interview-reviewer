import { ConsentGate } from '@factory/consent';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { analytics } from './src/analytics';
import { HomeScreen } from './src/HomeScreen';
import { InterviewScreen } from './src/InterviewScreen';
import { useInterviews } from './src/interviews/useInterviews';
import { OnboardingQuestion } from './src/OnboardingQuestion';

export default function App() {
  return (
    <SafeAreaProvider>
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
          <Main />
        </ConsentGate>
      </OnboardingQuestion>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

function Main() {
  const { interviews, loadError, addRecording, retry } = useInterviews();
  const [openId, setOpenId] = useState<string | null>(null);

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Couldn't load your interviews: {loadError}</Text>
      </View>
    );
  }
  if (!interviews) return <ActivityIndicator style={styles.center} />;

  const open = openId ? interviews.find((i) => i.id === openId) : undefined;
  if (open) {
    const oldestFirst = [...interviews].sort((a, b) => a.createdAt - b.createdAt);
    return (
      <InterviewScreen
        interview={open}
        index={oldestFirst.findIndex((i) => i.id === open.id) + 1}
        onBack={() => setOpenId(null)}
        onRetry={() => void retry(open)}
      />
    );
  }

  return (
    <HomeScreen
      interviews={interviews}
      onRecorded={addRecording}
      onOpen={(id) => {
        const item = interviews.find((i) => i.id === id);
        if (item?.status === 'failed') void retry(item);
        setOpenId(id);
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#d1242f', textAlign: 'center' },
});
