import { Stack, useRouter, useSegments, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, useColorScheme, View, StyleSheet } from "react-native";
import { unlockAudioContext } from "@/utils/audio";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { WorkoutProvider } from "@/hooks/useWorkoutStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { api } from "@/convex/_generated/api";
import { tokenCache } from "@/utils/tokenCache";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Sentry,
  initSentry,
  navigationIntegration,
  identifyUser,
} from "@/utils/monitoring";
import { useFonts,
  CormorantGaramond_300Light,
  CormorantGaramond_300Light_Italic,
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Outfit_200ExtraLight,
  Outfit_300Light,
  Outfit_400Regular,
} from "@expo-google-fonts/outfit";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// posthog-react-native looks for expo-file-system / async-storage for
// persistence — neither exists on web, so it throws "No storage available".
// Back it with localStorage on web. Guarded because Expo web uses static
// server rendering, where `localStorage` is undefined during the SSR pass.
const webPostHogStorage = {
  getItem: (key: string) => {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    } catch {
      // ignore (private mode / quota / SSR)
    }
  },
};

const convex = new ConvexReactClient(CONVEX_URL);

// Initialize crash monitoring as early as possible (no-op without a DSN).
initSentry();

function SeedOnMount() {
  const seedExercises = useMutation(api.seed.seedExercises);
  const seedMissing = useMutation(api.seed.seedMissingExercises);
  useEffect(() => {
    seedExercises().catch(() => {});
    seedMissing().catch(() => {});
  }, []);
  return null;
}

function ProfileGate() {
  const { userId, loading: userLoading } = useCurrentUser();
  const posthog = usePostHog();
  const profile = useQuery(
    api.userProfile.getByUser,
    userId ? { userId } : "skip"
  );
  const segments = useSegments();
  const router = useRouter();

  // Tie analytics + crash reports to the (opaque) Convex user id. No PII —
  // this is a health/fitness app, so we deliberately avoid email/name.
  useEffect(() => {
    if (!userId) return;
    identifyUser(userId);
    posthog?.identify(userId);
  }, [userId, posthog]);

  useEffect(() => {
    if (userLoading || profile === undefined) return;
    if (!userId) return;
    const inOnboarding = segments[0] === "onboarding";
    const inSignIn = segments[0] === "sign-in";
    const inSso = segments[0] === "sso-callback";
    if (inSignIn || inSso) return;
    if (profile === null && !inOnboarding) {
      router.replace("/onboarding");
    }
    // PHASE B: quarterly re-onboarding nudge — when profile.lastCheckInAt is
    // older than ~90 days, push a lightweight `/check-in` flow that re-measures
    // weight/BF and regenerates the goal roadmap (goalPlans.saveGeneratedPlan).
  }, [userId, userLoading, profile, segments]);

  return null;
}

function AppStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0A0B" } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sso-callback" />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen
        name="workout/[id]"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="meso/new"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="exercise/picker"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="camera"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="add-food"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="meal-plans"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="meal-planner"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="food-preferences-onboarding"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="grocery-list"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="create-meal"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

function NativeLayout() {
  const { useAuth } = require("@clerk/clerk-expo");
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inTabs = segments[0] === "(tabs)";
    const onSignIn = segments[0] === "sign-in";
    if (!isSignedIn && inTabs) router.replace("/sign-in");
    else if (isSignedIn && onSignIn) router.replace("/(tabs)");
  }, [isLoaded, isSignedIn, segments]);

  return (
    <View style={styles.root}>
      <ProfileGate />
      <AppStack />
    </View>
  );
}

function WebLayout() {
  const { useAuth } = require("@clerk/clerk-react");
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inTabs = segments[0] === "(tabs)";
    const onSignIn = segments[0] === "sign-in";
    if (!isSignedIn && inTabs) router.replace("/sign-in");
    else if (isSignedIn && onSignIn) router.replace("/(tabs)");
  }, [isLoaded, isSignedIn, segments]);

  // Unlock Web Audio API on first user gesture — required by iOS Safari / PWA
  useEffect(() => {
    const unlock = () => {
      unlockAudioContext();
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
    };
    document.addEventListener("touchstart", unlock, true);
    document.addEventListener("click", unlock, true);
    return () => {
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
    };
  }, []);

  return (
    <>
      <ProfileGate />
      <AppStack />
    </>
  );
}

function RootLayout() {
  const scheme = useColorScheme();

  // Register the Expo Router navigation container so Sentry tags errors/
  // transactions with the active screen (no-op when Sentry is disabled).
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_300Light_Italic,
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    Outfit_200ExtraLight,
    Outfit_300Light,
    Outfit_400Regular,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: "#0A0A0B" }} />;

  if (Platform.OS === "web") {
    const { ClerkProvider } = require("@clerk/clerk-react");
    return (
      <ClerkProvider publishableKey={CLERK_KEY}>
        <PostHogProvider
          apiKey={POSTHOG_KEY}
          options={{ host: POSTHOG_HOST, customStorage: webPostHogStorage }}
          autocapture={POSTHOG_KEY ? undefined : false}
        >
          <ConvexProvider client={convex}>
            <SeedOnMount />
            <WorkoutProvider>
              <StatusBar style="light" backgroundColor="#0A0A0B" />
              <ErrorBoundary name="web">
                <WebLayout />
              </ErrorBoundary>
            </WorkoutProvider>
          </ConvexProvider>
        </PostHogProvider>
      </ClerkProvider>
    );
  }

  const { ClerkProvider } = require("@clerk/clerk-expo");
  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <PostHogProvider
        apiKey={POSTHOG_KEY}
        options={{ host: POSTHOG_HOST }}
        autocapture={POSTHOG_KEY ? undefined : false}
      >
        <ConvexProvider client={convex}>
          <SeedOnMount />
          <WorkoutProvider>
            <StatusBar style="light" backgroundColor="#0A0A0B" />
            <ErrorBoundary name="native">
              <NativeLayout />
            </ErrorBoundary>
          </WorkoutProvider>
        </ConvexProvider>
      </PostHogProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0B" },
});

// Wrap the root so Sentry can capture unhandled errors + attach touch/session
// context. No-op passthrough when Sentry has no DSN configured.
export default Sentry.wrap(RootLayout);
