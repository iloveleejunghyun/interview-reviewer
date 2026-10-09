import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { analytics } from '../analytics';
import { markInterrupted, processInterview } from './pipeline';
import { createInterview, loadInterviews, type Interview } from './store';

// Automatic retries per interview per app session, so being offline can't
// cause an endless loop. Manual Retry is always available after that.
const MAX_AUTO_RETRIES = 3;

export function useInterviews() {
  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const autoRetries = useRef(new Map<string, number>());
  const latest = useRef<Interview[]>([]);

  // `latest` mirrors state synchronously so async code never reads a stale list.
  const commit = useCallback((next: Interview[]) => {
    latest.current = next;
    setInterviews(next);
  }, []);

  const replace = useCallback(
    (i: Interview) => commit(latest.current.map((x) => (x.id === i.id ? i : x))),
    [commit],
  );

  const process = useCallback(
    async (i: Interview) => {
      if (inFlight.current.has(i.id)) return;
      inFlight.current.add(i.id);
      try {
        await processInterview(i, replace);
      } finally {
        inFlight.current.delete(i.id);
      }
      // A request killed while suspended often fails just *after* the app
      // becomes active again, so the foreground listener already missed it.
      const after = latest.current.find((x) => x.id === i.id);
      if (after?.status === 'failed' && after.retryable && AppState.currentState === 'active') {
        setTimeout(() => resumeRef.current(), 2000);
      }
    },
    [replace],
  );
  const resumeRef = useRef<() => void>(() => {});

  // Resume interviews that failed only because the app was suspended or closed.
  const resumeRetryable = useCallback(() => {
    for (const i of latest.current) {
      if (i.status !== 'failed' || !i.retryable || inFlight.current.has(i.id)) continue;
      const n = autoRetries.current.get(i.id) ?? 0;
      if (n >= MAX_AUTO_RETRIES) continue;
      autoRetries.current.set(i.id, n + 1);
      void process(i);
    }
  }, [process]);
  resumeRef.current = resumeRetryable;

  useEffect(() => {
    loadInterviews()
      .then((items) => {
        commit(items.map(markInterrupted));
        resumeRetryable();
      })
      .catch(() => {
        analytics.track('interviews_load_failed');
        setLoadError("Couldn't load your interviews. Please restart the app.");
      });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resumeRetryable();
    });
    return () => sub.remove();
  }, [commit, resumeRetryable]);

  // Saves a finished recording and starts transcription + review right away.
  const addRecording = useCallback(
    async (uri: string, durationMs: number) => {
      const interview = await createInterview(uri, durationMs);
      commit([interview, ...latest.current]);
      void process(interview);
      return interview;
    },
    [commit, process],
  );

  return { interviews, loadError, addRecording, retry: process };
}
