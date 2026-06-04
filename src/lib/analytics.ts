import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";
  try {
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      autocapture: false,
    });
    initialized = true;
  } catch (err) {
    // Silent — analytics never breaks the app
    console.warn("[analytics] init failed", err);
  }
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* ignore */
  }
}