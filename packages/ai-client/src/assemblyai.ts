// AssemblyAI async transcription: upload -> submit job -> poll until done.
// Verified 2026-10-04 on a two-voice mock interview: all questions captured,
// speakers labeled correctly (universal-3-5-pro), ~10 s for a 1-minute file.
import { File } from 'expo-file-system';

import { AIServiceError, fetchWithTimeout } from './errors';
import type { Transcript, TranscriptionProvider } from './index';

const VENDOR = 'AssemblyAI';
const BASE = 'https://api.assemblyai.com/v2';
const POLL_MS = 3000;
// Processing is roughly real-time / 10; an hour of audio takes a few minutes.
const MAX_WAIT_MS = 15 * 60 * 1000;

type TranscriptResponse = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  error?: string;
  language_code?: string;
  utterances?: { speaker: string; start: number; end: number; text: string }[] | null;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new AIServiceError(VENDOR, 'cancelled', 'aborted'));
    });
  });

export function createAssemblyAITranscriber(opts: { apiKey: string | undefined }): TranscriptionProvider {
  const auth = () => {
    if (!opts.apiKey) throw new AIServiceError(VENDOR, 'API key is not configured', 'config');
    return { authorization: opts.apiKey };
  };

  async function json<T>(res: Response): Promise<T> {
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new AIServiceError(VENDOR, `HTTP ${res.status}: ${body.error ?? 'request failed'}`, String(res.status));
    }
    return body;
  }

  async function submit(fileUri: string, language: string, signal?: AbortSignal): Promise<string> {
    const file = new File(fileUri);
    if (!file.exists) throw new AIServiceError(VENDOR, 'recording file not found', 'file');
    const upload = await json<{ upload_url: string }>(
      await fetchWithTimeout(
        VENDOR,
        `${BASE}/upload`,
        {
          method: 'POST',
          headers: { ...auth(), 'content-type': 'application/octet-stream' },
          body: await file.bytes(),
        },
        5 * 60 * 1000,
        signal,
      ),
    );
    const job = await json<TranscriptResponse>(
      await fetchWithTimeout(
        VENDOR,
        `${BASE}/transcript`,
        {
          method: 'POST',
          headers: { ...auth(), 'content-type': 'application/json' },
          body: JSON.stringify({ audio_url: upload.upload_url, speaker_labels: true, language_code: language }),
        },
        60 * 1000,
        signal,
      ),
    );
    return job.id;
  }

  return {
    vendor: VENDOR,
    async transcribeFile(fileUri, { language, signal, onJobCreated, resumeJobId }) {
      let jobId = resumeJobId;
      if (!jobId) {
        jobId = await submit(fileUri, language, signal);
        onJobCreated?.(jobId);
      }

      const started = Date.now();
      for (;;) {
        const r = await json<TranscriptResponse>(
          await fetchWithTimeout(VENDOR, `${BASE}/transcript/${jobId}`, { headers: auth() }, 60 * 1000, signal),
        );
        if (r.status === 'error') throw new AIServiceError(VENDOR, r.error ?? 'transcription failed', 'job_error');
        if (r.status === 'completed') {
          const segments = (r.utterances ?? []).map((u) => ({
            speakerId: u.speaker,
            startMs: u.start,
            endMs: u.end,
            text: u.text.trim(),
          }));
          const speakers = [...new Set(segments.map((s) => s.speakerId))].map((id) => ({ id }));
          return { language: r.language_code ?? language, speakers, segments } satisfies Transcript;
        }
        if (Date.now() - started > MAX_WAIT_MS) {
          throw new AIServiceError(VENDOR, 'transcription is taking too long', 'timeout');
        }
        await sleep(POLL_MS, signal);
      }
    },
  };
}
