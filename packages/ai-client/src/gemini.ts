// Google Gemini API (generateContent). Key sent in the x-goog-api-key header.
// Use a paid-tier key in production: free-tier data may be used by Google to
// improve its products.
import { AIServiceError, fetchWithTimeout } from './errors';
import type { TextModelProvider } from './index';

const VENDOR = 'Gemini';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
};

export function createGeminiTextModel(opts: { apiKey: string | undefined; model: string }): TextModelProvider {
  return {
    vendor: VENDOR,
    async complete({ system, prompt, json, signal }) {
      if (!opts.apiKey) throw new AIServiceError(VENDOR, 'API key is not configured', 'config');

      const res = await fetchWithTimeout(
        VENDOR,
        `${BASE}/${opts.model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              ...(json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        },
        // A 2-hour interview review took well under a minute in tests; leave room.
        4 * 60 * 1000,
        signal,
      );

      const body = (await res.json().catch(() => ({}))) as GenerateResponse;
      if (!res.ok) {
        throw new AIServiceError(VENDOR, `HTTP ${res.status}: ${body.error?.message ?? 'request failed'}`, String(res.status));
      }
      if (body.promptFeedback?.blockReason) {
        throw new AIServiceError(VENDOR, `request was blocked (${body.promptFeedback.blockReason})`, 'blocked');
      }
      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!text) {
        throw new AIServiceError(VENDOR, `response contained no content (${candidate?.finishReason ?? 'unknown'})`, 'empty');
      }
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new AIServiceError(VENDOR, 'response was cut off before it finished', 'truncated');
      }
      return text;
    },
  };
}
