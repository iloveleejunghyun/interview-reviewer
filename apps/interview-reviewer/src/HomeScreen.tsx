// Record a new interview, and see past ones with their processing status.
import { useRecorder } from '@factory/recorder';
import { useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analytics } from './analytics';
import { formatDate, formatDuration } from './format';
import type { Interview, InterviewStatus } from './interviews/store';

const STATUS_LABEL: Record<InterviewStatus, string> = {
  recorded: 'Waiting…',
  transcribing: 'Transcribing…',
  reviewing: 'Reviewing…',
  done: 'Review ready',
  failed: 'Failed. Tap to retry',
};

type Props = {
  interviews: Interview[];
  onRecorded: (uri: string, durationMs: number) => Promise<unknown>;
  onOpen: (id: string) => void;
};

export function HomeScreen({ interviews, onRecorded, onOpen }: Props) {
  const recorder = useRecorder();
  const [message, setMessage] = useState<{ text: string; settings?: boolean } | null>(null);

  const start = async () => {
    setMessage(null);
    try {
      const res = await recorder.start();
      if (!res.ok) {
        setMessage({ text: 'Microphone access is off. Turn it on in Settings to record.', settings: true });
        return;
      }
      analytics.track('recording_started');
    } catch (e) {
      setMessage({ text: `Couldn't start recording: ${(e as Error).message}` });
    }
  };

  const stop = async () => {
    try {
      const recording = await recorder.stop();
      analytics.track('recording_finished', { duration_sec: Math.round(recording.durationMs / 1000) });
      await onRecorded(recording.uri, recording.durationMs);
    } catch (e) {
      setMessage({ text: `Couldn't save the recording: ${(e as Error).message}` });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.recorder}>
        <Text style={styles.timer}>{formatDuration(recorder.durationMs)}</Text>
        <Pressable
          style={[styles.button, recorder.isRecording && styles.buttonStop]}
          onPress={recorder.isRecording ? stop : start}
        >
          <Text style={styles.buttonText}>{recorder.isRecording ? 'Stop' : 'Record interview'}</Text>
        </Pressable>
        <Text style={styles.tip}>
          {recorder.isRecording
            ? 'You can lock your screen. Recording continues.'
            : "Put this phone near the speaker. Don't use headphones on your interview device."}
        </Text>
        {message && (
          <View style={styles.message}>
            <Text style={styles.error}>{message.text}</Text>
            {message.settings && (
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={styles.link}>Open Settings</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={interviews}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={interviews.length > 0 ? <Text style={styles.heading}>Your interviews</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onOpen(item.id)}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.rowSub}>{formatDuration(item.durationMs)}</Text>
            </View>
            <Text style={[styles.status, item.status === 'failed' && styles.error, item.status === 'done' && styles.ready]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  recorder: { alignItems: 'center', gap: 14, paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  timer: { fontSize: 48, fontVariant: ['tabular-nums'], fontWeight: '300' },
  button: { backgroundColor: '#1f6feb', paddingVertical: 16, paddingHorizontal: 28, borderRadius: 999 },
  buttonStop: { backgroundColor: '#d1242f' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  tip: { fontSize: 14, color: '#666', textAlign: 'center' },
  message: { alignItems: 'center', gap: 6 },
  error: { color: '#d1242f' },
  link: { fontSize: 16, color: '#1f6feb' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  heading: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowSub: { fontSize: 14, color: '#666' },
  status: { fontSize: 14, color: '#666' },
  ready: { color: '#1a7f37', fontWeight: '600' },
});
