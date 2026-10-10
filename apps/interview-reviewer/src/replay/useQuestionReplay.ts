// Play the recording for one question at a time: from just before the
// interviewer asks it until the next question starts.
import type { Transcript } from '@factory/ai-client';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ReviewedQuestion } from '../interviews/review';

// Start a little early so the question isn't cut off mid-word.
const LEAD_IN_MS = 1500;
// The model's "mm:ss" can be a few seconds off; snap to a real transcript line
// only if one starts this close.
const SNAP_WINDOW_MS = 10_000;

export type Clip = { startMs: number; endMs?: number };

const parseMmss = (t: string) => {
  const m = /^(\d+):(\d{2})$/.exec(t.trim());
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : null;
};

// One clip per question (same order as `questions`; null if it has no usable time).
export function questionClips(questions: ReviewedQuestion[], transcript?: Transcript): (Clip | null)[] {
  const lineStarts = (transcript?.segments ?? []).map((s) => s.startMs);
  const starts = questions.map((q) => {
    const t = parseMmss(q.timestamp);
    if (t === null) return null;
    let best = t;
    let bestDist = SNAP_WINDOW_MS + 1;
    for (const s of lineStarts) {
      const d = Math.abs(s - t);
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  });
  return starts.map((start, i) => {
    if (start === null) return null;
    // Ends where the next later question begins (questions are listed in order).
    const next = starts.slice(i + 1).find((s): s is number => s !== null && s > start);
    return { startMs: Math.max(0, start - LEAD_IN_MS), endMs: next };
  });
}

export function useQuestionReplay(audioUri: string | null) {
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [active, setActive] = useState<{ index: number; clip: Clip } | null>(null);

  const playClip = useCallback(
    async (index: number, clip: Clip) => {
      // Recording may have left the session in record mode; playback needs this.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      await player.seekTo(clip.startMs / 1000);
      player.play();
      setActive({ index, clip });
    },
    [player],
  );

  // Stop at the end of the question's clip.
  useEffect(() => {
    const end = active?.clip.endMs;
    if (status.playing && end !== undefined && status.currentTime * 1000 >= end) player.pause();
  }, [status.currentTime, status.playing, active, player]);

  const toggle = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else if (active) {
      // Resuming after the clip ended restarts that question.
      const ended = active.clip.endMs !== undefined && status.currentTime * 1000 >= active.clip.endMs - 300;
      if (ended || status.didJustFinish) void playClip(active.index, active.clip);
      else player.play();
    }
  }, [status.playing, status.currentTime, status.didJustFinish, active, player, playClip]);

  // Keep seeks inside the current question's clip.
  const clipEndMs = active?.clip.endMs ?? status.duration * 1000;
  const seekToMs = useCallback(
    (ms: number) => {
      if (!active) return;
      const clamped = Math.min(Math.max(ms, active.clip.startMs), Math.max(active.clip.startMs, clipEndMs - 300));
      void player.seekTo(clamped / 1000);
    },
    [player, active, clipEndMs],
  );

  const STEP_MS = 5000;
  const back = useCallback(() => seekToMs(status.currentTime * 1000 - STEP_MS), [seekToMs, status.currentTime]);
  const forward = useCallback(() => seekToMs(status.currentTime * 1000 + STEP_MS), [seekToMs, status.currentTime]);

  const close = useCallback(() => {
    player.pause();
    setActive(null);
  }, [player]);

  return useMemo(
    () => ({
      available: !!audioUri,
      activeIndex: active?.index ?? null,
      clip: active?.clip ?? null,
      clipEndMs,
      playing: status.playing,
      currentMs: status.currentTime * 1000,
      durationMs: status.duration * 1000,
      playClip,
      toggle,
      back,
      forward,
      seekToMs,
      close,
    }),
    [audioUri, active, clipEndMs, status.playing, status.currentTime, status.duration, playClip, toggle, back, forward, seekToMs, close],
  );
}
