// Long-form recording that keeps running with the screen locked.
// Apps using this must set `enableBackgroundRecording: true` in the expo-audio
// config plugin, which adds the iOS `audio` background mode.
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback } from 'react';

export type StartResult = { ok: true } | { ok: false; reason: 'permission-denied' };
export type Recording = { uri: string; durationMs: number };

export function useRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  const start = useCallback(async (): Promise<StartResult> => {
    // Ask at the moment of use, after consent, never on launch.
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'permission-denied' };
    await setAudioModeAsync({
      allowsRecording: true,
      allowsBackgroundRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return { ok: true };
  }, [recorder]);

  // Throws if the recorder produced no file; callers show that error as-is.
  const stop = useCallback(async (): Promise<Recording> => {
    const durationMs = state.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({
      allowsRecording: false,
      allowsBackgroundRecording: false,
      playsInSilentMode: true,
    });
    if (!recorder.uri) throw new Error('Recording produced no file.');
    return { uri: recorder.uri, durationMs };
  }, [recorder, state.durationMillis]);

  return {
    start,
    stop,
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
  };
}
