import * as Sentry from "@sentry/react-native";

/**
 * Crash / error monitoring (Sentry) setup.
 *
 * A single `@sentry/react-native` import covers native (iOS/Android) and the
 * Expo web/PWA build — on web it transparently falls back to the browser
 * transport. PostHog (product analytics) is wired separately via
 * `<PostHogProvider>` in `app/_layout.tsx`.
 *
 * Config lives in the repo-root `.env.local` as client-exposed vars:
 *   EXPO_PUBLIC_SENTRY_DSN   — enables Sentry when set (no-ops if absent)
 *   EXPO_PUBLIC_POSTHOG_KEY  — PostHog project API key
 *   EXPO_PUBLIC_POSTHOG_HOST — PostHog host (default https://us.i.posthog.com)
 */

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

export const sentryEnabled = SENTRY_DSN.length > 0;

/**
 * Navigation integration — attach to the Expo Router instrumentation so
 * transactions/breadcrumbs carry the current screen. Exported so the root
 * layout can register the navigation container.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry() {
  if (!sentryEnabled) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    // Health/fitness app — keep PII off by default; we set an opaque user id
    // (our Convex users._id) via `identifyUser`, never email/name.
    sendDefaultPii: false,
    environment: __DEV__ ? "development" : "production",
    // Sample everything in dev, dial back in prod to control volume.
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    integrations: [navigationIntegration],
    // Enabled whenever a DSN is present (see early return above). Dev vs prod
    // events are separated by the `environment` tag, so you can test locally
    // and still filter dev noise out of the prod view.
  });
}

/** Tie subsequent errors/events to a user. Pass our Convex users._id. */
export function identifyUser(userId: string) {
  if (!sentryEnabled) return;
  Sentry.setUser({ id: userId });
}

/** Clear the user on sign-out. */
export function clearUser() {
  if (!sentryEnabled) return;
  Sentry.setUser(null);
}

/** Manually report a caught error (e.g. from an ErrorBoundary). */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!sentryEnabled) {
    console.error("[monitoring:disabled]", error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
