import { Platform } from "react-native";

// Safe haptics wrapper — no-ops on web
const noop = () => {};

let _haptics: typeof import("expo-haptics") | null = null;

async function getHaptics() {
  if (Platform.OS === "web") return null;
  if (!_haptics) _haptics = await import("expo-haptics");
  return _haptics;
}

export async function impactLight() {
  const H = await getHaptics();
  H?.impactAsync(H.ImpactFeedbackStyle.Light);
}

export async function impactMedium() {
  const H = await getHaptics();
  H?.impactAsync(H.ImpactFeedbackStyle.Medium);
}

export async function selectionAsync() {
  const H = await getHaptics();
  H?.selectionAsync();
}

export async function notificationSuccess() {
  const H = await getHaptics();
  H?.notificationAsync(H.NotificationFeedbackType.Success);
}
