// Thrown for any vendor failure. `message` is safe to show to the user as-is:
// failures are reported honestly, never replaced with placeholder output.
export class AIServiceError extends Error {
  constructor(
    readonly vendor: string,
    message: string,
    readonly code?: string,
  ) {
    super(`${vendor}: ${message}`);
    this.name = 'AIServiceError';
  }
}

export async function fetchWithTimeout(
  vendor: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new AIServiceError(vendor, `request timed out after ${Math.round(timeoutMs / 1000)}s`, 'timeout');
    }
    throw new AIServiceError(vendor, `network error: ${(e as Error).message}`, 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
