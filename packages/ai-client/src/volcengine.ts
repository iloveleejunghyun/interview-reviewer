// Volcengine (Doubao) "大模型录音文件极速版" (flash) file transcription.
// The whole file is sent inline as base64. Not in the published docs, but
// verified 2026-09-29: a 56-minute 16 kHz mono AAC file (13 MB) returned in
// 42 s with speaker labels. Documented audio length limit: 2 hours.
import { File } from 'expo-file-system';

import { AIServiceError, fetchWithTimeout } from './errors';
import type { Transcript, TranscriptionProvider } from './index';

const VENDOR = 'Volcengine';
const URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
const RESOURCE_ID = 'volc.bigasr.auc_turbo';
// 20000003 = recognized fine but no speech in the audio: an empty transcript,
// not a service failure.
const OK = '20000000';
const NO_SPEECH = '20000003';

type FlashResponse = {
  result?: {
    text?: string;
    utterances?: {
      text: string;
      start_time: number;
      end_time: number;
      additions?: { speaker?: string };
    }[];
  };
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createVolcengineTranscriber(opts: { apiKey: string | undefined }): TranscriptionProvider {
  return {
    vendor: VENDOR,
    async transcribeFile(fileUri, { signal }) {
      if (!opts.apiKey) throw new AIServiceError(VENDOR, 'API key is not configured', 'config');

      const file = new File(fileUri);
      if (!file.exists) throw new AIServiceError(VENDOR, 'recording file not found', 'file');
      const data = await file.base64();

      const res = await fetchWithTimeout(
        VENDOR,
        URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': opts.apiKey,
            'X-Api-Resource-Id': RESOURCE_ID,
            'X-Api-Request-Id': uuid(),
            'X-Api-Sequence': '-1',
          },
          body: JSON.stringify({
            user: { uid: 'interview-reviewer' },
            audio: { data, format: 'm4a' },
            request: {
              model_name: 'bigmodel',
              enable_itn: true,
              enable_punc: true,
              enable_speaker_info: true,
            },
          }),
        },
        // Upload of ~15-20 MB plus ~45 s processing for an hour of audio.
        5 * 60 * 1000,
        signal,
      );

      const status = res.headers.get('x-api-status-code');
      if (!res.ok) throw new AIServiceError(VENDOR, `HTTP ${res.status}: ${await res.text()}`, String(res.status));
      if (status === NO_SPEECH) return { language: 'en', speakers: [], segments: [] };
      if (status !== OK) {
        throw new AIServiceError(VENDOR, `error ${status}: ${res.headers.get('x-api-message') ?? 'recognition failed'}`, status ?? undefined);
      }

      const body = (await res.json()) as FlashResponse;
      const segments = (body.result?.utterances ?? []).map((u) => ({
        speakerId: u.additions?.speaker ?? '?',
        startMs: u.start_time,
        endMs: u.end_time,
        text: u.text.trim(),
      }));
      const speakers = [...new Set(segments.map((s) => s.speakerId))].map((id) => ({ id }));
      return { language: 'en', speakers, segments } satisfies Transcript;
    },
  };
}
