import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  AppStateStatus,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { Audio } from "expo-av";
import { impactLight, notificationSuccess } from "@/utils/haptics";
import { useTheme } from "@/hooks/useTheme";

const RING_SIZE = 200;
const STROKE = 8;

const PRESET_SECONDS = [60, 90, 120, 180];

async function playChime() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/timer-complete.wav"),
      { shouldPlay: true, volume: 1.0 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
  } catch {}
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface RestTimerProps {
  onComplete?: () => void;
  defaultSeconds?: number;
  compact?: boolean;
  onExpand?: () => void;
}

export function RestTimer({
  onComplete,
  defaultSeconds = 90,
  compact = false,
  onExpand,
}: RestTimerProps) {
  const { colors, typography } = useTheme();

  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);

  // Wall clock end time — survives backgrounding
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const progress = useSharedValue(1);
  const ringScale = useSharedValue(1);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endTimeRef.current = null;
    setRunning(false);
  }, []);

  const handleComplete = useCallback(() => {
    stopTimer();
    setRemaining(0);
    progress.value = withTiming(0, { duration: 200 });
    ringScale.value = withSpring(1.05, { damping: 8 }, () => {
      ringScale.value = withSpring(1, { damping: 12 });
    });
    notificationSuccess();
    playChime();
    onComplete?.();
  }, [stopTimer, onComplete]);

  const tick = useCallback(() => {
    if (!endTimeRef.current) return;
    const newRemaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setRemaining(newRemaining);
    if (newRemaining <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        handleComplete();
      }
    } else if (newRemaining <= 5 || newRemaining === 10) {
      impactLight();
    }
  }, [handleComplete]);

  const start = useCallback((overrideRemaining?: number) => {
    const secs = overrideRemaining ?? remaining;
    if (secs <= 0) return;
    completedRef.current = false;
    endTimeRef.current = Date.now() + secs * 1000;
    setRunning(true);
    progress.value = withTiming(0, { duration: secs * 1000, easing: Easing.linear });
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 500);
  }, [remaining, tick]);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endTimeRef.current = null;
    progress.value = remaining / totalSeconds;
    setRunning(false);
  }, [remaining, totalSeconds]);

  const reset = useCallback((seconds?: number) => {
    stopTimer();
    completedRef.current = false;
    const s = seconds ?? totalSeconds;
    setTotalSeconds(s);
    setRemaining(s);
    progress.value = withTiming(1, { duration: 300 });
  }, [totalSeconds, stopTimer]);

  // AppState: recalculate remaining when app comes back to foreground (native only)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && endTimeRef.current && running) {
        tick();
      }
    });
    return () => sub.remove();
  }, [running, tick]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Auto-start in compact mode
  useEffect(() => {
    if (compact && !running) start();
  }, [compact]);

  const pct = remaining / totalSeconds;
  const isComplete = remaining === 0;

  if (compact) {
    return (
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: isComplete ? "#26A870" : "#FFFFFF", fontSize: 16, fontFamily: "Outfit_400Regular", flex: 1 }}>
          Rest · {formatTime(remaining)}
        </Text>
        <Text style={{ color: "#FFFFFF60", fontSize: 11, fontFamily: "Outfit_300Light", letterSpacing: 1 }}>
          TAP TO EXPAND
        </Text>
      </View>
    );
  }

  const ringColor = isComplete ? colors.accentGreen : remaining <= 10 ? colors.accentRed : colors.accent;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ringWrap, ringStyle]}>
        <View
          style={[
            styles.ringOuter,
            { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: STROKE, borderColor: colors.fillSecondary },
          ]}
        >
          <View style={styles.ringInner}>
            <Text style={[typography.numericHero, { color: isComplete ? colors.accentGreen : colors.label, fontSize: 48 }]}>
              {formatTime(remaining)}
            </Text>
            <Text style={[typography.caption1, { color: colors.labelSecondary, marginTop: 4 }]}>
              {isComplete ? "Done!" : running ? "rest" : "paused"}
            </Text>
          </View>
        </View>
        <View style={[StyleSheet.absoluteFill, styles.arcOverlay, { borderRadius: RING_SIZE / 2 }]} pointerEvents="none">
          <View
            style={[
              styles.arcFill,
              {
                width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
                borderWidth: STROKE, borderColor: ringColor,
                borderRightColor: "transparent",
                borderBottomColor: pct < 0.5 ? "transparent" : ringColor,
                transform: [{ rotate: `${(1 - pct) * 360 - 90}deg` }],
                opacity: pct > 0 ? 1 : 0,
              },
            ]}
          />
        </View>
      </Animated.View>

      <View style={styles.controls}>
        {!running && !isComplete && (
          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: colors.accent }]} onPress={() => start()} activeOpacity={0.85}>
            <Text style={[typography.headline, { color: "#FFF" }]}>Start</Text>
          </TouchableOpacity>
        )}
        {running && (
          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: colors.fillPrimary }]} onPress={pause} activeOpacity={0.85}>
            <Text style={[typography.headline, { color: colors.label }]}>Pause</Text>
          </TouchableOpacity>
        )}
        {isComplete && (
          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: colors.accentGreen }]} onPress={() => reset()} activeOpacity={0.85}>
            <Text style={[typography.headline, { color: "#FFF" }]}>Reset</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => reset()} activeOpacity={0.7}>
          <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.presets}>
        {PRESET_SECONDS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.presetPill, { backgroundColor: totalSeconds === s && !running ? colors.label : colors.backgroundSecondary }]}
            onPress={() => reset(s)}
            activeOpacity={0.75}
          >
            <Text style={[typography.caption1, { color: totalSeconds === s && !running ? colors.background : colors.labelSecondary, fontWeight: "600" }]}>
              {s < 60 ? `${s}s` : `${s / 60}m${s % 60 > 0 ? `${s % 60}s` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 24, paddingVertical: 24 },
  ringWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  ringOuter: { alignItems: "center", justifyContent: "center" },
  ringInner: { alignItems: "center" },
  arcOverlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
  arcFill: { position: "absolute" },
  controls: { flexDirection: "row", gap: 10 },
  mainBtn: { height: 48, paddingHorizontal: 28, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { height: 48, paddingHorizontal: 20, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  presets: { flexDirection: "row", gap: 8 },
  presetPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
});
