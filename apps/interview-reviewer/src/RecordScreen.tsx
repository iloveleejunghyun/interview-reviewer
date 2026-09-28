// Record an interview. Transcription and review are not wired up yet; this
// screen says so plainly instead of showing placeholder results.
import { useRecorder, type Recording } from '@factory/recorder';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { analytics } from './analytics';

type Phase =
  | { kind: 'idle' }
  | { kind: 'no-permission' }
  | { kind: 'saved'; recording: Recording }
  | { kind: 'error'; message: string };

export function RecordScreen() {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const start = async () => {
    try {
      const res = await recorder.start();
      if (!res.ok) return setPhase({ kind: 'no-permission' });
      analytics.track('recording_started');
      setPhase({ kind: 'idle' });
    } catch (e) {
      setPhase({ kind: 'error', message: `Couldn't start recording: ${(e as Error).message}` });
    }
  };

  const stop = async () => {
    try {
      const recording = await recorder.stop();
      analytics.track('recording_finished', { duration_sec: Math.round(recording.durationMs / 1000) });
      setPhase({ kind: 'saved', recording });
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message });
    }
  };

  return (
    <View style={styles.container}>
      {!recorder.isRecording && (
        <Text style={styles.tip}>
          Put this phone near the speaker. Don't use headphones on your interview device.
        </Text>
      )}
      <Text style={styles.timer}>{formatMs(recorder.durationMs)}</Text>
      <Pressable
        style={[styles.button, recorder.isRecording && styles.buttonStop]}
        onPress={recorder.isRecording ? stop : start}
      >
        <Text style={styles.buttonText}>{recorder.isRecording ? 'Stop' : 'Record interview'}</Text>
      </Pressable>
      {recorder.isRecording && (
        <Text style={styles.info}>You can lock your screen. Recording continues.</Text>
      )}

      {phase.kind === 'no-permission' && (
        <View style={styles.box}>
          <Text style={styles.info}>Microphone access is off. Turn it on in Settings to record.</Text>
          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={styles.link}>Open Settings</Text>
          </Pressable>
        </View>
      )}
      {phase.kind === 'error' && <Text style={[styles.info, styles.error]}>{phase.message}</Text>}
      {phase.kind === 'saved' && (
        <Text style={styles.info}>
          Saved {formatMs(phase.recording.durationMs)} recording. Transcription isn't connected yet.
        </Text>
      )}
    </View>
  );
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  tip: { fontSize: 15, color: '#555', textAlign: 'center' },
  timer: { fontSize: 48, fontVariant: ['tabular-nums'], fontWeight: '300' },
  button: { backgroundColor: '#1f6feb', paddingVertical: 16, paddingHorizontal: 28, borderRadius: 999 },
  buttonStop: { backgroundColor: '#d1242f' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  box: { alignItems: 'center', gap: 6 },
  info: { fontSize: 16, color: '#333', textAlign: 'center' },
  error: { color: '#d1242f' },
  link: { fontSize: 16, color: '#1f6feb' },
});
