import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { selectionAsync, notificationSuccess } from "@/utils/haptics";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/useTheme";
import { MUSCLE_BADGE_COLORS } from "@/constants/colors";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackExercise {
  exerciseId: Id<"exercises">;
  name: string;
  muscleGroup: string;
}

interface CommonProps {
  visible: boolean;
  workoutId: Id<"workouts">;
  userId: Id<"users">;
  onSave: () => void;
  onCancel: () => void;
}

// Two collection moments:
//   • "soreness" — session start, per muscle about to be trained. Soreness is a
//     question about the *previous* session, so it's only knowable now.
//   • "exercise" — after the work, per exercise. Pump + workload, so added sets
//     can be routed to the specific movement that under-delivered.
type FeedbackModalProps =
  | (CommonProps & { mode: "soreness"; muscleGroups: string[] })
  | (CommonProps & { mode: "exercise"; exercises: FeedbackExercise[] });

// ─── Option Config ────────────────────────────────────────────────────────────

const SORENESS_OPTIONS = [
  { label: "Never got\nsore", value: 0 as const },
  { label: "Healed a\nwhile ago", value: 1 as const },
  { label: "Healed just\non time", value: 2 as const },
  { label: "I'm still\nsore!", value: 3 as const },
];

const PUMP_OPTIONS = [
  { label: "Low\npump", value: 0 as const },
  { label: "Moderate\npump", value: 1 as const },
  { label: "Amazing\npump", value: 2 as const },
];

const WORKLOAD_OPTIONS = [
  { label: "Easy", value: 0 as const },
  { label: "Pretty\ngood", value: 1 as const },
  { label: "Pushed my\nlimits", value: 2 as const },
  { label: "Too\nmuch", value: 3 as const },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionPill({
  label,
  selected,
  onPress,
  danger = false,
  success = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  danger?: boolean;
  success?: boolean;
}) {
  const { colors, typography } = useTheme();

  let bgColor: string = colors.fillSecondary;
  let textColor: string = colors.labelSecondary;

  if (selected) {
    if (danger) {
      bgColor = colors.accentRed;
      textColor = "#FFFFFF";
    } else if (success) {
      bgColor = colors.accentGreen;
      textColor = "#FFFFFF";
    } else {
      bgColor = colors.accent;
      textColor = "#FFFFFF";
    }
  }

  return (
    <Pressable
      onPress={() => {
        selectionAsync();
        onPress();
      }}
      style={[
        styles.optionPill,
        { backgroundColor: bgColor, borderColor: selected ? "transparent" : colors.separator, borderWidth: 1 },
      ]}
    >
      <Text style={[typography.caption1, { color: textColor, textAlign: "center", lineHeight: 16 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MuscleBadge({ muscle }: { muscle: string }) {
  const { colors, typography } = useTheme();
  const badgeColor = MUSCLE_BADGE_COLORS[muscle] ?? colors.accent;
  const displayName =
    MUSCLE_DISPLAY_NAMES[muscle as keyof typeof MUSCLE_DISPLAY_NAMES] ?? muscle;
  return (
    <View style={[styles.muscleBadge, { backgroundColor: badgeColor }]}>
      <Text style={[typography.caption2, styles.muscleBadgeText]}>
        {displayName.toUpperCase()}
      </Text>
      <View style={[styles.badgeDot, { backgroundColor: "rgba(255,255,255,0.8)" }]} />
    </View>
  );
}

function QuestionRow({
  label,
  prompt,
  options,
  value,
  onPick,
  dangerValue,
  successValue,
  marginTop = 0,
}: {
  label: string;
  prompt: string;
  options: { label: string; value: number }[];
  value: number;
  onPick: (value: number) => void;
  dangerValue?: number;
  successValue?: number;
  marginTop?: number;
}) {
  const { colors, typography } = useTheme();
  return (
    <>
      <Text style={[typography.footnote, styles.questionLabel, { color: colors.label, marginTop }]}>
        {label}
      </Text>
      <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 10 }]}>
        {prompt}
      </Text>
      <View style={styles.pillRow}>
        {options.map((opt) => (
          <OptionPill
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            danger={dangerValue === opt.value && value === opt.value}
            success={successValue === opt.value && value === opt.value}
            onPress={() => onPick(opt.value)}
          />
        ))}
      </View>
    </>
  );
}

// ─── Soreness mode (session start, per muscle) ────────────────────────────────

function SorenessModal({
  visible,
  muscleGroups,
  workoutId,
  userId,
  onSave,
  onCancel,
}: CommonProps & { muscleGroups: string[] }) {
  const { colors, typography } = useTheme();
  const saveSoreness = useMutation(api.overload.saveSessionSoreness);

  const [map, setMap] = useState<Record<string, number>>(
    () => Object.fromEntries(muscleGroups.map((m) => [m, 2]))
  );

  const handleSave = async () => {
    notificationSuccess();
    await saveSoreness({
      workoutId,
      userId,
      feedback: muscleGroups.map((m) => ({ muscleGroup: m, soreness: map[m] ?? 2 })),
    });
    onSave();
  };

  if (!visible) return null;

  return (
    <ModalShell
      title="RECOVERY CHECK"
      onCancel={onCancel}
      onSave={handleSave}
      saveLabel="START"
    >
      {muscleGroups.map((muscle) => {
        const displayName =
          MUSCLE_DISPLAY_NAMES[muscle as keyof typeof MUSCLE_DISPLAY_NAMES] ?? muscle;
        return (
          <View key={muscle} style={[styles.section, { backgroundColor: colors.backgroundSecondary }]}>
            <MuscleBadge muscle={muscle} />
            <QuestionRow
              label={`${displayName.toUpperCase()} SORENESS`}
              prompt={`How sore did your ${displayName.toLowerCase()} get after training them last time?`}
              options={SORENESS_OPTIONS}
              value={map[muscle] ?? 2}
              onPick={(v) => setMap((prev) => ({ ...prev, [muscle]: v }))}
              dangerValue={3}
            />
          </View>
        );
      })}
    </ModalShell>
  );
}

// ─── Exercise mode (post-work, per exercise) ──────────────────────────────────

function ExerciseFeedbackModal({
  visible,
  exercises,
  workoutId,
  userId,
  onSave,
  onCancel,
}: CommonProps & { exercises: FeedbackExercise[] }) {
  const { colors } = useTheme();
  const saveExerciseFeedback = useMutation(api.overload.saveExerciseFeedback);

  const [map, setMap] = useState<Record<string, { pump: number; workload: number }>>(
    () => Object.fromEntries(exercises.map((e) => [e.exerciseId as string, { pump: 1, workload: 1 }]))
  );

  const setField = useCallback(
    (exId: string, field: "pump" | "workload", value: number) => {
      setMap((prev) => ({ ...prev, [exId]: { ...(prev[exId] ?? { pump: 1, workload: 1 }), [field]: value } }));
    },
    []
  );

  const handleSave = async () => {
    notificationSuccess();
    await saveExerciseFeedback({
      workoutId,
      userId,
      feedback: exercises.map((e) => ({
        exerciseId: e.exerciseId,
        muscleGroup: e.muscleGroup,
        pump: map[e.exerciseId as string]?.pump ?? 1,
        workload: map[e.exerciseId as string]?.workload ?? 1,
      })),
    });
    onSave();
  };

  if (!visible) return null;

  return (
    <ModalShell title="FEEDBACK" onCancel={onCancel} onSave={handleSave} saveLabel="SAVE">
      {exercises.map((ex) => {
        const key = ex.exerciseId as string;
        const fb = map[key] ?? { pump: 1, workload: 1 };
        return (
          <View key={key} style={[styles.section, { backgroundColor: colors.backgroundSecondary }]}>
            <MuscleBadge muscle={ex.muscleGroup} />
            <Text style={[styles.exerciseName, { color: colors.label }]}>{ex.name}</Text>
            <QuestionRow
              label="PUMP"
              prompt="How much of a pump did you get on this exercise?"
              options={PUMP_OPTIONS}
              value={fb.pump}
              onPick={(v) => setField(key, "pump", v)}
              successValue={2}
            />
            <QuestionRow
              label="WORKLOAD"
              prompt="How hard was the work on this exercise?"
              options={WORKLOAD_OPTIONS}
              value={fb.workload}
              onPick={(v) => setField(key, "workload", v)}
              dangerValue={3}
              marginTop={16}
            />
          </View>
        );
      })}
    </ModalShell>
  );
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

function ModalShell({
  title,
  saveLabel,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator, borderBottomWidth: 0.5 }]}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[typography.body, { color: colors.accent }]}>CANCEL</Text>
          </TouchableOpacity>
          <Text style={[typography.headline, { color: colors.label }]}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Sections */}
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {/* Save button */}
        <View style={[styles.saveBar, { backgroundColor: colors.background, borderTopColor: colors.separator }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            onPress={onSave}
            activeOpacity={0.85}
          >
            <Text style={[typography.headline, { color: "#FFFFFF" }]}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function FeedbackModal(props: FeedbackModalProps) {
  if (props.mode === "soreness") {
    const { mode, ...rest } = props;
    return <SorenessModal {...rest} />;
  }
  const { mode, ...rest } = props;
  return <ExerciseFeedbackModal {...rest} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  section: {
    borderRadius: 8,
    padding: 16,
  },
  muscleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
    marginBottom: 14,
  },
  muscleBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
  },
  questionLabel: {
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  optionPill: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 0.5,
  },
  saveButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
