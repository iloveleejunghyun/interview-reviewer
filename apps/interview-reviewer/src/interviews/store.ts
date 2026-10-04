// Interviews persist as one JSON file each in the document directory, next to
// the audio. Audio is referenced by file name, not absolute URI: the app's
// container path can change between installs/updates on iOS.
import type { Transcript } from '@factory/ai-client';
import { Directory, File, Paths } from 'expo-file-system';

import type { Review } from './review';

// 'no-speech': too little speech to review. Final, not an error: retrying
// would send the same audio and get the same result.
export type InterviewStatus = 'recorded' | 'transcribing' | 'reviewing' | 'done' | 'failed' | 'no-speech';

export type Interview = {
  id: string;
  createdAt: number;
  durationMs: number;
  audioFile: string;
  status: InterviewStatus;
  error?: string;
  // Step that failed, so Retry resumes there instead of starting over.
  failedStep?: 'transcribe' | 'review';
  // Network/timeout/interrupted failures; retried automatically when the app
  // is back in the foreground.
  retryable?: boolean;
  // Server-side transcription job, so an interrupted transcription resumes
  // polling instead of uploading the audio again.
  transcriptJobId?: string;
  transcript?: Transcript;
  review?: Review;
};

const dir = () => new Directory(Paths.document, 'interviews');
const metaFile = (id: string) => new File(dir(), `${id}.json`);

export const audioUri = (i: Interview) => new File(dir(), i.audioFile).uri;

function ensureDir() {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
}

export function saveInterview(i: Interview) {
  ensureDir();
  const f = metaFile(i.id);
  if (!f.exists) f.create();
  f.write(JSON.stringify(i));
}

// Moves a finished recording into the interviews folder and creates its record.
export async function createInterview(recordingUri: string, durationMs: number): Promise<Interview> {
  ensureDir();
  const id = `${Date.now()}`;
  const audioFile = `${id}.m4a`;
  await new File(recordingUri).move(new File(dir(), audioFile));
  const interview: Interview = { id, createdAt: Date.now(), durationMs, audioFile, status: 'recorded' };
  saveInterview(interview);
  return interview;
}

export async function loadInterviews(): Promise<Interview[]> {
  ensureDir();
  const items: Interview[] = [];
  for (const entry of dir().list()) {
    if (!(entry instanceof File) || !entry.name.endsWith('.json')) continue;
    try {
      items.push(JSON.parse(await entry.text()) as Interview);
    } catch {
      // A corrupt record shouldn't hide the others; skip it.
    }
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}
