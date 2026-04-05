import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useState, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import { COMMON_FOODS, type FoodItem } from "@/data/commonFoods";
import type { GoalType, MealType } from "@/data/mealPlans";

const C_PROTEIN = P.gold;
const C_CARBS   = "#5A9FD4";
const C_FAT     = "#E88C35";

const GOAL_OPTS: { key: GoalType; label: string }[] = [
  { key: "cut",      label: "CUT"      },
  { key: "maintain", label: "MAINTAIN" },
  { key: "bulk",     label: "BULK"     },
];

const MEAL_TYPE_OPTS: { key: MealType; label: string }[] = [
  { key: "breakfast",    label: "Breakfast"    },
  { key: "lunch",        label: "Lunch"        },
  { key: "dinner",       label: "Dinner"       },
  { key: "snack",        label: "Snack"        },
  { key: "post-workout", label: "Post-Workout" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function round1(n: number) { return Math.round(n * 10) / 10; }

function scaleMacros(food: FoodItem, grams: number) {
  const scale = grams / food.servingG;
  return {
    calories: Math.round(food.calories * scale),
    proteinG: round1(food.proteinG * scale),
    carbsG:   round1(food.carbsG   * scale),
    fatG:     round1(food.fatG     * scale),
  };
}

function MacroChip({ label, val, unit = "g", color }: { label: string; val: number; unit?: string; color: string }) {
  return (
    <View style={{ alignItems: "center", minWidth: 52 }}>
      <Text style={{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 1.5, color, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontFamily: CG, fontSize: 18, color: P.ink }}>
        {val}{unit}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CreateMealScreen() {
  const router    = useRouter();
  const { mealType: paramMealType = "lunch" } = useLocalSearchParams<{ mealType: string }>();
  const { userId } = useCurrentUser();

  const customFoods  = useQuery(api.nutrition.getCustomFoods, userId ? { userId } : "skip") ?? [];
  const saveRecipe   = useMutation(api.userRecipes.saveUserRecipe);

  // ── Form state ────────────────────────────────────────────────────────────
  const [name,        setName]        = useState("");
  const [goal,        setGoal]        = useState<GoalType>("maintain");
  const [mealType,    setMealType]    = useState<MealType>(paramMealType as MealType);
  const [prepTime,    setPrepTime]    = useState("5");
  const [cookTime,    setCookTime]    = useState("10");
  const [ingredients, setIngredients] = useState<{ food: FoodItem; grams: string }[]>([]);
  const [ingSearch,   setIngSearch]   = useState("");
  const [saving,      setSaving]      = useState(false);

  // ── All searchable foods ──────────────────────────────────────────────────
  const customItems: FoodItem[] = useMemo(() => customFoods.map(f => ({
    id:       f._id,
    name:     f.name,
    serving:  f.serving,
    servingG: f.servingG,
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG:   f.carbsG,
    fatG:     f.fatG,
    category: "other" as const,
  })), [customFoods]);

  const allFoods = useMemo(() => [...COMMON_FOODS, ...customItems], [customItems]);

  const ingResults = ingSearch.trim().length >= 1
    ? allFoods.filter(f =>
        f.name.toLowerCase().includes(ingSearch.toLowerCase()) &&
        !ingredients.some(i => i.food.id === f.id)
      ).slice(0, 6)
    : [];

  // ── Live macro totals ─────────────────────────────────────────────────────
  const totals = useMemo(() => ingredients.reduce(
    (acc, { food, grams }) => {
      const g     = Math.max(0, parseFloat(grams) || 0);
      const scale = g / food.servingG;
      return {
        calories: acc.calories + Math.round(food.calories * scale),
        proteinG: acc.proteinG + food.proteinG * scale,
        carbsG:   acc.carbsG   + food.carbsG   * scale,
        fatG:     acc.fatG     + food.fatG     * scale,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  ), [ingredients]);

  // ── Save handler ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userId) return;
    if (!name.trim()) { Alert.alert("Add a meal name"); return; }
    if (ingredients.length === 0) { Alert.alert("Add at least one food"); return; }

    setSaving(true);
    try {
      await saveRecipe({
        userId,
        recipe: {
          name:         name.trim(),
          description:  ingredients.map(i => i.food.name).join(", "),
          goal,
          mealType,
          prepTimeMins: parseInt(prepTime) || 5,
          cookTimeMins: parseInt(cookTime) || 10,
          tags:         ["my-meal"],
          ingredients:  ingredients.map(({ food, grams }) => {
            const g     = Math.max(0, parseFloat(grams) || 0);
            const m     = scaleMacros(food, g);
            return {
              name:     food.name,
              amount:   `${g}g`,
              calories: m.calories,
              proteinG: m.proteinG,
              carbsG:   m.carbsG,
              fatG:     m.fatG,
            };
          }),
          instructions: [],
          totalMacros: {
            calories: totals.calories,
            proteinG: round1(totals.proteinG),
            carbsG:   round1(totals.carbsG),
            fatG:     round1(totals.fatG),
          },
        },
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not save meal");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.closeBtn}>×</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>MEAL PLANNER</Text>
            <Text style={s.heroItalic}>Create Meal.</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.springify()}>

            {/* ── Meal Name ─────────────────────────────────────────────── */}
            <Text style={s.label}>MEAL NAME</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Chicken Rice Bowl"
              placeholderTextColor={P.dim}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
            />

            {/* ── Goal ──────────────────────────────────────────────────── */}
            <Text style={[s.label, { marginBottom: 8 }]}>GOAL</Text>
            <View style={s.goalRow}>
              {GOAL_OPTS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.goalBtn, goal === opt.key && s.goalBtnActive]}
                  onPress={() => setGoal(opt.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.goalBtnText, goal === opt.key && s.goalBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Meal Type ─────────────────────────────────────────────── */}
            <Text style={[s.label, { marginBottom: 8, marginTop: 16 }]}>MEAL TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {MEAL_TYPE_OPTS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.chip, mealType === opt.key && s.chipActive]}
                  onPress={() => setMealType(opt.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, mealType === opt.key && s.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Prep / Cook Time ─────────────────────────────────────── */}
            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { marginBottom: 6 }]}>PREP TIME</Text>
                <View style={s.timeInputWrap}>
                  <TextInput
                    style={s.timeInput}
                    value={prepTime}
                    onChangeText={setPrepTime}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <Text style={s.timeUnit}>min</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { marginBottom: 6 }]}>COOK TIME</Text>
                <View style={s.timeInputWrap}>
                  <TextInput
                    style={s.timeInput}
                    value={cookTime}
                    onChangeText={setCookTime}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <Text style={s.timeUnit}>min</Text>
                </View>
              </View>
            </View>

            {/* ── Ingredients ─────────────────────────────────────────── */}
            <Text style={[s.label, { marginTop: 20, marginBottom: 8 }]}>FOODS</Text>

            {ingredients.map((ing, idx) => {
              const g     = Math.max(0, parseFloat(ing.grams) || 0);
              const scale = g / ing.food.servingG;
              const cals  = Math.round(ing.food.calories * scale);
              return (
                <View key={ing.food.id} style={s.ingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ingName}>{ing.food.name}</Text>
                    <Text style={s.ingMacros}>
                      {cals} kcal · P{round1(ing.food.proteinG * scale)}g
                      · C{round1(ing.food.carbsG * scale)}g
                      · F{round1(ing.food.fatG * scale)}g
                    </Text>
                  </View>
                  <TextInput
                    style={s.gramsInput}
                    value={ing.grams}
                    onChangeText={v => setIngredients(prev =>
                      prev.map((x, i) => i === idx ? { ...x, grams: v } : x)
                    )}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <Text style={s.gramsUnit}>g</Text>
                  <TouchableOpacity
                    onPress={() => setIngredients(prev => prev.filter((_, i) => i !== idx))}
                    hitSlop={10}
                    style={{ paddingLeft: 8 }}
                  >
                    <Text style={{ fontFamily: OUT_L, fontSize: 18, color: P.red, lineHeight: 20 }}>×</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Ingredient search */}
            <View style={s.ingSearchWrap}>
              <Text style={{ fontFamily: OUT_L, fontSize: 14, color: P.gold }}>⊕</Text>
              <TextInput
                style={s.ingSearchInput}
                placeholder="Search foods to add…"
                placeholderTextColor={P.dim}
                value={ingSearch}
                onChangeText={setIngSearch}
                autoCorrect={false}
              />
              {ingSearch.length > 0 && (
                <TouchableOpacity onPress={() => setIngSearch("")} hitSlop={8}>
                  <Text style={{ fontFamily: OUT_L, fontSize: 16, color: P.mid }}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {ingResults.map(food => (
              <TouchableOpacity
                key={food.id}
                style={s.ingResult}
                onPress={() => {
                  setIngredients(prev => [...prev, { food, grams: String(food.servingG) }]);
                  setIngSearch("");
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.ingResultName}>{food.name}</Text>
                  <Text style={s.ingResultServing}>{food.serving} · {food.calories} kcal</Text>
                </View>
                <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.gold, letterSpacing: 1 }}>
                  + ADD
                </Text>
              </TouchableOpacity>
            ))}

            {/* ── Macro Totals ─────────────────────────────────────────── */}
            {ingredients.length > 0 && (
              <Animated.View entering={FadeIn.duration(200)} style={s.totalsCard}>
                <Text style={[s.label, { marginBottom: 12 }]}>TOTAL MACROS</Text>
                <View style={s.totalsRow}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={[s.label, { marginBottom: 3 }]}>KCAL</Text>
                    <Text style={{ fontFamily: CG, fontSize: 30, color: P.gold, lineHeight: 34 }}>
                      {totals.calories}
                    </Text>
                  </View>
                  <MacroChip label="PROTEIN" val={round1(totals.proteinG)} color={C_PROTEIN} />
                  <MacroChip label="CARBS"   val={round1(totals.carbsG)}   color={C_CARBS} />
                  <MacroChip label="FAT"     val={round1(totals.fatG)}     color={C_FAT} />
                </View>
              </Animated.View>
            )}

            {/* ── Save Button ───────────────────────────────────────────── */}
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={P.bg} />
                : <Text style={s.saveBtnText}>SAVE MEAL</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 80 }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header:          { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  closeBtn:        { fontFamily: OUT_L, fontSize: 26, color: P.mid, lineHeight: 30, marginBottom: 6 },
  eyebrow:         { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:      { fontFamily: CG_ITALIC, fontSize: 36, letterSpacing: -0.5, lineHeight: 42, color: P.ink },

  scroll:          { paddingHorizontal: 20, paddingTop: 20 },

  label:           { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: P.mid },
  input:           { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: P.ink, fontFamily: OUT, marginBottom: 16, backgroundColor: P.bg },

  goalRow:         { flexDirection: "row", gap: 8, marginBottom: 4 },
  goalBtn:         { flex: 1, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center" },
  goalBtnActive:   { borderColor: P.gold, backgroundColor: P.goldDim },
  goalBtnText:     { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim },
  goalBtnTextActive: { color: P.gold },

  chipRow:         { gap: 8, paddingBottom: 4 },
  chip:            { paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border },
  chipActive:      { borderColor: P.gold, backgroundColor: P.goldDim },
  chipText:        { fontFamily: OUT_L, fontSize: 10, letterSpacing: 1.5, color: P.dim, textTransform: "uppercase" },
  chipTextActive:  { color: P.gold },

  timeRow:         { flexDirection: "row", gap: 16, marginTop: 16 },
  timeInputWrap:   { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: P.bg },
  timeInput:       { fontFamily: CG, fontSize: 20, color: P.ink, minWidth: 40, textAlign: "center" },
  timeUnit:        { fontFamily: OUT_L, fontSize: 11, color: P.dim },

  ingRow:          { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  ingName:         { fontFamily: OUT, fontSize: 13, color: P.ink, marginBottom: 2 },
  ingMacros:       { fontFamily: OUT_L, fontSize: 10, color: P.mid },
  gramsInput:      { fontFamily: CG, fontSize: 18, color: P.ink, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 6, minWidth: 60, textAlign: "center", backgroundColor: P.bg },
  gramsUnit:       { fontFamily: OUT_L, fontSize: 11, color: P.dim },

  ingSearchWrap:   { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 4, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "60", backgroundColor: P.s1 },
  ingSearchInput:  { flex: 1, fontFamily: OUT_L, fontSize: 14, color: P.ink, paddingVertical: 12 },
  ingResult:       { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  ingResultName:   { fontFamily: OUT, fontSize: 13, color: P.ink, marginBottom: 1 },
  ingResultServing:{ fontFamily: OUT_L, fontSize: 10, color: P.dim },

  totalsCard:      { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "40", padding: 16, marginTop: 20, backgroundColor: P.goldDim },
  totalsRow:       { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },

  saveBtn:         { height: 54, backgroundColor: P.gold, alignItems: "center", justifyContent: "center", marginTop: 24 },
  saveBtnText:     { fontFamily: OUT_L, fontSize: 11, letterSpacing: 3, color: P.bg, fontWeight: "700" },
});
