import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/useTheme";

interface SwapExercise {
  _id: Id<"exercises">;
  name: string;
  muscleGroup: string;
  equipment: string;
  sfr: string;
}

interface Props {
  visible: boolean;
  currentExercise: SwapExercise;
  sessionExerciseId: Id<"sessionExercises"> | null;
  onSwapLocal: (ex: SwapExercise) => void;
  onClose: () => void;
}

const SFR_COLOR: Record<string, string> = {
  high: "#34C759",
  medium: "#FFD60A",
  low: "#FF9F0A",
};

export function SwapSheet({
  visible,
  currentExercise,
  sessionExerciseId,
  onSwapLocal,
  onClose,
}: Props) {
  const { colors, typography } = useTheme();
  const [selected, setSelected] = useState<SwapExercise | null>(null);
  const [saving, setSaving] = useState(false);

  const swapMut = useMutation(api.mesocycles.swapExercise);

  const exercises = useQuery(
    api.exercises.listByMuscleGroup,
    visible ? { muscleGroup: currentExercise.muscleGroup as any } : "skip"
  );

  const reset = () => {
    setSelected(null);
    onClose();
  };

  const handleTodayOnly = () => {
    if (!selected) return;
    onSwapLocal(selected);
    reset();
  };

  const handleUpdateSession = async () => {
    if (!selected || !sessionExerciseId) return;
    setSaving(true);
    try {
      await swapMut({ sessionExerciseId, newExerciseId: selected._id });
      onSwapLocal(selected);
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={reset}>
      <Pressable style={sheet.backdrop} onPress={reset} />
      <View style={[sheet.container, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[sheet.handle, { backgroundColor: colors.separator }]} />

        <Text style={[typography.title3, { color: colors.label, fontWeight: "700", marginBottom: 2 }]}>
          Swap Exercise
        </Text>
        <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 16 }]}>
          {currentExercise.muscleGroup.charAt(0).toUpperCase() +
            currentExercise.muscleGroup.slice(1)}{" "}
          · sorted by SFR
        </Text>

        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          {!exercises && (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          )}
          {exercises?.map((ex) => {
            const isCurrent = (ex._id as string) === (currentExercise._id as string);
            const isSelected =
              selected && (selected._id as string) === (ex._id as string);
            return (
              <TouchableOpacity
                key={ex._id as string}
                onPress={() => {
                  if (isCurrent) return;
                  setSelected(isSelected ? null : (ex as SwapExercise));
                }}
                activeOpacity={0.75}
                style={[
                  sheet.row,
                  {
                    backgroundColor: isSelected
                      ? colors.accent + "18"
                      : isCurrent
                      ? colors.fillSecondary
                      : "transparent",
                    borderColor: isSelected ? colors.accent : "transparent",
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.subheadline,
                      {
                        color: colors.label,
                        fontWeight: isCurrent ? "700" : "400",
                      },
                    ]}
                  >
                    {ex.name}
                  </Text>
                  <Text
                    style={[
                      typography.caption2,
                      { color: colors.labelSecondary, marginTop: 2 },
                    ]}
                  >
                    {ex.equipment.toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View
                    style={[
                      sheet.sfrBadge,
                      { backgroundColor: SFR_COLOR[ex.sfr] + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption2,
                        { color: SFR_COLOR[ex.sfr], fontWeight: "700" },
                      ]}
                    >
                      {ex.sfr.toUpperCase()} SFR
                    </Text>
                  </View>
                  {isCurrent && (
                    <Text style={[typography.caption2, { color: colors.accent }]}>
                      current
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selected && (
          <View style={[sheet.actions, { borderTopColor: colors.separator }]}>
            <Text
              style={[
                typography.caption1,
                { color: colors.labelSecondary, marginBottom: 12, textAlign: "center" },
              ]}
            >
              Swap to:{" "}
              <Text style={{ color: colors.label, fontWeight: "700" }}>
                {selected.name}
              </Text>
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={handleTodayOnly}
                style={[sheet.btn, { backgroundColor: colors.fillSecondary, flex: 1 }]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    typography.subheadline,
                    { color: colors.label, fontWeight: "600" },
                  ]}
                >
                  Today only
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateSession}
                disabled={saving || !sessionExerciseId}
                style={[
                  sheet.btn,
                  {
                    backgroundColor:
                      !sessionExerciseId ? colors.fillSecondary : colors.accent,
                    flex: 1,
                    opacity: saving ? 0.7 : 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={[
                      typography.subheadline,
                      {
                        color: !sessionExerciseId ? colors.labelSecondary : "#fff",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    Update session
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  container: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1.5,
  },
  sfrBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actions: {
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 0.5,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
});
