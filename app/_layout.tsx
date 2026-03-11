import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, useColorScheme } from "react-native";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { useEffect } from "react";
import { WorkoutProvider } from "@/hooks/useWorkoutStore";
import { api } from "@/convex/_generated/api";
import { tokenCache } from "@/utils/tokenCache";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

const convex = new ConvexReactClient(CONVEX_URL);

function SeedOnMount() {
  const seedExercises = useMutation(api.seed.seedExercises);
  useEffect(() => {
    seedExercises().catch(() => {});
  }, []);
  return null;
}

function AppStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sso-callback" />
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

  return <AppStack />;
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

  return <AppStack />;
}

export default function RootLayout() {
  const scheme = useColorScheme();

  if (Platform.OS === "web") {
    const { ClerkProvider } = require("@clerk/clerk-react");
    return (
      <ClerkProvider publishableKey={CLERK_KEY}>
        <ConvexProvider client={convex}>
          <SeedOnMount />
          <WorkoutProvider>
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
            <WebLayout />
          </WorkoutProvider>
        </ConvexProvider>
      </ClerkProvider>
    );
  }

  const { ClerkProvider } = require("@clerk/clerk-expo");
  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <ConvexProvider client={convex}>
        <SeedOnMount />
        <WorkoutProvider>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <NativeLayout />
        </WorkoutProvider>
      </ConvexProvider>
    </ClerkProvider>
  );
}
