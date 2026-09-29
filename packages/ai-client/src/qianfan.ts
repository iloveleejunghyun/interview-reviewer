// Baidu Qianfan v2 chat completions (OpenAI-compatible, single Bearer key).
import { AIServiceError, fetchWithTimeout } from './errors';
import type { TextModelProvider } from './index';

const VENDOR = 'Qianfan';
const URL = 'https://qianfan.baidubce.com/v2/chat/completions';

type ChatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
};

export function createQianfanTextModel(opts: { apiKey: string | undefined; model: string }): TextModelProvider {
  return {
    vendor: VENDOR,
    async complete({ system, prompt, json, signal }) {
      if (!opts.apiKey) throw new AIServiceError(VENDOR, 'API key is not configured', 'config');

      const res = await fetchWithTimeout(
        VENDOR,
        URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
          body: JSON.stringify({
            model: opts.model,
            temperature: 0.3,
            ...(json ? { response_format: { type: 'json_object' } } : {}),
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
          }),
        },
        // Long interviews produce long reviews; a 1-minute test took ~30 s.
        4 * 60 * 1000,
        signal,
      );

      const body = (await res.json().catch(() => ({}))) as ChatResponse;
      if (!res.ok) {
        throw new AIServiceError(VENDOR, `HTTP ${res.status}: ${body.error?.message ?? 'request failed'}`, body.error?.code ?? String(res.status));
      }
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new AIServiceError(VENDOR, 'response contained no content', 'empty');
      return content;
    },
  };
}
