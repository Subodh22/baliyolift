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

interface FeedbackState {
  soreness: 0 | 1 | 2 | 3;
  pump: 0 | 1 | 2;
  workload: 0 | 1 | 2 | 3;
}

interface FeedbackModalProps {
  visible: boolean;
  muscleGroups: string[];
  workoutId: Id<"workouts">;
  userId: Id<"users">;
  onSave: () => void;
  onCancel: () => void;
}

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

function FeedbackSection({
  muscle,
  feedback,
  onChange,
}: {
  muscle: string;
  feedback: FeedbackState;
  onChange: (muscle: string, field: keyof FeedbackState, value: number) => void;
}) {
  const { colors, typography } = useTheme();
  const badgeColor = MUSCLE_BADGE_COLORS[muscle] ?? colors.accent;
  const displayName =
    MUSCLE_DISPLAY_NAMES[muscle as keyof typeof MUSCLE_DISPLAY_NAMES] ?? muscle;

  return (
    <View style={[styles.section, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Muscle badge */}
      <View style={[styles.muscleBadge, { backgroundColor: badgeColor }]}>
        <Text style={[typography.caption2, styles.muscleBadgeText]}>
          {displayName.toUpperCase()}
        </Text>
        <View style={[styles.badgeDot, { backgroundColor: "rgba(255,255,255,0.8)" }]} />
      </View>

      {/* Soreness */}
      <Text style={[typography.footnote, styles.questionLabel, { color: colors.label }]}>
        {displayName.toUpperCase()} SORENESS
      </Text>
      <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 10 }]}>
        How sore did you get in your {displayName.toLowerCase()} AFTER training them last time?
      </Text>
      <View style={styles.pillRow}>
        {SORENESS_OPTIONS.map((opt) => (
          <OptionPill
            key={opt.value}
            label={opt.label}
            selected={feedback.soreness === opt.value}
            danger={opt.value === 3 && feedback.soreness === 3}
            onPress={() => onChange(muscle, "soreness", opt.value)}
          />
        ))}
      </View>

      {/* Pump */}
      <Text style={[typography.footnote, styles.questionLabel, { color: colors.label, marginTop: 16 }]}>
        {displayName.toUpperCase()} PUMP
      </Text>
      <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 10 }]}>
        How much of a pump did you get today in your {displayName.toLowerCase()}?
      </Text>
      <View style={styles.pillRow}>
        {PUMP_OPTIONS.map((opt) => (
          <OptionPill
            key={opt.value}
            label={opt.label}
            selected={feedback.pump === opt.value}
            success={opt.value === 2 && feedback.pump === 2}
            onPress={() => onChange(muscle, "pump", opt.value)}
          />
        ))}
      </View>

      {/* Workload */}
      <Text style={[typography.footnote, styles.questionLabel, { color: colors.label, marginTop: 16 }]}>
        {displayName.toUpperCase()} WORKLOAD
      </Text>
      <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 10 }]}>
        How would you rate the difficulty of the work you did for your {displayName.toLowerCase()}?
      </Text>
      <View style={styles.pillRow}>
        {WORKLOAD_OPTIONS.map((opt) => (
          <OptionPill
            key={opt.value}
            label={opt.label}
            selected={feedback.workload === opt.value}
            danger={opt.value === 3 && feedback.workload === 3}
            onPress={() => onChange(muscle, "workload", opt.value)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function FeedbackModal({
  visible,
  muscleGroups,
  workoutId,
  userId,
  onSave,
  onCancel,
}: FeedbackModalProps) {
  const { colors, typography } = useTheme();
  const saveFeedback = useMutation(api.overload.saveFeedback);

  const defaultFeedback = (): FeedbackState => ({ soreness: 2, pump: 1, workload: 1 });

  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackState>>(
    () => Object.fromEntries(muscleGroups.map((m) => [m, defaultFeedback()]))
  );

  const handleChange = useCallback(
    (muscle: string, field: keyof FeedbackState, value: number) => {
      setFeedbackMap((prev) => ({
        ...prev,
        [muscle]: { ...prev[muscle], [field]: value as any },
      }));
    },
    []
  );

  const handleSave = async () => {
    notificationSuccess();
    await saveFeedback({
      workoutId,
      userId,
      feedback: muscleGroups.map((m) => ({
        muscleGroup: m,
        soreness: feedbackMap[m]?.soreness ?? 2,
        pump: feedbackMap[m]?.pump ?? 1,
        workload: feedbackMap[m]?.workload ?? 1,
      })),
    });
    onSave();
  };

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator, borderBottomWidth: 0.5 }]}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[typography.body, { color: colors.accent }]}>CANCEL</Text>
          </TouchableOpacity>
          <Text style={[typography.headline, { color: colors.label }]}>FEEDBACK</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Sections */}
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {muscleGroups.map((muscle) => (
            <FeedbackSection
              key={muscle}
              muscle={muscle}
              feedback={feedbackMap[muscle] ?? defaultFeedback()}
              onChange={handleChange}
            />
          ))}
        </ScrollView>

        {/* Save button */}
        <View style={[styles.saveBar, { backgroundColor: colors.background, borderTopColor: colors.separator }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={[typography.headline, { color: "#FFFFFF" }]}>SAVE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
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
    borderRadius: 16,
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
