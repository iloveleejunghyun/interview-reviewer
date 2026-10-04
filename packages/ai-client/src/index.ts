// Vendor-neutral AI interfaces. Apps depend on these types only, so swapping
// vendors (e.g. Volcengine/Qianfan -> others) means adding a new
// implementation here, not changing app code.

export type Speaker = { id: string; label?: string };

export type TranscriptSegment = {
  speakerId: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type Transcript = {
  language: string;
  speakers: Speaker[];
  segments: TranscriptSegment[];
};

export interface TranscriptionProvider {
  readonly vendor: string;
  // Long-form file transcription with speaker separation.
  transcribeFile(
    fileUri: string,
    opts: {
      language: string;
      signal?: AbortSignal;
      // Async vendors: called once the server-side job exists, so the caller
      // can persist it and resume polling after an interruption instead of
      // uploading (and paying for) the audio again.
      onJobCreated?: (jobId: string) => void;
      resumeJobId?: string;
    },
  ): Promise<Transcript>;
}

export interface TextModelProvider {
  readonly vendor: string;
  complete(req: {
    system: string;
    prompt: string;
    // Ask for JSON output when the vendor supports it.
    json?: boolean;
    signal?: AbortSignal;
  }): Promise<string>;
}

export { fileFormData } from './upload';
export { AIServiceError } from './errors';
export { createVolcengineTranscriber } from './volcengine';
export { createAssemblyAITranscriber } from './assemblyai';
export { createQianfanTextModel } from './qianfan';
