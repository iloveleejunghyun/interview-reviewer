import { ConsentGate } from '@factory/consent';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { analytics } from './src/analytics';
import { BackgroundScreen } from './src/BackgroundScreen';
import { HomeScreen } from './src/HomeScreen';
import { InterviewScreen } from './src/InterviewScreen';
import { useInterviews } from './src/interviews/useInterviews';
import { OnboardingQuestion } from './src/OnboardingQuestion';
import { loadBackground, type Background } from './src/profile/background';

export default function App() {
  return (
    <SafeAreaProvider>
      <OnboardingQuestion>
        <ConsentGate
          appName="InterviewEcho"
          dataSent="your interview recordings, transcripts, and resume (if you add one)"
          consentVersion={4}
          onDecision={(d) => analytics.track(d === 'agreed' ? 'consent_agreed' : 'consent_declined')}
          recipients={[
            {
              name: 'AssemblyAI, United States',
              purpose: 'Converts your recording into a transcript.',
            },
            {
              name: 'Google Gemini, United States',
              purpose: 'Reads your resume (if you add one) and the transcript to review your interview answers.',
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
  const [showBackground, setShowBackground] = useState(false);
  const [background, setBackground] = useState<Background | null>(null);

  useEffect(() => {
    loadBackground().then(setBackground);
  }, []);

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Couldn't load your interviews: {loadError}</Text>
      </View>
    );
  }
  if (!interviews) return <ActivityIndicator style={styles.center} />;

  if (showBackground) {
    return (
      <BackgroundScreen background={background} onChange={setBackground} onBack={() => setShowBackground(false)} />
    );
  }

  const open = openId ? interviews.find((i) => i.id === openId) : undefined;
  if (open) {
    const oldestFirst = [...interviews].sort((a, b) => a.createdAt - b.createdAt);
    // Latest earlier score for each area name.
    const previousScores = new Map<string, number>();
    for (const i of oldestFirst) {
      if (i.createdAt >= open.createdAt) break;
      for (const a of i.review?.areas ?? []) previousScores.set(a.name, a.score);
    }
    return (
      <InterviewScreen
        interview={open}
        index={oldestFirst.findIndex((i) => i.id === open.id) + 1}
        previousScores={previousScores}
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
      hasBackground={!!background}
      onOpenBackground={() => setShowBackground(true)}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#d1242f', textAlign: 'center' },
});
