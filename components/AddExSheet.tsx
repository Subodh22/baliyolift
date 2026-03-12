import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/useTheme";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";

export interface PickedExercise {
  _id: Id<"exercises">;
  name: string;
  muscleGroup: string;
  equipment: string;
  sfr: string;
  category?: string;
  cardioMode?: string;
}

interface Props {
  visible: boolean;
  onAdd: (ex: PickedExercise) => void;
  onClose: () => void;
}

const SFR_COLOR: Record<string, string> = {
  high: "#34C759",
  medium: "#FFD60A",
  low: "#FF9F0A",
};

const MUSCLE_GROUPS = [
  "all", "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "abs", "forearms", "cardio",
] as const;

export function AddExSheet({ visible, onAdd, onClose }: Props) {
  const { colors, typography } = useTheme();
  const [searchText, setSearchText] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");

  const allExercises = useQuery(api.exercises.listAll, visible ? {} : "skip");

  const filtered = useMemo(() => {
    if (!allExercises) return [];
    let results = allExercises;
    if (muscleFilter !== "all") {
      results = results.filter((e) => e.muscleGroup === muscleFilter);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      results = results.filter((e) => e.name.toLowerCase().includes(q));
    }
    return results;
  }, [allExercises, muscleFilter, searchText]);

  const handleSelect = (ex: PickedExercise) => {
    onAdd(ex);
    setSearchText("");
    setMuscleFilter("all");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[s.handle, { backgroundColor: colors.separator }]} />

        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 17, color: colors.label, marginBottom: 12 }}>
          Add Exercise
        </Text>

        {/* Search */}
        <View style={[s.searchRow, { backgroundColor: colors.backgroundTertiary, borderColor: colors.separator }]}>
          <Text style={{ color: colors.labelTertiary, marginRight: 8, fontSize: 14 }}>⌕</Text>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search exercises…"
            placeholderTextColor={colors.labelTertiary}
            style={{ flex: 1, color: colors.label, fontFamily: "Outfit_400Regular", fontSize: 15 }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Text style={{ color: colors.labelTertiary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Muscle filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {MUSCLE_GROUPS.map((mg) => {
            const active = muscleFilter === mg;
            const label = mg === "all" ? "All" : (MUSCLE_DISPLAY_NAMES as any)[mg] ?? mg;
            return (
              <TouchableOpacity key={mg} onPress={() => setMuscleFilter(mg)}
                style={[s.pill, { backgroundColor: active ? colors.accent : colors.backgroundTertiary }]}>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: active ? "#FFF" : colors.labelSecondary }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Exercise list */}
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!allExercises && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
          {allExercises && filtered.length === 0 && (
            <Text style={{ color: colors.labelSecondary, fontFamily: "Outfit_300Light", textAlign: "center", marginTop: 24 }}>
              No exercises found
            </Text>
          )}
          {filtered.map((ex) => (
            <TouchableOpacity key={ex._id as string} onPress={() => handleSelect(ex as PickedExercise)}
              activeOpacity={0.75}
              style={[s.row, { borderColor: colors.separator }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: colors.label }}>{ex.name}</Text>
                <Text style={{ fontFamily: "Outfit_300Light", fontSize: 12, color: colors.labelSecondary, marginTop: 2 }}>
                  {(MUSCLE_DISPLAY_NAMES as any)[ex.muscleGroup] ?? ex.muscleGroup}  ·  {ex.equipment}
                  {(ex as any).category === "cardio" ? "  ·  cardio" : ""}
                </Text>
              </View>
              <View style={[s.sfrBadge, { backgroundColor: SFR_COLOR[ex.sfr] + "22" }]}>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: SFR_COLOR[ex.sfr] }}>
                  {ex.sfr.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:      { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingTop: 12 },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  searchRow:  { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  pill:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5 },
  sfrBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
