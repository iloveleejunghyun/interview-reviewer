import { useCallback, useEffect, useState } from 'react';

import { markInterrupted, processInterview } from './pipeline';
import { createInterview, loadInterviews, type Interview } from './store';

export function useInterviews() {
  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadInterviews()
      .then((items) => setInterviews(items.map(markInterrupted)))
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  const replace = useCallback((i: Interview) => {
    setInterviews((list) => (list ?? []).map((x) => (x.id === i.id ? i : x)));
  }, []);

  const process = useCallback((i: Interview) => processInterview(i, replace), [replace]);

  // Saves a finished recording and starts transcription + review right away.
  const addRecording = useCallback(
    async (uri: string, durationMs: number) => {
      const interview = await createInterview(uri, durationMs);
      setInterviews((list) => [interview, ...(list ?? [])]);
      void process(interview);
      return interview;
    },
    [process],
  );

  return { interviews, loadError, addRecording, retry: process };
}
