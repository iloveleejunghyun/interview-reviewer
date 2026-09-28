// Typed product-analytics wrapper around PostHog.
// Anonymous by design: SDK-generated install ID only, no IDFA, no autocapture,
// no session replay — so no App Tracking Transparency prompt is needed.
import PostHog from 'posthog-react-native';

type EventMap = Record<string, Record<string, string | number | boolean> | undefined>;

export type Analytics<E extends EventMap> = {
  track<K extends keyof E & string>(
    event: K,
    ...props: E[K] extends undefined ? [] : [E[K]]
  ): void;
  flush(): Promise<void>;
};

export function createAnalytics<E extends EventMap>(opts: {
  apiKey: string | undefined;
  host?: string;
}): Analytics<E> {
  if (!opts.apiKey) {
    // Visible in dev logs rather than silently pretending events are sent.
    console.warn('[analytics] No PostHog key set; events are logged locally only.');
    return {
      track: (event, ...props) => console.log('[analytics]', event, props[0] ?? {}),
      flush: async () => {},
    };
  }

  const client = new PostHog(opts.apiKey, {
    host: opts.host ?? 'https://us.i.posthog.com',
    captureAppLifecycleEvents: true,
    enableSessionReplay: false,
  });

  return {
    track: (event, ...props) => client.capture(event, props[0]),
    flush: () => client.flush(),
  };
}
