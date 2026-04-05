import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  FadeInRight,
} from "react-native-reanimated";
import { impactLight, selectionAsync, notificationSuccess } from "@/utils/haptics";
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
import { EXERCISE_SEED_DATA, CARDIO_EXERCISE_SEED_DATA } from "@/data/exercises";

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5; // 0–4

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SFR_COLORS = { high: "#30D158", medium: "#FF9F0A", low: "#8E8E93" } as const;

const ALL_EXERCISES = [...EXERCISE_SEED_DATA, ...CARDIO_EXERCISE_SEED_DATA];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function autoFillExercises(muscleGroups: MuscleGroup[]): string[] {
  const result: string[] = [];
  for (const mg of muscleGroups) {
    const picked = EXERCISE_SEED_DATA
      .filter((e) => e.muscleGroup === mg)
      .sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.sfr] ?? 2) - (order[b.sfr] ?? 2);
      })
      .slice(0, 2)
      .map((e) => e.name);
    result.push(...picked);
  }
  return result;
}

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "laxman",
    name: "Laxman",
    subtitle: "4 days · Shoulders/Bi · Chest/Tri · Back · Legs",
    tag: "High Volume",
    tagColor: "#FF6B35",
    description: "Super-set heavy 4-day split with drop sets and pre-fatigue protocols.",
    weeks: 5,
    sessions: [
      { day: 1, name: "Shoulders & Biceps", exercises: ["Bent Over Lateral Raise", "Incline DB Front Raise", "Upright Row", "Machine Shoulder Press", "EZ Bar Curl", "Hammer Curl"] },
      { day: 2, name: "Back", exercises: ["Reverse Grip Pulldown", "V Bar Pulldown", "Dumbbell Row", "Cable Row", "Cable Face Pull", "Reverse Pec Deck"] },
      { day: 4, name: "Triceps & Back", exercises: ["Cable Pushdown", "Cable Kickback", "Cable Overhead Tricep Extension", "Reverse Grip Pushdown", "Deadlift", "Chest-Supported Row"] },
      { day: 5, name: "Legs", exercises: ["Seated Leg Curl", "Barbell Back Squat", "Hack Squat Machine", "Walking Lunge", "Standing Calf Raise"] },
    ],
  },
  {
    id: "ppl",
    name: "PPL Hypertrophy",
    subtitle: "6 days · Push · Pull · Legs × 2",
    tag: "RP-Style",
    tagColor: "#007AFF",
    description: "Classic Push/Pull/Legs twice per week. Maximum frequency for hypertrophy.",
    weeks: 5,
    sessions: [
      { day: 1, name: "Push A — Chest & Shoulders", exercises: ["Incline Dumbbell Press", "Machine Chest Press", "Cable Lateral Raise", "Overhead Tricep Extension"] },
      { day: 2, name: "Pull A — Back & Biceps", exercises: ["Cable Row", "Lat Pulldown", "Incline Dumbbell Curl", "Hammer Curl"] },
      { day: 3, name: "Legs A — Quads & Glutes", exercises: ["Leg Press", "Leg Extension", "Romanian Deadlift", "Standing Calf Raise"] },
      { day: 4, name: "Push B — Chest & Triceps", exercises: ["Flat Dumbbell Press", "Pec Dec", "Machine Shoulder Press", "Cable Tricep Pushdown"] },
      { day: 5, name: "Pull B — Back & Biceps", exercises: ["Chest Supported Row", "Single Arm Cable Row", "EZ Bar Curl", "Cable Curl"] },
      { day: 6, name: "Legs B — Hamstrings & Glutes", exercises: ["Hack Squat", "Leg Curl", "Hip Thrust", "Seated Calf Raise"] },
    ],
  },
  {
    id: "upper_lower",
    name: "Upper / Lower",
    subtitle: "4 days · Upper A · Lower A · Upper B · Lower B",
    tag: "Beginner–Intermediate",
    tagColor: "#34C759",
    description: "Balanced upper/lower split. Ideal if you're building your training base.",
    weeks: 5,
    sessions: [
      { day: 1, name: "Upper A — Chest Focus", exercises: ["Incline Dumbbell Press", "Cable Row", "Cable Lateral Raise", "EZ Bar Curl", "Cable Tricep Pushdown"] },
      { day: 2, name: "Lower A — Quad Focus", exercises: ["Leg Press", "Leg Extension", "Romanian Deadlift", "Standing Calf Raise"] },
      { day: 4, name: "Upper B — Back Focus", exercises: ["Lat Pulldown", "Flat Dumbbell Press", "Machine Shoulder Press", "Incline Dumbbell Curl", "Overhead Tricep Extension"] },
      { day: 5, name: "Lower B — Glute & Ham Focus", exercises: ["Hack Squat", "Leg Curl", "Hip Thrust", "Seated Calf Raise"] },
    ],
  },
  {
    id: "cbum",
    name: "CBum Classic Physique",
    subtitle: "5 days · Chest/Tri · Back/Bi · Shoulders/Arms · Legs · Arms",
    tag: "Classic Physique",
    tagColor: "#C9A84C",
    description: "Chris Bumstead's 5-day split. High chest and arm volume with a dedicated legs day.",
    weeks: 5,
    sessions: [
      { day: 1, name: "Chest & Triceps", exercises: ["Incline Dumbbell Press", "Machine Chest Press", "Pec Dec", "Cable Tricep Pushdown", "Overhead Tricep Extension"] },
      { day: 2, name: "Back & Biceps", exercises: ["Deadlift", "Lat Pulldown", "Cable Row", "EZ Bar Curl", "Incline Dumbbell Curl"] },
      { day: 4, name: "Shoulders & Arms", exercises: ["Machine Shoulder Press", "Cable Lateral Raise", "Cable Face Pull", "EZ Bar Curl", "Cable Tricep Pushdown"] },
      { day: 5, name: "Legs", exercises: ["Leg Press", "Hack Squat", "Leg Extension", "Leg Curl", "Hip Thrust", "Standing Calf Raise", "Seated Calf Raise"] },
      { day: 6, name: "Arms Pump", exercises: ["Incline Dumbbell Curl", "Hammer Curl", "Cable Curl", "Cable Tricep Pushdown", "Overhead Tricep Extension"] },
    ],
  },
  {
    id: "jeff_nippard",
    name: "Jeff Nippard Science-Based",
    subtitle: "4 days · Upper Horizontal · Lower Quad · Upper Vertical · Lower Hinge",
    tag: "Evidence-Based",
    tagColor: "#AF52DE",
    description: "Science-based upper/lower split emphasising compound movements and mechanical tension.",
    weeks: 5,
    sessions: [
      { day: 1, name: "Upper A — Horizontal", exercises: ["Flat Dumbbell Press", "Cable Row", "Pec Dec", "EZ Bar Curl", "Cable Tricep Pushdown", "Cable Face Pull"] },
      { day: 2, name: "Lower A — Quad Dominant", exercises: ["Barbell Back Squat", "Leg Press", "Leg Extension", "Leg Curl", "Standing Calf Raise"] },
      { day: 4, name: "Upper B — Vertical", exercises: ["Machine Shoulder Press", "Lat Pulldown", "Cable Lateral Raise", "Incline Dumbbell Press", "Hammer Curl", "Overhead Tricep Extension"] },
      { day: 5, name: "Lower B — Hip Dominant", exercises: ["Romanian Deadlift", "Hip Thrust", "Hack Squat", "Seated Leg Curl", "Seated Calf Raise"] },
    ],
  },
  {
    id: "lean_beef_patty",
    name: "Lean Beef Patty Glute Build",
    subtitle: "5 days · Glutes/Hams · Upper Pull · Quads/Glutes · Upper Push · Full Legs",
    tag: "Glute Focus",
    tagColor: "#FF2D55",
    description: "Glute-dominant 5-day program with twice-weekly hip thrust and high posterior chain volume.",
    weeks: 5,
    sessions: [
      { day: 1, name: "Glutes & Hamstrings", exercises: ["Hip Thrust", "Romanian Deadlift", "Leg Curl", "Seated Leg Curl", "Standing Calf Raise"] },
      { day: 2, name: "Upper Pull", exercises: ["Lat Pulldown", "Cable Row", "Cable Face Pull", "Incline Dumbbell Curl", "Hammer Curl"] },
      { day: 4, name: "Quads & Glutes", exercises: ["Leg Press", "Hack Squat", "Leg Extension", "Hip Thrust", "Seated Calf Raise"] },
      { day: 5, name: "Upper Push", exercises: ["Incline Dumbbell Press", "Machine Chest Press", "Machine Shoulder Press", "Cable Lateral Raise", "Cable Tricep Pushdown"] },
      { day: 6, name: "Full Legs", exercises: ["Barbell Back Squat", "Romanian Deadlift", "Leg Extension", "Leg Curl", "Standing Calf Raise"] },
    ],
  },
  {
    id: "jeff_nippard_fundamentals_hypertrophy_program",
    name: "Jeff Nippard Fundamentals Hypertrophy Program",
    subtitle: "4 days · Mon · Tue · Thu · Fri",
    tag: "Intermediate",
    tagColor: "#AF52DE",
    description: "Science-based full body hypertrophy program. Each session hits both upper and lower body muscles. Uses RPE (Rate of Perceived Exertion) for auto-regulation. Designed to be run as an 8-week mesocycle with a deload in week 8.",
    weeks: 8,
    sessions: [
      { day: 1, name: "Bench Press Focus", muscleGroups: ["chest","quads","triceps","shoulders","back","biceps","hamstrings","abs"], exercises: ["Flat Barbell Press","Leg Press","Chest-Supported Row","Cable Lateral Raise","Incline Dumbbell Curl","Lying Leg Curl","Cable Overhead Tricep Extension","Ab Wheel Rollout"] },
      { day: 2, name: "Row Focus", muscleGroups: ["back","hamstrings","biceps","quads","shoulders","chest","triceps"], exercises: ["Barbell Row","Lat Pulldown","Hack Squat Machine","Romanian Deadlift","Overhead Press Dumbbell","Pec Deck Machine","Preacher Curl Machine","Cable Pushdown"] },
      { day: 4, name: "Overhead Press Focus", muscleGroups: ["shoulders","hamstrings","triceps","back","quads","chest","abs"], exercises: ["Overhead Press Barbell","Romanian Deadlift","Incline Dumbbell Press","Cable Row","Leg Extension","Lying Leg Curl","Cable Lateral Raise","Cable Face Pull"] },
      { day: 5, name: "Squat Focus", muscleGroups: ["quads","glutes","hamstrings","chest","back","shoulders","biceps","triceps","abs"], exercises: ["Barbell Back Squat","Flat Dumbbell Press","Lat Pulldown","Hip Thrust","Dumbbell Lateral Raise","Hammer Curl","Cable Pushdown","Hanging Leg Raise"] }
    ],
  },
];

// ─── Template Confirm Sheet ───────────────────────────────────────────────────

function TemplateConfirmSheet({ template, onConfirm, onCancel, loading, colors, typography }: any) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="none" visible statusBarTranslucent onRequestClose={onCancel}>
      <View style={confirmStyles.overlay}>
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          style={[confirmStyles.sheet, { backgroundColor: colors.backgroundSecondary, paddingBottom: insets.bottom + 16, borderColor: colors.separator }]}
        >
          <View style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
              <Text style={[typography.title2, { color: colors.label }]}>{template.name}</Text>
              <Text style={{ fontSize: 10, color: colors.labelSecondary, letterSpacing: 0.8, textTransform: "uppercase" }}>
                {template.tag}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.accent, letterSpacing: 0.5, marginBottom: 14 }}>
              {template.subtitle}
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 10, marginBottom: 20 }}>
              {template.sessions.map((session: any) => (
                <View key={session.day} style={[confirmStyles.sessionCard, { borderBottomColor: colors.separator }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Text style={{ fontSize: 10, color: colors.accent, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700", minWidth: 28 }}>
                      {DAY_SHORT[session.day]}
                    </Text>
                    <Text style={[typography.subheadline, { color: colors.label, fontWeight: "600" }]}>
                      {session.name}
                    </Text>
                  </View>
                  <View style={{ gap: 4, paddingLeft: 38 }}>
                    {session.exercises.map((ex: string) => (
                      <Text key={ex} style={[typography.footnote, { color: colors.labelSecondary }]}>{ex}</Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.8}
              style={[confirmStyles.btn, { borderWidth: 1, borderColor: colors.separator, flex: 1 }]}>
              <Text style={{ color: colors.labelSecondary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} disabled={loading} activeOpacity={0.8}
              style={[confirmStyles.btn, { borderWidth: 1, borderColor: colors.accent, flex: 1 }]}>
              {loading
                ? <ActivityIndicator color={colors.accent} size="small" />
                : <Text style={{ color: colors.accent, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: "700" }}>Use Template</Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const confirmStyles = StyleSheet.create({
  overlay:     { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet:       { borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 20, borderWidth: StyleSheet.hairlineWidth },
  sessionCard: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  btn:         { paddingVertical: 15, borderRadius: 4, alignItems: "center", justifyContent: "center" },
});

// ─── Step: Template Picker ────────────────────────────────────────────────────

function StepTemplates({ onPreviewTemplate, onBuildCustom, colors, typography }: any) {
  return (
    <Animated.View entering={FadeInDown.springify()} style={{ flex: 1 }}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>Choose a program</Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 6, marginBottom: 24 }]}>
        Start from a proven template or build your own.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Divider at top */}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginBottom: 0 }} />

        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => onPreviewTemplate(t)}
            activeOpacity={0.6}
            style={[tplStyles.row, { borderBottomColor: colors.separator }]}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
                <Text style={[typography.headline, { color: colors.label }]}>{t.name}</Text>
                <Text style={{ fontSize: 10, color: colors.labelSecondary, letterSpacing: 0.8, textTransform: "uppercase" }}>
                  {t.tag}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.accent, letterSpacing: 0.5, marginBottom: 6 }}>
                {t.subtitle}
              </Text>
              <Text style={[typography.footnote, { color: colors.labelSecondary, lineHeight: 18 }]}>
                {t.description}
              </Text>
            </View>
            <Text style={{ color: colors.labelTertiary, fontSize: 18, marginLeft: 12 }}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={onBuildCustom}
          activeOpacity={0.7}
          style={[tplStyles.customBtn, { borderColor: colors.accent }]}
        >
          <Text style={{ color: colors.accent, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: "600" }}>
            Build Custom Mesocycle
          </Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </Animated.View>
  );
}

const tplStyles = StyleSheet.create({
  row: {
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  customBtn: {
    marginTop: 20,
    paddingVertical: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
  },
});

// ─── Step 0: Name & Duration ──────────────────────────────────────────────────

function StepNameDuration({ name, setName, weeks, setWeeks, colors, typography }: any) {
  return (
    <Animated.View entering={FadeInRight} style={{ flex: 1 }}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>Name your block</Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 6, marginBottom: 32 }]}>
        A mesocycle is a focused training block. 4–6 weeks is optimal for hypertrophy.
      </Text>

      <TextInput
        style={[ndStyles.input, { backgroundColor: colors.backgroundSecondary, color: colors.label, borderColor: colors.separator }]}
        placeholder="e.g. Hypertrophy Block 1"
        placeholderTextColor={colors.labelTertiary}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
      />

      <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 32, marginBottom: 12, letterSpacing: 0.8, fontWeight: "600" }]}>
        DURATION
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[4, 5, 6].map((w) => (
          <TouchableOpacity
            key={w}
            style={[ndStyles.weekPill, {
              backgroundColor: "transparent",
              borderColor: weeks === w ? colors.accent : colors.separator,
              flex: 1,
            }]}
            onPress={() => { selectionAsync(); setWeeks(w); }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: weeks === w ? colors.accent : colors.label }}>
              {w}
            </Text>
            <Text style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: weeks === w ? colors.accent : colors.labelSecondary }}>
              weeks
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

const ndStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 17,
  },
  weekPill: {
    paddingVertical: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
});

// ─── Step 1: Training Days ────────────────────────────────────────────────────

function StepDays({ selectedDays, setSelectedDays, colors, typography }: any) {
  const toggle = (day: number) => {
    selectionAsync();
    setSelectedDays((prev: number[]) =>
      prev.includes(day) ? prev.filter((d: number) => d !== day) : [...prev, day]
    );
  };

  return (
    <Animated.View entering={FadeInRight} style={{ flex: 1 }}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>Training days</Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 6, marginBottom: 32 }]}>
        Pick which days you train each week.
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {DAY_LABELS.map((label, i) => {
          const dayVal = DAY_VALUES[i];
          const active = selectedDays.includes(dayVal);
          return (
            <TouchableOpacity
              key={label}
              style={[daysStyles.pill, {
                backgroundColor: "transparent",
                borderColor: active ? colors.accent : colors.separator,
              }]}
              onPress={() => toggle(dayVal)}
              activeOpacity={0.8}
            >
              <Text style={{
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: active ? colors.accent : colors.labelSecondary,
                fontWeight: active ? "700" : "400",
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[typography.footnote, { color: colors.labelTertiary, marginTop: 24 }]}>
        {selectedDays.length} {selectedDays.length === 1 ? "day" : "days"} selected
      </Text>
    </Animated.View>
  );
}

const daysStyles = StyleSheet.create({
  pill: {
    width: "13%",
    flexGrow: 1,
    paddingVertical: 16,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
  },
});

// ─── Step 2: Session Muscles ──────────────────────────────────────────────────

function StepSessions({ selectedDays, sessionMuscles, setSessionMuscles, colors, typography }: any) {
  const [activeDay, setActiveDay] = useState<number>(selectedDays[0]);
  const dayLabel = (d: number) => DAY_LABELS[DAY_VALUES.indexOf(d)];

  const toggleMuscle = (day: number, muscle: MuscleGroup) => {
    selectionAsync();
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
    <Animated.View entering={FadeInRight} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[typography.largeTitle, { color: colors.label }]}>Session muscles</Text>
        <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 6, marginBottom: 20 }]}>
          Which muscle groups does each day train?
        </Text>

        {/* Day tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
          contentContainerStyle={{ gap: 8, alignItems: "center" }}
          nestedScrollEnabled
        >
          {selectedDays.map((day: number) => {
            const count = (sessionMuscles[day] ?? []).length;
            const isActive = activeDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[sessStyles.dayTab, {
                  backgroundColor: "transparent",
                  borderColor: isActive ? colors.accent : colors.separator,
                }]}
                onPress={() => setActiveDay(day)}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: isActive ? colors.accent : colors.labelSecondary,
                  fontWeight: isActive ? "700" : "400",
                }}>
                  {dayLabel(day)}
                </Text>
                {count > 0 && (
                  <View style={[sessStyles.badge, { backgroundColor: colors.accent + "22" }]}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: colors.accent }}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Muscle toggles */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 40 }}>
          {ALL_MUSCLE_GROUPS.map((muscle) => {
            const active = (sessionMuscles[activeDay] ?? []).includes(muscle);
            return (
              <TouchableOpacity
                key={muscle}
                style={[sessStyles.musclePill, {
                  backgroundColor: "transparent",
                  borderColor: active ? colors.accent : colors.separator,
                }]}
                onPress={() => toggleMuscle(activeDay, muscle)}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: active ? colors.accent : colors.labelSecondary,
                  fontWeight: active ? "700" : "400",
                }}>
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

const sessStyles = StyleSheet.create({
  dayTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
  },
  badge: {
    width: 16,
    height: 16,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  musclePill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
  },
});

// ─── Exercise Picker Modal ────────────────────────────────────────────────────

function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  sessionMuscles,
  colors,
  typography,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
  sessionMuscles: MuscleGroup[];
  colors: any;
  typography: any;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "all">("all");

  const filtered = useMemo(() => {
    return ALL_EXERCISES.filter((e) => {
      if (muscleFilter !== "all" && e.muscleGroup !== muscleFilter) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.sfr] ?? 2) - (order[b.sfr] ?? 2);
    });
  }, [search, muscleFilter]);

  // Reset filters when modal opens
  React.useEffect(() => {
    if (visible) {
      setSearch("");
      setMuscleFilter("all");
    }
  }, [visible]);

  const filterMuscles: Array<MuscleGroup | "all"> = ["all", ...sessionMuscles];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[pickerStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[pickerStyles.header, { borderBottomColor: colors.separator }]}>
          <Text style={[typography.headline, { color: colors.label }]}>Select Exercise</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[typography.body, { color: colors.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[pickerStyles.searchRow, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={{ fontSize: 15, color: colors.labelTertiary }}>🔍</Text>
          <TextInput
            style={[pickerStyles.searchInput, { color: colors.label }]}
            placeholder="Search exercises…"
            placeholderTextColor={colors.labelTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: colors.labelSecondary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Muscle filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pickerStyles.filterScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {filterMuscles.map((mg) => {
            const active = muscleFilter === mg;
            return (
              <TouchableOpacity
                key={mg}
                onPress={() => { selectionAsync(); setMuscleFilter(mg); }}
                style={[pickerStyles.filterPill, {
                  backgroundColor: "transparent",
                  borderColor: active ? colors.accent : colors.separator,
                }]}
              >
                <Text style={{
                  fontSize: 10,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: active ? colors.accent : colors.labelSecondary,
                  fontWeight: active ? "700" : "400",
                }}>
                  {mg === "all" ? "All" : MUSCLE_DISPLAY_NAMES[mg]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Exercise list */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.separator }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => { impactLight(); onSelect(item.name); }}
              activeOpacity={0.75}
              style={pickerStyles.exItem}
            >
              <View style={[pickerStyles.sfrDot, { backgroundColor: SFR_COLORS[item.sfr] }]} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.subheadline, { color: colors.label }]}>{item.name}</Text>
                <Text style={[typography.caption1, { color: colors.labelSecondary, marginTop: 2 }]}>
                  {MUSCLE_DISPLAY_NAMES[item.muscleGroup as MuscleGroup] ?? item.muscleGroup}
                  {"  ·  "}
                  {item.equipment}
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: 20 }}>+</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  searchRow:   { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  filterScroll:{ marginBottom: 8 },
  filterPill:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 4, borderWidth: 1 },
  exItem:      { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  sfrDot:      { width: 8, height: 8, borderRadius: 4 },
});

// ─── Step 3: Exercises ────────────────────────────────────────────────────────

function StepExercises({ selectedDays, sessionMuscles, sessionExercises, setSessionExercises, colors, typography }: any) {
  const [activeDay, setActiveDay] = useState<number>(selectedDays[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);

  const dayLabel = (d: number) => DAY_LABELS[DAY_VALUES.indexOf(d)];
  const exercises: string[] = sessionExercises[activeDay] ?? [];
  const muscles: MuscleGroup[] = sessionMuscles[activeDay] ?? [];

  const openSwap = (idx: number) => { setSwappingIndex(idx); setPickerOpen(true); };
  const openAdd  = () => { setSwappingIndex(null); setPickerOpen(true); };

  const handleSelect = (exName: string) => {
    setSessionExercises((prev: any) => {
      const curr = [...(prev[activeDay] ?? [])];
      if (swappingIndex !== null) {
        curr[swappingIndex] = exName;
      } else {
        if (!curr.includes(exName)) curr.push(exName);
      }
      return { ...prev, [activeDay]: curr };
    });
    setPickerOpen(false);
  };

  const removeExercise = (idx: number) => {
    selectionAsync();
    setSessionExercises((prev: any) => {
      const curr = [...(prev[activeDay] ?? [])];
      curr.splice(idx, 1);
      return { ...prev, [activeDay]: curr };
    });
  };

  const doAutoFill = () => {
    impactLight();
    setSessionExercises((prev: any) => ({
      ...prev,
      [activeDay]: autoFillExercises(muscles),
    }));
  };

  return (
    <Animated.View entering={FadeInRight} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[typography.largeTitle, { color: colors.label }]}>Exercises</Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 6, marginBottom: 16 }]}>
        Auto-filled from your muscle picks. Swap, remove, or add your own.
      </Text>

      {/* Day tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, alignItems: "center" }} nestedScrollEnabled>
          {selectedDays.map((day: number) => {
            const count = (sessionExercises[day] ?? []).length;
            const isActive = activeDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[exStyles.dayTab, {
                  backgroundColor: "transparent",
                  borderColor: isActive ? colors.accent : colors.separator,
                }]}
                onPress={() => setActiveDay(day)}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: isActive ? colors.accent : colors.labelSecondary,
                  fontWeight: isActive ? "700" : "400",
                }}>
                  {dayLabel(day)}
                </Text>
                {count > 0 && (
                  <View style={[exStyles.badge, { backgroundColor: colors.accent + "22" }]}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: colors.accent }}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Exercise list */}
      <View style={{ gap: 8, marginBottom: 16 }}>
          {exercises.length === 0 ? (
            <View style={[exStyles.emptyState, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
              <Text style={[typography.body, { color: colors.labelSecondary, textAlign: "center" }]}>
                No exercises yet.{"\n"}Tap Auto-fill or add manually.
              </Text>
            </View>
          ) : (
            exercises.map((exName: string, idx: number) => {
              const exData = ALL_EXERCISES.find((e) => e.name === exName);
              const sfr  = exData?.sfr ?? "medium";
              const mg   = exData?.muscleGroup ?? "";
              return (
                <View
                  key={`${exName}-${idx}`}
                  style={[exStyles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
                >
                  <View style={[exStyles.sfrDot, { backgroundColor: SFR_COLORS[sfr] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.subheadline, { color: colors.label }]} numberOfLines={1}>
                      {exName}
                    </Text>
                    <Text style={[typography.caption1, { color: colors.labelSecondary, marginTop: 2 }]}>
                      {MUSCLE_DISPLAY_NAMES[mg as MuscleGroup] ?? mg}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => openSwap(idx)}
                    style={[exStyles.actionBtn, { borderColor: colors.accent }]}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>Swap</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeExercise(idx)}
                    style={[exStyles.actionBtn, { borderColor: colors.separator }]}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={{ color: colors.labelSecondary, fontSize: 16, lineHeight: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Action row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 40 }}>
          <TouchableOpacity
            onPress={doAutoFill}
            activeOpacity={0.8}
            style={[exStyles.footerBtn, { borderColor: colors.separator, flex: 1 }]}
          >
            <Text style={{ color: colors.labelSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Auto-fill</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openAdd}
            activeOpacity={0.8}
            style={[exStyles.footerBtn, { borderColor: colors.accent, flex: 1.4 }]}
          >
            <Text style={{ color: colors.accent, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700" }}>+ Add Exercise</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        sessionMuscles={muscles}
        colors={colors}
        typography={typography}
      />
    </Animated.View>
  );
}

const exStyles = StyleSheet.create({
  dayTab:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 4, borderWidth: 1 },
  badge:     { width: 16, height: 16, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  row:       { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 13 },
  sfrDot:    { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  footerBtn: { paddingVertical: 15, borderRadius: 4, borderWidth: 1, alignItems: "center" },
  emptyState:{ borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 32, paddingHorizontal: 20 },
});

// ─── Step 4: Volume Targets ───────────────────────────────────────────────────

function StepVolume({ sessionMuscles, volumeOverrides, setVolumeOverrides, experienceLevel, colors, typography }: any) {
  const allMuscles = Array.from(new Set(Object.values(sessionMuscles).flat())) as MuscleGroup[];

  const getDefaults = (m: MuscleGroup) =>
    VOLUME_DEFAULTS[m][experienceLevel as "beginner" | "intermediate" | "advanced"];

  return (
    <Animated.View entering={FadeInRight} style={{ flex: 1 }}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>Volume targets</Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 6, marginBottom: 24 }]}>
        Sets per week per muscle. Adjust freely from evidence-based defaults.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {allMuscles.map((muscle) => {
          const defaults = getDefaults(muscle);
          const override = volumeOverrides[muscle];
          const mev = override?.mev ?? defaults.mev;
          const mav = override?.mav ?? defaults.mav;
          const mrv = override?.mrv ?? defaults.mrv;

          return (
            <View key={muscle} style={[volStyles.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
              <Text style={[typography.headline, { color: colors.label, marginBottom: 14 }]}>
                {MUSCLE_DISPLAY_NAMES[muscle]}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {(["mev", "mav", "mrv"] as const).map((key, i) => {
                  const val   = { mev, mav, mrv }[key];
                  const label = { mev: "MEV", mav: "MAV", mrv: "MRV" }[key];
                  const color = [colors.volumeLow, colors.volumeMid, colors.volumeHigh][i];
                  return (
                    <View key={key} style={{ alignItems: "center", gap: 8 }}>
                      <Text style={[typography.caption1, { color, fontWeight: "700", letterSpacing: 0.5 }]}>
                        {label}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <TouchableOpacity
                          onPress={() => { selectionAsync(); setVolumeOverrides((prev: any) => ({ ...prev, [muscle]: { mev, mav, mrv, [key]: Math.max(0, val - 1) } })); }}
                          style={[volStyles.stepBtn, { borderColor: colors.separator }]}
                        >
                          <Text style={[typography.title3, { color: colors.labelSecondary }]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[typography.numericMedium, { color: colors.label, minWidth: 28, textAlign: "center" }]}>
                          {val}
                        </Text>
                        <TouchableOpacity
                          onPress={() => { selectionAsync(); setVolumeOverrides((prev: any) => ({ ...prev, [muscle]: { mev, mav, mrv, [key]: val + 1 } })); }}
                          style={[volStyles.stepBtn, { borderColor: colors.separator }]}
                        >
                          <Text style={[typography.title3, { color: colors.labelSecondary }]}>+</Text>
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

const volStyles = StyleSheet.create({
  card:    { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function MesoNew() {
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();
  const createMeso        = useMutation(api.mesocycles.createCustom);
  const createLaxman      = useMutation(api.templates.createLaxmanTemplate);
  const createPPL         = useMutation(api.templates.createPPLTemplate);
  const createUpperLower  = useMutation(api.templates.createUpperLowerTemplate);
  const createCBum        = useMutation(api.templates.createCBumTemplate);
  const createJeffNippard = useMutation(api.templates.createJeffNippardTemplate);
  const createLeanBeefPatty = useMutation(api.templates.createLeanBeefPattyTemplate);

  // -1 = template picker, 0–4 = wizard steps
  const [step, setStep] = useState(-1);
  const [previewTemplate, setPreviewTemplate] = useState<typeof TEMPLATES[number] | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(5);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [sessionMuscles, setSessionMuscles] = useState<Record<number, MuscleGroup[]>>({});
  const [sessionExercises, setSessionExercises] = useState<Record<number, string[]>>({});
  const [volumeOverrides, setVolumeOverrides] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);

  const experienceLevel = "intermediate";

  const handleConfirmTemplate = async () => {
    if (!userId || !previewTemplate) return;
    setTemplateLoading(true);
    try {
      const id = previewTemplate.id;
      if (id === "laxman")               await createLaxman({ userId });
      else if (id === "ppl")             await createPPL({ userId });
      else if (id === "upper_lower")     await createUpperLower({ userId });
      else if (id === "cbum")            await createCBum({ userId });
      else if (id === "jeff_nippard")    await createJeffNippard({ userId });
      else if (id === "lean_beef_patty") await createLeanBeefPatty({ userId });
      else {
        // Generic imported template — use createCustom with session data
        const allMuscleGroups = [...new Set(
          previewTemplate.sessions.flatMap((s: any) => s.muscleGroups ?? [])
        )] as MuscleGroup[];
        const volumeTargets = allMuscleGroups.map((mg) => {
          const d = VOLUME_DEFAULTS[mg]?.[experienceLevel] ?? { mev: 10, mav: 16, mrv: 20 };
          return { muscleGroup: mg, mev: d.mev, mav: d.mav, mrv: d.mrv };
        });
        await createMeso({
          userId,
          name: previewTemplate.name,
          weeks: previewTemplate.weeks,
          volumeTargets,
          sessions: previewTemplate.sessions.map((s: any, i: number) => ({
            dayOfWeek: s.day,
            name: s.name,
            muscleGroups: s.muscleGroups ?? [],
            order: i,
            exerciseNames: s.exercises,
          })),
        });
      }
      notificationSuccess();
      setPreviewTemplate(null);
      router.back();
    } catch (e) {
      console.error("Template creation failed:", e);
      setTemplateLoading(false);
    }
  };

  const canAdvance = () => {
    if (step < 0) return false;
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return selectedDays.length > 0;
    if (step === 2) return selectedDays.every((d) => (sessionMuscles[d] ?? []).length > 0);
    if (step === 3) return selectedDays.every((d) => (sessionExercises[d] ?? []).length > 0);
    return true;
  };

  const next = () => {
    if (!canAdvance() || creating) return;
    impactLight();

    // Auto-fill exercises when moving from session muscles → exercises step
    if (step === 2) {
      setSessionExercises((prev) => {
        const updated = { ...prev };
        for (const day of selectedDays) {
          if (!updated[day] || updated[day].length === 0) {
            updated[day] = autoFillExercises(sessionMuscles[day] ?? []);
          }
        }
        return updated;
      });
    }

    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleCreate();
    }
  };

  const back = () => {
    if (step === -1) {
      router.back();
    } else if (step === 0) {
      selectionAsync();
      setStep(-1);
    } else {
      selectionAsync();
      setStep((s) => s - 1);
    }
  };

  const buildVolumeTargets = () => {
    const allMuscles = Array.from(new Set(Object.values(sessionMuscles).flat())) as MuscleGroup[];
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
        const sessionName = muscles.length > 0
          ? muscles.slice(0, 3).map((m) => MUSCLE_SHORT[m] ?? m).join(" / ")
          : `Session ${i + 1}`;
        return {
          dayOfWeek: day,
          name: sessionName,
          muscleGroups: muscles,
          order: i,
          exerciseNames: sessionExercises[day] ?? [],
        };
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
      notificationSuccess();
      router.back();
    } catch {
      setCreating(false);
    }
  };

  const isTemplatePicker = step === -1;
  const stepProps = { colors, typography };

  const STEP_LABELS = ["Name", "Days", "Muscles", "Exercises", "Volume"];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[typography.body, { color: colors.accent }]}>
            {step <= 0 ? "Cancel" : "Back"}
          </Text>
        </TouchableOpacity>

        {!isTemplatePicker ? (
          <View style={styles.progressBar}>
            {STEP_LABELS.map((_, i) => (
              <View
                key={i}
                style={[styles.progressSegment, {
                  backgroundColor: i <= step ? colors.accent : colors.fillSecondary,
                }]}
              />
            ))}
          </View>
        ) : (
          <View />
        )}

        <View style={{ width: 60 }} />
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.content}>
          {isTemplatePicker && (
            <StepTemplates
              onPreviewTemplate={(t: typeof TEMPLATES[number]) => { selectionAsync(); setPreviewTemplate(t); }}
              onBuildCustom={() => { impactLight(); setStep(0); }}
              {...stepProps}
            />
          )}
          {step === 0 && (
            <StepNameDuration
              name={name} setName={setName}
              weeks={weeks} setWeeks={setWeeks}
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
            <StepExercises
              selectedDays={selectedDays}
              sessionMuscles={sessionMuscles}
              sessionExercises={sessionExercises}
              setSessionExercises={setSessionExercises}
              {...stepProps}
            />
          )}
          {step === 4 && (
            <StepVolume
              sessionMuscles={sessionMuscles}
              volumeOverrides={volumeOverrides}
              setVolumeOverrides={setVolumeOverrides}
              experienceLevel={experienceLevel}
              {...stepProps}
            />
          )}
        </View>

        {!isTemplatePicker && (
          <View style={styles.footer}>
            <Button
              label={step === TOTAL_STEPS - 1
                ? (creating ? "Creating…" : "Create Mesocycle")
                : "Continue"}
              onPress={next}
              disabled={!canAdvance() || creating}
              variant="outline"
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Template confirmation sheet */}
      {previewTemplate && (
        <TemplateConfirmSheet
          template={previewTemplate}
          onConfirm={handleConfirmTemplate}
          onCancel={() => { setPreviewTemplate(null); setTemplateLoading(false); }}
          loading={templateLoading}
          colors={colors}
          typography={typography}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:         { width: 60 },
  progressBar:     { flexDirection: "row", gap: 4, flex: 1, marginHorizontal: 16 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2 },
  content:         { flex: 1, paddingHorizontal: 24 },
  footer:          { paddingHorizontal: 24, paddingBottom: 8, paddingTop: 12 },
});
