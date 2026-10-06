// AI vendors used by the app. Chosen 2026-10: AssemblyAI (transcription with
// speaker labels) and gemini-3.8-flash (review + resume reading), both US-based.
import { createAssemblyAITranscriber, createGeminiTextModel } from '@factory/ai-client';

export const transcriber = createAssemblyAITranscriber({
  apiKey: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY,
});

// Chosen over gemini-2.5-flash and Qianfan in side-by-side tests: no false
// "reconstructed" questions, small talk handled, no invented facts, fastest.
export const textModel = createGeminiTextModel({
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  model: 'gemini-3.8-flash',
});
