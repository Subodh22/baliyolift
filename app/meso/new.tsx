import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Dimensions,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInRight,
  FadeOutLeft,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMutation } from "convex/react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import {
  ALL_MUSCLE_GROUPS,
  MUSCLE_DISPLAY_NAMES,
  VOLUME_DEFAULTS,
  type MuscleGroup,
} from "@/constants/muscles";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOTAL_STEPS = 4;

// ---- Step 1: Name & Duration ----
function StepNameDuration({
  name,
  setName,
  weeks,
  setWeeks,
  colors,
  typography,
}: any) {
  const weekOptions = [4, 5, 6];

  return (
    <Animated.View entering={FadeInRight} style={styles.stepContainer}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Name your block
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 32 }]}>
        A mesocycle is a focused training block. 4–6 weeks is optimal for hypertrophy.
      </Text>

      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: colors.backgroundSecondary,
            color: colors.label,
            ...typography.body,
            borderColor: colors.separator,
          },
        ]}
        placeholder="e.g. Hypertrophy Block 1"
        placeholderTextColor={colors.labelTertiary}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={[typography.subheadline, { color: colors.labelSecondary, marginTop: 28, marginBottom: 12 }]}>
        DURATION
      </Text>
      <View style={styles.pillRow}>
        {weekOptions.map((w) => (
          <TouchableOpacity
            key={w}
            style={[
              styles.pill,
              {
                backgroundColor: weeks === w ? colors.accent : colors.backgroundSecondary,
                flex: 1,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setWeeks(w);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                typography.headline,
                { color: weeks === w ? "#FFF" : colors.label },
              ]}
            >
              {w} weeks
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

// ---- Step 2: Training days ----
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

function StepDays({ selectedDays, setSelectedDays, colors, typography }: any) {
  const toggle = (day: number) => {
    Haptics.selectionAsync();
    setSelectedDays((prev: number[]) =>
      prev.includes(day) ? prev.filter((d: number) => d !== day) : [...prev, day]
    );
  };

  return (
    <Animated.View entering={FadeInRight} style={styles.stepContainer}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Training days
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 32 }]}>
        Pick which days you train. You can name each session after.
      </Text>

      <View style={styles.daysGrid}>
        {DAY_LABELS.map((label, i) => {
          const dayVal = DAY_VALUES[i];
          const active = selectedDays.includes(dayVal);
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.dayPill,
                {
                  backgroundColor: active ? colors.accent : colors.backgroundSecondary,
                },
              ]}
              onPress={() => toggle(dayVal)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.subheadline,
                  { color: active ? "#FFF" : colors.labelSecondary, fontWeight: "600" },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[typography.footnote, { color: colors.labelTertiary, marginTop: 20, textAlign: "center" }]}>
        {selectedDays.length} days selected
      </Text>
    </Animated.View>
  );
}

// ---- Step 3: Muscle groups per session ----
function StepSessions({
  selectedDays,
  sessionMuscles,
  setSessionMuscles,
  colors,
  typography,
}: any) {
  const [activeDay, setActiveDay] = useState<number>(selectedDays[0]);

  const dayLabel = (d: number) => DAY_LABELS[DAY_VALUES.indexOf(d)];

  const toggleMuscle = (day: number, muscle: MuscleGroup) => {
    Haptics.selectionAsync();
    setSessionMuscles((prev: Record<number, MuscleGroup[]>) => {
      const current = prev[day] ?? [];
      return {
        ...prev,
        [day]: current.includes(muscle)
          ? current.filter((m) => m !== muscle)
          : [...current, muscle],
      };
    });
  };

  return (
    <Animated.View entering={FadeInRight} style={[styles.stepContainer, { flex: 1 }]}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Session muscles
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 20 }]}>
        Which muscle groups does each day train?
      </Text>

      {/* Day tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={styles.pillRow}>
          {selectedDays.map((day: number) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.pill,
                {
                  backgroundColor:
                    activeDay === day ? colors.label : colors.backgroundSecondary,
                  paddingHorizontal: 16,
                },
              ]}
              onPress={() => setActiveDay(day)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.subheadline,
                  {
                    color: activeDay === day
                      ? colors.background
                      : colors.labelSecondary,
                    fontWeight: "600",
                  },
                ]}
              >
                {dayLabel(day)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Muscle toggles */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.muscleGrid}>
          {ALL_MUSCLE_GROUPS.map((muscle) => {
            const active = (sessionMuscles[activeDay] ?? []).includes(muscle);
            return (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.musclePill,
                  {
                    backgroundColor: active ? colors.accent : colors.backgroundSecondary,
                    borderColor: active ? colors.accent : colors.separator,
                  },
                ]}
                onPress={() => toggleMuscle(activeDay, muscle)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    typography.subheadline,
                    { color: active ? "#FFF" : colors.label, fontWeight: active ? "600" : "400" },
                  ]}
                >
                  {MUSCLE_DISPLAY_NAMES[muscle]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ---- Step 4: Volume targets ----
function StepVolume({
  sessionMuscles,
  volumeOverrides,
  setVolumeOverrides,
  experienceLevel,
  colors,
  typography,
}: any) {
  // Collect all unique muscles across all sessions
  const allMuscles = Array.from(
    new Set(Object.values(sessionMuscles).flat())
  ) as MuscleGroup[];

  const getDefaults = (m: MuscleGroup) =>
    VOLUME_DEFAULTS[m][experienceLevel as "beginner" | "intermediate" | "advanced"];

  return (
    <Animated.View entering={FadeInRight} style={[styles.stepContainer, { flex: 1 }]}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Volume targets
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 24 }]}>
        Sets per week per muscle. Defaults are based on your experience level — adjust freely.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {allMuscles.map((muscle) => {
          const defaults = getDefaults(muscle);
          const override = volumeOverrides[muscle];
          const mev = override?.mev ?? defaults.mev;
          const mav = override?.mav ?? defaults.mav;
          const mrv = override?.mrv ?? defaults.mrv;

          return (
            <View
              key={muscle}
              style={[styles.volumeCard, { backgroundColor: colors.backgroundSecondary }]}
            >
              <Text style={[typography.headline, { color: colors.label, marginBottom: 12 }]}>
                {MUSCLE_DISPLAY_NAMES[muscle]}
              </Text>
              <View style={styles.volumeRow}>
                {(["mev", "mav", "mrv"] as const).map((key, i) => {
                  const val = { mev, mav, mrv }[key];
                  const label = { mev: "MEV", mav: "MAV", mrv: "MRV" }[key];
                  const color = [colors.volumeLow, colors.accent, colors.volumeHigh][i];
                  return (
                    <View key={key} style={styles.volumeField}>
                      <Text style={[typography.caption1, { color, fontWeight: "700" }]}>
                        {label}
                      </Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.selectionAsync();
                            setVolumeOverrides((prev: any) => ({
                              ...prev,
                              [muscle]: { mev, mav, mrv, [key]: Math.max(0, val - 1) },
                            }));
                          }}
                          style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]}
                        >
                          <Text style={[typography.title3, { color: colors.label }]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[typography.numericMedium, { color: colors.label, minWidth: 30, textAlign: "center" }]}>
                          {val}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.selectionAsync();
                            setVolumeOverrides((prev: any) => ({
                              ...prev,
                              [muscle]: { mev, mav, mrv, [key]: val + 1 },
                            }));
                          }}
                          style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]}
                        >
                          <Text style={[typography.title3, { color: colors.label }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </Animated.View>
  );
}

// ---- Main Wizard ----
export default function MesoNew() {
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();
  const createMeso = useMutation(api.mesocycles.createCustom);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(5);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [sessionMuscles, setSessionMuscles] = useState<Record<number, MuscleGroup[]>>({});
  const [volumeOverrides, setVolumeOverrides] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);

  // TODO: pull from user profile
  const experienceLevel = "intermediate";

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return selectedDays.length > 0;
    if (step === 2) return selectedDays.every((d) => (sessionMuscles[d] ?? []).length > 0);
    return true;
  };

  const next = () => {
    if (!canAdvance() || creating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleCreate();
    }
  };

  const back = () => {
    if (step === 0) {
      router.back();
    } else {
      Haptics.selectionAsync();
      setStep((s) => s - 1);
    }
  };

  const buildVolumeTargets = () => {
    const allMuscles = Array.from(
      new Set(Object.values(sessionMuscles).flat())
    ) as MuscleGroup[];

    return allMuscles.map((muscle) => {
      const defaults = VOLUME_DEFAULTS[muscle][experienceLevel as "beginner" | "intermediate" | "advanced"];
      const override = volumeOverrides[muscle];
      return {
        muscleGroup: muscle,
        mev: override?.mev ?? defaults.mev,
        mav: override?.mav ?? defaults.mav,
        mrv: override?.mrv ?? defaults.mrv,
      };
    });
  };

  const buildSessions = () => {
    const MUSCLE_SHORT: Record<string, string> = {
      chest: "Chest", back: "Back", shoulders: "Shoulders",
      biceps: "Biceps", triceps: "Triceps", quads: "Quads",
      hamstrings: "Hams", glutes: "Glutes", calves: "Calves",
      abs: "Abs", forearms: "Forearms",
    };
    return selectedDays
      .sort((a, b) => a - b)
      .map((day, i) => {
        const muscles = (sessionMuscles[day] ?? []) as string[];
        const name = muscles.length > 0
          ? muscles.slice(0, 3).map((m) => MUSCLE_SHORT[m] ?? m).join(" / ")
          : `Session ${i + 1}`;
        return { dayOfWeek: day, name, muscleGroups: muscles, order: i };
      });
  };

  const handleCreate = async () => {
    if (!userId) return;
    setCreating(true);
    try {
      await createMeso({
        userId,
        name,
        weeks,
        volumeTargets: buildVolumeTargets(),
        sessions: buildSessions(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setCreating(false);
    }
  };

  const stepProps = { colors, typography };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[typography.body, { color: colors.accent }]}>
            {step === 0 ? "Cancel" : "Back"}
          </Text>
        </TouchableOpacity>

        {/* Progress dots */}
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? colors.label : colors.fillSecondary,
                  width: i === step ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>

        <View style={{ width: 60 }} />
      </View>

      {/* Step content */}
      <View style={styles.content}>
        {step === 0 && (
          <StepNameDuration
            name={name}
            setName={setName}
            weeks={weeks}
            setWeeks={setWeeks}
            {...stepProps}
          />
        )}
        {step === 1 && (
          <StepDays
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
            {...stepProps}
          />
        )}
        {step === 2 && (
          <StepSessions
            selectedDays={selectedDays}
            sessionMuscles={sessionMuscles}
            setSessionMuscles={setSessionMuscles}
            {...stepProps}
          />
        )}
        {step === 3 && (
          <StepVolume
            sessionMuscles={sessionMuscles}
            volumeOverrides={volumeOverrides}
            setVolumeOverrides={setVolumeOverrides}
            experienceLevel={experienceLevel}
            {...stepProps}
          />
        )}
      </View>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <Button
          label={step === TOTAL_STEPS - 1 ? "Create Mesocycle" : "Continue"}
          onPress={next}
          disabled={!canAdvance()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { width: 60 },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  content: { flex: 1, paddingHorizontal: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: 8, paddingTop: 12 },

  stepContainer: { flex: 1 },
  textInput: {
    borderWidth: 0.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  pillRow: { flexDirection: "row", gap: 10 },
  pill: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dayPill: {
    width: "13%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexGrow: 1,
  },
  muscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  musclePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  volumeCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  volumeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  volumeField: { alignItems: "center", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
