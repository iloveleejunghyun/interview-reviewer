// Add, view, replace or remove the resume-based background profile.
import { File } from 'expo-file-system';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analytics } from './analytics';
import { describeError, errorProps } from './errors';
import { formatDate } from './format';
import { learnFromResume, removeBackground, type Background } from './profile/background';

type Props = {
  background: Background | null;
  onChange: (b: Background | null) => void;
  onBack: () => void;
};

export function BackgroundScreen({ background, onChange, onBack }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    let picked;
    try {
      picked = await File.pickFileAsync({ mimeTypes: ['application/pdf'] });
    } catch (e) {
      analytics.track('resume_failed', { ...errorProps(describeError(e)), code: 'picker_failed' });
      setError("Couldn't open your files. Please try again.");
      return;
    }
    if (picked.canceled) return;
    setBusy(true);
    try {
      const b = await learnFromResume(picked.result);
      analytics.track(background ? 'resume_replaced' : 'resume_added');
      onChange(b);
    } catch (e) {
      const d = describeError(e);
      analytics.track('resume_failed', errorProps(d));
      setError(d.userMessage);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    removeBackground();
    analytics.track('resume_removed');
    onChange(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Interviews</Text>
        </Pressable>
        <Text style={styles.title}>Your background</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          Add your resume so stronger answers use your real projects and results. Your resume is read once by Google
          Gemini, which copies its text (without your name or contact details). Only that text is kept on your phone;
          the PDF is not stored.
        </Text>

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator />
            <Text style={styles.hint}>Reading your resume…</Text>
          </View>
        ) : (
          <Pressable style={styles.primary} onPress={pick}>
            <Text style={styles.primaryText}>{background ? 'Replace resume (PDF)' : 'Add resume (PDF)'}</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>PDF only. In Word, Pages or Google Docs, use Save as / Download as PDF.</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        {background && !busy && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resume text used in your reviews</Text>
            <Text style={styles.meta}>
              From {background.sourceName} · {formatDate(background.updatedAt)}
            </Text>
            <Text style={styles.body}>{background.text}</Text>
            <Pressable onPress={remove} hitSlop={8}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7f9' },
  header: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  back: { fontSize: 17, color: '#1f6feb' },
  title: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  body: { fontSize: 15, lineHeight: 21, color: '#333' },
  hint: { fontSize: 14, color: '#666' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  primary: { backgroundColor: '#1f6feb', padding: 14, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#d1242f', fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, color: '#888' },
  remove: { color: '#d1242f', fontSize: 15, marginTop: 6 },
});
