// One question that makes the validation metric measurable: only users who
// expect another interview can "review a second interview within 14 days".
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { analytics } from './analytics';

const KEY = 'onboarding_expected_interviews';
const OPTIONS = ['0', '1', '2+'] as const;

export function OnboardingQuestion({ children }: { children: ReactNode }) {
  const [answered, setAnswered] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => setAnswered(v !== null))
      .catch(() => setAnswered(false));
  }, []);

  const answer = async (value: (typeof OPTIONS)[number]) => {
    await SecureStore.setItemAsync(KEY, value);
    analytics.track('onboarding_answered', { expected_interviews: value });
    setAnswered(true);
  };

  if (answered === null) return <ActivityIndicator style={styles.center} />;
  if (answered) return <>{children}</>;

  return (
    <View style={[styles.center, styles.pad]}>
      <Text style={styles.title}>How many interviews do you expect in the next 2 weeks?</Text>
      {OPTIONS.map((o) => (
        <Pressable key={o} style={styles.option} onPress={() => answer(o)}>
          <Text style={styles.optionText}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  pad: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  option: { padding: 16, borderRadius: 10, backgroundColor: '#f2f4f7', alignItems: 'center' },
  optionText: { fontSize: 18, fontWeight: '600' },
});
