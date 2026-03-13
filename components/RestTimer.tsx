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
  useAnimatedProps,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { impactLight, notificationSuccess } from "@/utils/haptics";
import { playChime } from "@/utils/audio";
import { P } from "@/constants/colors";
import { CG, OUT_L } from "@/constants/typography";

const RING_SIZE = 200;
const STROKE = 3;
const R = RING_SIZE / 2 - STROKE;
const CIRCUMFERENCE = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PRESET_SECONDS = [60, 90, 120, 180];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface RestTimerProps {
  onComplete?: () => void;
  defaultSeconds?: number;
  compact?: boolean;
}

export function RestTimer({
  onComplete,
  defaultSeconds = 90,
  compact = false,
}: RestTimerProps) {
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);

  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const progress = useSharedValue(1);
  const ringScale = useSharedValue(1);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  // Compact bar animated width
  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  // SVG arc animated dashoffset
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
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
    const newRemaining = Math.max(
      0,
      Math.ceil((endTimeRef.current - Date.now()) / 1000)
    );
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

  const start = useCallback(
    (overrideRemaining?: number) => {
      const secs = overrideRemaining ?? remaining;
      if (secs <= 0) return;
      completedRef.current = false;
      endTimeRef.current = Date.now() + secs * 1000;
      setRunning(true);
      progress.value = withTiming(0, {
        duration: secs * 1000,
        easing: Easing.linear,
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, 500);
    },
    [remaining, tick]
  );

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endTimeRef.current = null;
    progress.value = remaining / totalSeconds;
    setRunning(false);
  }, [remaining, totalSeconds]);

  const reset = useCallback(
    (seconds?: number) => {
      stopTimer();
      completedRef.current = false;
      const s = seconds ?? totalSeconds;
      setTotalSeconds(s);
      setRemaining(s);
      progress.value = withTiming(1, { duration: 300 });
    },
    [totalSeconds, stopTimer]
  );

  // AppState: recalculate when app comes back to foreground
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && endTimeRef.current && running) tick();
    });
    return () => sub.remove();
  }, [running, tick]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Auto-start when switching to compact (if not already running)
  useEffect(() => {
    if (compact && !running) start();
  }, [compact]);

  const isComplete = remaining === 0;
  const isUrgent = remaining <= 10 && remaining > 0;
  const arcColor = isComplete ? P.green : isUrgent ? P.red : P.gold;

  // ── Compact bar ──────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontFamily: CG,
              fontSize: 22,
              letterSpacing: -0.5,
              color: isComplete ? P.green : P.ink,
              flex: 1,
            }}
          >
            {isComplete ? "Done!" : formatTime(remaining)}
          </Text>
          <Text
            style={{
              fontFamily: OUT_L,
              fontSize: 10,
              letterSpacing: 2,
              color: P.dim,
            }}
          >
            TAP TO EXPAND
          </Text>
        </View>
        {/* Thin gold progress line */}
        <View
          style={{
            height: 1,
            backgroundColor: P.border,
            marginTop: 5,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={[
              { height: 1, backgroundColor: arcColor, borderRadius: 1 },
              barStyle,
            ]}
          />
        </View>
      </View>
    );
  }

  // ── Full view ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Ring */}
      <Animated.View style={ringStyle}>
        <View
          style={{
            width: RING_SIZE,
            height: RING_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
            {/* Track */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              stroke={P.border}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Animated arc */}
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              stroke={arcColor}
              strokeWidth={STROKE + 1}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeLinecap="round"
              rotation={-90}
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              animatedProps={arcProps}
            />
          </Svg>
          {/* Time */}
          <Text
            style={{
              fontFamily: CG,
              fontSize: 64,
              fontWeight: "300",
              letterSpacing: -2,
              color: isComplete ? P.green : P.ink,
              lineHeight: 70,
            }}
          >
            {formatTime(remaining)}
          </Text>
          <Text
            style={{
              fontFamily: OUT_L,
              fontSize: 10,
              letterSpacing: 4,
              color: P.mid,
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {isComplete ? "done" : running ? "rest" : "paused"}
          </Text>
        </View>
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        {!running && !isComplete && (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: P.gold }]}
            onPress={() => start()}
            activeOpacity={0.85}
          >
            <Text style={styles.btnLabel}>Start</Text>
          </TouchableOpacity>
        )}
        {running && (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: P.s2 }]}
            onPress={pause}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnLabel, { color: P.ink }]}>Pause</Text>
          </TouchableOpacity>
        )}
        {isComplete && (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: P.green }]}
            onPress={() => reset()}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnLabel, { color: P.ink }]}>Done</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: P.s2 }]}
          onPress={() => reset()}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnLabel, { color: P.mid }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Preset pills */}
      <View style={styles.presets}>
        {PRESET_SECONDS.map((s) => {
          const active = totalSeconds === s && !running;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.presetPill,
                {
                  backgroundColor: active ? P.goldDim : P.s2,
                  borderWidth: 1,
                  borderColor: active ? P.gold : P.border,
                },
              ]}
              onPress={() => reset(s)}
              activeOpacity={0.75}
            >
              <Text
                style={{
                  fontFamily: OUT_L,
                  fontSize: 11,
                  letterSpacing: 1,
                  color: active ? P.gold : P.mid,
                }}
              >
                {s < 60
                  ? `${s}s`
                  : `${s / 60}m${s % 60 > 0 ? `${s % 60}s` : ""}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 28, paddingVertical: 24 },
  controls: { flexDirection: "row", gap: 10 },
  mainBtn: {
    height: 44,
    paddingHorizontal: 32,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLabel: {
    fontFamily: OUT_L,
    fontSize: 10,
    letterSpacing: 4,
    color: P.bg,
    textTransform: "uppercase",
  },
  presets: { flexDirection: "row", gap: 8 },
  presetPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 },
});
