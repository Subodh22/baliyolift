import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { useEffect } from "react";
import { WorkoutProvider } from "@/hooks/useWorkoutStore";
import { api } from "@/convex/_generated/api";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";
const convex = new ConvexReactClient(CONVEX_URL);

// Seeds the exercise library once on first launch
function SeedOnMount() {
  const seedExercises = useMutation(api.seed.seedExercises);
  useEffect(() => {
    seedExercises().catch(() => {
      // Silently ignore — either already seeded or no connection yet
    });
  }, []);
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <ConvexProvider client={convex}>
      <SeedOnMount />
      <WorkoutProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="workout/[id]"
            options={{
              presentation: "fullScreenModal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="meso/new"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="exercise/picker"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
            }}
          />
        </Stack>
      </WorkoutProvider>
    </ConvexProvider>
  );
}
