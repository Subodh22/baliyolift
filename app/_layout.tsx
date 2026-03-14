import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, useColorScheme, View, StyleSheet } from "react-native";
import { unlockAudioContext } from "@/utils/audio";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { WorkoutProvider } from "@/hooks/useWorkoutStore";
import { api } from "@/convex/_generated/api";
import { tokenCache } from "@/utils/tokenCache";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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

const convex = new ConvexReactClient(CONVEX_URL);

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
  const profile = useQuery(
    api.userProfile.getByUser,
    userId ? { userId } : "skip"
  );
  const segments = useSegments();
  const router = useRouter();

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

export default function RootLayout() {
  const scheme = useColorScheme();

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
        <ConvexProvider client={convex}>
          <SeedOnMount />
          <WorkoutProvider>
            <StatusBar style="light" backgroundColor="#0A0A0B" />
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
          <StatusBar style="light" backgroundColor="#0A0A0B" />
          <NativeLayout />
        </WorkoutProvider>
      </ConvexProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0B" },
});
