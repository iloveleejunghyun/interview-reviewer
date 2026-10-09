// Every failure is turned into (a) a plain message for the user and (b) a
// short code for analytics. Technical details never reach the screen, and
// free-text messages never reach analytics (they could contain user content).
import { AIServiceError } from '@factory/ai-client';
import * as Network from 'expo-network';

// Errors raised by the app itself, with a user-facing message already written.
export class AppError extends Error {
  constructor(
    readonly code: string,
    userMessage: string,
  ) {
    super(userMessage);
    this.name = 'AppError';
  }
}

export type DescribedError = {
  code: string;
  vendor?: string;
  httpStatus?: number;
  userMessage: string;
  // Temporary problems that are retried automatically.
  retryable: boolean;
};

const MSG = {
  network: "No internet connection. We'll try again automatically when you're back online.",
  unreachable: "Can't reach the service right now. We'll keep trying automatically.",
  timeout: "This is taking longer than usual. We'll try again automatically.",
  busy: 'The service is busy right now. Please try again in a few minutes.',
  ourSide: 'Something went wrong on our side. Please try again later. If it keeps happening, please contact support.',
  badOutput: "The review didn't come out right. Please tap Retry.",
  blocked: "A review couldn't be created for this recording. If it keeps happening, please contact support.",
  audio: "We couldn't process the audio in this recording. Please tap Retry.",
  fileMissing: 'The recording file is missing, so it can’t be processed.',
} as const;

export function describeError(e: unknown): DescribedError {
  if (e instanceof AppError) return { code: e.code, userMessage: e.message, retryable: false };

  if (e instanceof AIServiceError) {
    const vendor = e.vendor;
    const status = Number(e.code);
    if (Number.isInteger(status) && status >= 100) {
      if (status === 429) return { code: 'rate_limited', vendor, httpStatus: status, userMessage: MSG.busy, retryable: false };
      if (status >= 500) return { code: 'server_error', vendor, httpStatus: status, userMessage: MSG.busy, retryable: false };
      // 401/403 (bad key, billing) and other 4xx are our setup problems.
      return { code: 'request_rejected', vendor, httpStatus: status, userMessage: MSG.ourSide, retryable: false };
    }
    switch (e.code) {
      case 'network':
        return { code: 'network', vendor, userMessage: MSG.network, retryable: true };
      case 'timeout':
        return { code: 'timeout', vendor, userMessage: MSG.timeout, retryable: true };
      case 'blocked':
        return { code: 'blocked', vendor, userMessage: MSG.blocked, retryable: false };
      case 'empty':
      case 'truncated':
        return { code: e.code, vendor, userMessage: MSG.badOutput, retryable: false };
      case 'job_error':
        return { code: 'audio_error', vendor, userMessage: MSG.audio, retryable: false };
      case 'file':
        return { code: 'file_missing', vendor, userMessage: MSG.fileMissing, retryable: false };
      case 'config':
        return { code: 'not_configured', vendor, userMessage: MSG.ourSide, retryable: false };
    }
  }

  return { code: 'unknown', userMessage: MSG.ourSide, retryable: false };
}

// Analytics properties for a failure event: codes only, never free text.
export function errorProps(d: DescribedError) {
  return {
    code: d.code,
    ...(d.vendor ? { vendor: d.vendor } : {}),
    ...(d.httpStatus ? { http_status: d.httpStatus } : {}),
  };
}

// "No response" can mean the phone is offline, or that it's online but the
// service didn't answer (blocked network, iOS cutting the request while the
// app was in the background, outage). Check which, so the label is accurate.
export async function withConnectivity(d: DescribedError): Promise<DescribedError> {
  if (d.code !== 'network') return d;
  try {
    const state = await Network.getNetworkStateAsync();
    const offline = state.isConnected === false || state.isInternetReachable === false;
    return offline
      ? { ...d, code: 'offline', userMessage: MSG.network }
      : { ...d, code: 'unreachable', userMessage: MSG.unreachable };
  } catch {
    return d;
  }
}
