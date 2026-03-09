import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { useEffect } from "react";
import { WorkoutProvider } from "@/hooks/useWorkoutStore";
import { api } from "@/convex/_generated/api";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

const convex = new ConvexReactClient(CONVEX_URL);

// In-memory token cache — works in Expo Go (SecureStore AES requires a dev build)
const tokenStore: Record<string, string> = {};
const tokenCache = {
  getToken: (key: string) => Promise.resolve(tokenStore[key] ?? null),
  saveToken: (key: string, value: string) => { tokenStore[key] = value; return Promise.resolve(); },
  clearToken: (key: string) => { delete tokenStore[key]; return Promise.resolve(); },
};

function SeedOnMount() {
  const seedExercises = useMutation(api.seed.seedExercises);
  useEffect(() => {
    seedExercises().catch(() => {});
  }, []);
  return null;
}

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inTabs = segments[0] === "(tabs)";
    const onSignIn = segments[0] === "sign-in";
    if (!isSignedIn && inTabs) {
      // Signed out while in the app — go to login
      router.replace("/sign-in");
    } else if (isSignedIn && onSignIn) {
      // Already signed in but on login screen — go to app
      router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
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
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <ConvexProvider client={convex}>
        <SeedOnMount />
        <WorkoutProvider>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <InitialLayout />
        </WorkoutProvider>
      </ConvexProvider>
    </ClerkProvider>
  );
}
