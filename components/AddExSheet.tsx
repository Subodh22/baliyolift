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
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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

const MUSCLE_OPTIONS = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "abs", "forearms", "cardio",
] as const;

const EQUIPMENT_OPTIONS = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "other"] as const;
const SFR_OPTIONS = ["high", "medium", "low"] as const;

export function AddExSheet({ visible, onAdd, onClose }: Props) {
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();
  const [searchText, setSearchText] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");

  // Create-mode state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState<string>("chest");
  const [newEquipment, setNewEquipment] = useState<string>("dumbbell");
  const [newSfr, setNewSfr] = useState<string>("medium");
  const [saving, setSaving] = useState(false);

  const createExercise = useMutation(api.exercises.create);
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

  const handleClose = () => {
    setCreating(false);
    setNewName("");
    setNewMuscle("chest");
    setNewEquipment("dumbbell");
    setNewSfr("medium");
    onClose();
  };

  const handleCreate = async () => {
    if (!newName.trim() || !userId) return;
    setSaving(true);
    try {
      const id = await createExercise({
        userId,
        name: newName.trim(),
        muscleGroup: newMuscle as any,
        equipment: newEquipment as any,
        sfr: newSfr as any,
      });
      handleSelect({
        _id: id,
        name: newName.trim(),
        muscleGroup: newMuscle,
        equipment: newEquipment,
        sfr: newSfr,
      } as PickedExercise);
      setCreating(false);
      setNewName("");
      setNewMuscle("chest");
      setNewEquipment("dumbbell");
      setNewSfr("medium");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose} />
      <View style={[s.sheet, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[s.handle, { backgroundColor: colors.separator }]} />

        {/* Header */}
        <View style={s.headerRow}>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 17, color: colors.label }}>
            {creating ? "New Exercise" : "Add Exercise"}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (creating) {
                setCreating(false);
                setNewName("");
              } else {
                setCreating(true);
                setNewName(searchText);
              }
            }}
            style={[s.createBtn, { backgroundColor: creating ? colors.backgroundTertiary : colors.accent }]}
          >
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: creating ? colors.labelSecondary : "#FFF", letterSpacing: 0.5 }}>
              {creating ? "Cancel" : "+ Create"}
            </Text>
          </TouchableOpacity>
        </View>

        {creating ? (
          /* ── Create form ── */
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={[s.fieldLabel, { color: colors.labelSecondary }]}>NAME</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Incline Dumbbell Curl"
              placeholderTextColor={colors.labelTertiary}
              style={[s.textInput, { backgroundColor: colors.backgroundTertiary, color: colors.label, borderColor: colors.separator }]}
              autoFocus
              autoCorrect={false}
            />

            {/* Muscle group */}
            <Text style={[s.fieldLabel, { color: colors.labelSecondary }]}>MUSCLE GROUP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4, marginBottom: 16 }}>
              {MUSCLE_OPTIONS.map((mg) => {
                const active = newMuscle === mg;
                const label = (MUSCLE_DISPLAY_NAMES as any)[mg] ?? mg;
                return (
                  <TouchableOpacity key={mg} onPress={() => setNewMuscle(mg)}
                    style={[s.pill, { backgroundColor: active ? colors.accent : colors.backgroundTertiary }]}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: active ? "#FFF" : colors.labelSecondary }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Equipment */}
            <Text style={[s.fieldLabel, { color: colors.labelSecondary }]}>EQUIPMENT</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {EQUIPMENT_OPTIONS.map((eq) => {
                const active = newEquipment === eq;
                return (
                  <TouchableOpacity key={eq} onPress={() => setNewEquipment(eq)}
                    style={[s.pill, { backgroundColor: active ? colors.accent : colors.backgroundTertiary }]}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: active ? "#FFF" : colors.labelSecondary, textTransform: "capitalize" }}>
                      {eq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SFR */}
            <Text style={[s.fieldLabel, { color: colors.labelSecondary }]}>SFR RATING</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}>
              {SFR_OPTIONS.map((sfr) => {
                const active = newSfr === sfr;
                return (
                  <TouchableOpacity key={sfr} onPress={() => setNewSfr(sfr)}
                    style={[s.pill, { backgroundColor: active ? SFR_COLOR[sfr] + "33" : colors.backgroundTertiary, borderWidth: active ? 1 : 0, borderColor: SFR_COLOR[sfr] }]}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: active ? SFR_COLOR[sfr] : colors.labelSecondary, textTransform: "uppercase" }}>
                      {sfr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Save button */}
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!newName.trim() || saving}
              style={[s.saveBtn, { backgroundColor: newName.trim() ? colors.accent : colors.backgroundTertiary }]}
            >
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: newName.trim() ? "#FFF" : colors.labelTertiary }}>
                    Create &amp; Add
                  </Text>
              }
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* ── Browse / search ── */
          <>
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

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {!allExercises && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
              {allExercises && filtered.length === 0 && (
                <View style={{ alignItems: "center", marginTop: 24, gap: 10 }}>
                  <Text style={{ color: colors.labelSecondary, fontFamily: "Outfit_300Light", textAlign: "center" }}>
                    No exercises found
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setCreating(true); setNewName(searchText); }}
                    style={[s.pill, { backgroundColor: colors.accent }]}
                  >
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: "#FFF" }}>
                      + Create "{searchText || "custom exercise"}"
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {filtered.map((ex) => (
                <TouchableOpacity key={ex._id as string} onPress={() => handleSelect(ex as PickedExercise)}
                  activeOpacity={0.75}
                  style={[s.row, { borderColor: colors.separator }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: colors.label }}>{ex.name}</Text>
                    <Text style={{ fontFamily: "Outfit_300Light", fontSize: 12, color: colors.labelSecondary, marginTop: 2 }}>
                      {(MUSCLE_DISPLAY_NAMES as any)[ex.muscleGroup] ?? ex.muscleGroup}  ·  {ex.equipment}
                      {(ex as any).isCustom ? "  ·  custom" : ""}
                      {(ex as any).category === "cardio" ? "  ·  cardio" : ""}
                    </Text>
                  </View>
                  <View style={[s.sfrBadge, { backgroundColor: (SFR_COLOR[ex.sfr] ?? "#888") + "22" }]}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: SFR_COLOR[ex.sfr] ?? "#888" }}>
                      {ex.sfr?.toUpperCase() ?? "—"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:      { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingTop: 12 },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  headerRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  createBtn:  { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  searchRow:  { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  pill:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5 },
  sfrBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  fieldLabel: { fontFamily: "Outfit_300Light", fontSize: 10, letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  textInput:  { fontFamily: "Outfit_400Regular", fontSize: 15, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  saveBtn:    { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
});
