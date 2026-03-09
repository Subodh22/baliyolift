import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RING_SIZE = 200;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PRESET_SECONDS = [60, 90, 120, 180];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface RestTimerProps {
  onComplete?: () => void;
  defaultSeconds?: number;
  compact?: boolean; // compact mode: just shows countdown text inline
}

export function RestTimer({
  onComplete,
  defaultSeconds = 90,
  compact = false,
}: RestTimerProps) {
  const { colors, typography } = useTheme();

  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ring progress 0 → 1
  const progress = useSharedValue(1);
  const ringScale = useSharedValue(1);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback(
    (seconds?: number) => {
      stopTimer();
      const s = seconds ?? totalSeconds;
      setTotalSeconds(s);
      setRemaining(s);
      progress.value = withTiming(1, { duration: 300 });
    },
    [totalSeconds, stopTimer]
  );

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);

    // Animate ring down
    progress.value = withTiming(0, {
      duration: remaining * 1000,
      easing: Easing.linear,
    });

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          stopTimer();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onComplete?.();
          return 0;
        }
        // Haptic at 10s and 5s remaining
        if (prev === 11 || prev === 6) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return prev - 1;
      });
    }, 1000);
  }, [running, remaining, stopTimer, onComplete]);

  const pause = useCallback(() => {
    stopTimer();
    // Snap ring to current progress
    progress.value = remaining / totalSeconds;
  }, [stopTimer, remaining, totalSeconds]);

  const handlePresset = useCallback(
    (seconds: number) => {
      Haptics.selectionAsync();
      reset(seconds);
    },
    [reset]
  );

  // Pulse ring when timer completes
  useEffect(() => {
    if (remaining === 0) {
      ringScale.value = withSpring(1.05, { damping: 8 }, () => {
        ringScale.value = withSpring(1, { damping: 12 });
      });
    }
  }, [remaining]);

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

  // Compact mode: inline timer text only
  if (compact) {
    return (
      <Text style={{ color: isComplete ? "#26A870" : "#FFFFFF", fontSize: 18, fontWeight: "700", flex: 1 }}>
        Rest · {formatTime(remaining)}
      </Text>
    );
  }

  // Stroke offset for SVG ring simulation via View transform
  // We'll use a simple arc approximation with border
  const dashOffset = CIRCUMFERENCE * (1 - pct);

  const ringColor = isComplete
    ? colors.accentGreen
    : remaining <= 10
    ? colors.accentRed
    : colors.accent;

  return (
    <View style={styles.container}>
      {/* Ring */}
      <Animated.View style={[styles.ringWrap, ringStyle]}>
        <View
          style={[
            styles.ringOuter,
            {
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderWidth: STROKE,
              borderColor: colors.fillSecondary,
            },
          ]}
        >
          {/* Inner content */}
          <View style={styles.ringInner}>
            <Text
              style={[
                typography.numericHero,
                {
                  color: isComplete ? colors.accentGreen : colors.label,
                  fontSize: 48,
                },
              ]}
            >
              {formatTime(remaining)}
            </Text>
            <Text
              style={[
                typography.caption1,
                { color: colors.labelSecondary, marginTop: 4 },
              ]}
            >
              {isComplete ? "Done!" : running ? "rest" : "paused"}
            </Text>
          </View>
        </View>

        {/* Progress arc — simulated with absolute positioned arc */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.arcOverlay,
            { borderRadius: RING_SIZE / 2 },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.arcFill,
              {
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: RING_SIZE / 2,
                borderWidth: STROKE,
                borderColor: ringColor,
                borderRightColor: "transparent",
                borderBottomColor: pct < 0.5 ? "transparent" : ringColor,
                transform: [{ rotate: `${(1 - pct) * 360 - 90}deg` }],
                opacity: pct > 0 ? 1 : 0,
              },
            ]}
          />
        </View>
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        {!running && !isComplete && (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: colors.accent }]}
            onPress={start}
            activeOpacity={0.85}
          >
            <Text style={[typography.headline, { color: "#FFF" }]}>Start</Text>
          </TouchableOpacity>
        )}
        {running && (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: colors.fillPrimary }]}
            onPress={pause}
            activeOpacity={0.85}
          >
            <Text style={[typography.headline, { color: colors.label }]}>
              Pause
            </Text>
          </TouchableOpacity>
        )}
        {isComplete && (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: colors.accentGreen }]}
            onPress={() => reset()}
            activeOpacity={0.85}
          >
            <Text style={[typography.headline, { color: "#FFF" }]}>Reset</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.fillSecondary }]}
          onPress={() => reset()}
          activeOpacity={0.7}
        >
          <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>

      {/* Presets */}
      <View style={styles.presets}>
        {PRESET_SECONDS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.presetPill,
              {
                backgroundColor:
                  totalSeconds === s && !running
                    ? colors.label
                    : colors.backgroundSecondary,
              },
            ]}
            onPress={() => handlePresset(s)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                typography.caption1,
                {
                  color:
                    totalSeconds === s && !running
                      ? colors.background
                      : colors.labelSecondary,
                  fontWeight: "600",
                },
              ]}
            >
              {s < 60 ? `${s}s` : `${s / 60}m${s % 60 > 0 ? `${s % 60}s` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 24,
    paddingVertical: 24,
  },
  ringWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    alignItems: "center",
  },
  arcOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  arcFill: {
    position: "absolute",
  },
  controls: {
    flexDirection: "row",
    gap: 10,
  },
  mainBtn: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  presets: {
    flexDirection: "row",
    gap: 8,
  },
  presetPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
