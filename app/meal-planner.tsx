import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import {
  RECIPES, GOAL_COLORS, MEAL_TYPE_LABELS,
  type Recipe, type GoalType, type MealType,
} from "@/data/mealPlans";

// ── Food preferences type (mirrors Convex schema) ────────────────────────────
type FoodPrefs = {
  proteinSources:      string[];
  carbSources:         string[];
  fatSources:          string[];
  excludedIngredients: string[];
  plannedMealTypes:    string[];
  varietyLevel:        number;
} | null | undefined;

// ── Preference scoring keyword maps ──────────────────────────────────────────
const PROTEIN_KW: Record<string, string[]> = {
  chicken:  ["chicken"],
  beef:     ["beef", "mince"],
  fish:     ["salmon", "tuna", "fish"],
  eggs:     ["egg"],
  turkey:   ["turkey"],
  plant:    ["tofu", "tempeh", "lentil", "bean"],
};
const CARB_KW: Record<string, string[]> = {
  rice:        ["rice"],
  oats:        ["oat"],
  pasta:       ["pasta"],
  potato:      ["potato"],
  sweetPotato: ["sweet potato"],
  bread:       ["bread", "tortilla"],
};
const FAT_KW: Record<string, string[]> = {
  oliveOil: ["olive oil"],
  avocado:  ["avocado"],
  nuts:     ["nut", "almond", "walnut", "cashew", "peanut"],
  dairy:    ["milk", "cheese", "yoghurt", "cream", "butter"],
};

function prefScore(recipe: Recipe, prefs: FoodPrefs): number {
  if (!prefs) return 0;
  const names = recipe.ingredients.map((i) => i.name.toLowerCase());
  for (const excl of prefs.excludedIngredients) {
    if (names.some((n) => n.includes(excl.toLowerCase()))) return -Infinity;
  }
  let hits = 0, total = 0;
  const check = (sources: string[], kwMap: Record<string, string[]>) => {
    for (const src of sources) {
      const kws = kwMap[src] ?? [];
      total++;
      if (names.some((n) => kws.some((kw) => n.includes(kw)))) hits++;
    }
  };
  check(prefs.proteinSources, PROTEIN_KW);
  check(prefs.carbSources,    CARB_KW);
  check(prefs.fatSources,     FAT_KW);
  return total > 0 ? hits / total : 0;
}

function normalizeIngName(n: string) { return n.toLowerCase().replace(/\s*\(.*?\)/g, "").trim(); }

function overlapBonus(recipe: Recipe, usedRecipes: Recipe[]): number {
  if (!usedRecipes.length) return 0;
  const pool = new Set(usedRecipes.flatMap((r) => r.ingredients.map((i) => normalizeIngName(i.name))));
  const mine = recipe.ingredients.map((i) => normalizeIngName(i.name));
  return mine.filter((n) => pool.has(n)).length / Math.max(mine.length, 1);
}

function maxRepeats(varietyLevel: number): number {
  if (varietyLevel === 1) return 4;
  if (varietyLevel === 3) return 1;
  return 2;
}

// ── Macro colours ──────────────────────────────────────────────────────────
const C_PROTEIN = P.gold;
const C_CARBS   = "#5A9FD4";
const C_FAT     = "#E88C35";

function round1(n: number) { return Math.round(n * 10) / 10; }

// ── Date helpers ────────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function formatWeekLabel(monday: Date): string {
  const end = addDays(monday, 6);
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (monday.getMonth() === end.getMonth())
    return `${monday.getDate()} – ${end.getDate()} ${M[monday.getMonth()]}`;
  return `${monday.getDate()} ${M[monday.getMonth()]} – ${end.getDate()} ${M[end.getMonth()]}`;
}

const DAY_LABELS  = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const MEAL_ORDER: MealType[] = ["breakfast","lunch","dinner","snack"];
const PORTION_STEPS = [0.5, 1, 1.5, 2, 3];
const PORTION_LABELS: Record<number, string> = { 0.5: "×½", 1: "×1", 1.5: "×1½", 2: "×2", 3: "×3" };

// ── Recipe map & types ──────────────────────────────────────────────────────
const RECIPE_MAP = new Map<string, Recipe>(RECIPES.map(r => [r.id, r]));

type SlotItem = {
  _id: Id<"mealPlanSlots">;
  recipeId: string;
  portion:  number;
  order:    number;
};
type SlotMap = Record<number, Partial<Record<MealType, SlotItem[]>>>;
type MacroTarget = { calories: number; proteinG: number; carbsG: number; fatG: number };

// ── Macro helpers ───────────────────────────────────────────────────────────
function scaledMacros(recipe: Recipe, portion: number): MacroTarget {
  return {
    calories: Math.round(recipe.totalMacros.calories * portion),
    proteinG: round1(recipe.totalMacros.proteinG * portion),
    carbsG:   round1(recipe.totalMacros.carbsG   * portion),
    fatG:     round1(recipe.totalMacros.fatG      * portion),
  };
}
function sumMacros(items: SlotItem[]): MacroTarget {
  let calories = 0, proteinG = 0, carbsG = 0, fatG = 0;
  for (const item of items) {
    const r = RECIPE_MAP.get(item.recipeId);
    if (!r) continue;
    calories += r.totalMacros.calories * item.portion;
    proteinG += r.totalMacros.proteinG * item.portion;
    carbsG   += r.totalMacros.carbsG   * item.portion;
    fatG     += r.totalMacros.fatG     * item.portion;
  }
  return { calories: Math.round(calories), proteinG: round1(proteinG), carbsG: round1(carbsG), fatG: round1(fatG) };
}

// ── Similarity: top N recipes closest in macros to given recipe ─────────────
function getSimilar(recipe: Recipe, n = 5): Recipe[] {
  const m = recipe.totalMacros;
  return RECIPES
    .filter(r => r.id !== recipe.id)
    .map(r => {
      const score =
        Math.abs(r.totalMacros.calories - m.calories) / (m.calories || 1) * 1.0 +
        Math.abs(r.totalMacros.proteinG - m.proteinG) / (m.proteinG || 1) * 0.6 +
        Math.abs(r.totalMacros.carbsG   - m.carbsG)   / (m.carbsG   || 1) * 0.3 +
        Math.abs(r.totalMacros.fatG     - m.fatG)     / (m.fatG     || 1) * 0.2;
      return { recipe: r, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map(x => x.recipe);
}

// ── Autofill algorithm ──────────────────────────────────────────────────────
const SLOT_WEIGHTS: Record<MealType, number> = {
  breakfast: 0.25, lunch: 0.35, dinner: 0.40, snack: 0, "post-workout": 0,
};

type AutofillEntry = { recipeId: string; portion: number };

/** Pick the PORTION_STEPS value closest to `raw`. */
function snapPortion(raw: number): number {
  return PORTION_STEPS.reduce((prev, p) =>
    Math.abs(p - raw) < Math.abs(prev - raw) ? p : prev
  );
}

function autofillDay(
  target: MacroTarget,
  goal: GoalType,
  existingSlots: Partial<Record<MealType, SlotItem[]>>,
  usedThisWeek: Set<string> = new Set(),
  prefs: FoodPrefs = null,
  weekRecipes: Recipe[] = [],
  usageCount: Map<string, number> = new Map(),
): Partial<Record<MealType, AutofillEntry>> {
  const result: Partial<Record<MealType, AutofillEntry>> = {};
  const usedThisDay = new Set(usedThisWeek);
  const maxRep = prefs ? maxRepeats(prefs.varietyLevel) : 2;
  const activeMeals = prefs ? prefs.plannedMealTypes : ["breakfast","lunch","dinner","snack"];

  const score = (c: Recipe, slotCal: number, slotProt: number, slotCarb: number, slotFat: number): number => {
    const macroS =
      Math.abs(c.totalMacros.calories - slotCal)  / (slotCal  || 1) * 1.0 +
      Math.abs(c.totalMacros.proteinG - slotProt) / (slotProt || 1) * 0.6 +
      Math.abs(c.totalMacros.carbsG   - slotCarb) / (slotCarb || 1) * 0.3 +
      Math.abs(c.totalMacros.fatG     - slotFat)  / (slotFat  || 1) * 0.2;
    const pref = prefScore(c, prefs);
    if (!isFinite(pref)) return Infinity;
    const overlap = overlapBonus(c, weekRecipes);
    return macroS - pref * 1.5 - overlap * 0.5;
  };

  const getCandidates = (mealType: MealType) => {
    const notOverused = (r: Recipe) => (usageCount.get(r.id) ?? 0) < maxRep;
    let c = RECIPES.filter((r) => r.mealType === mealType && r.goal === goal && !usedThisDay.has(r.id) && notOverused(r));
    if (!c.length) c = RECIPES.filter((r) => r.mealType === mealType && !usedThisDay.has(r.id) && notOverused(r));
    if (!c.length) c = RECIPES.filter((r) => r.mealType === mealType);
    return c;
  };

  // Pass 1: fill breakfast / lunch / dinner
  const primaryMeals: MealType[] = ["breakfast", "lunch", "dinner"];
  for (const mealType of primaryMeals) {
    if (!activeMeals.includes(mealType)) continue;
    if ((existingSlots[mealType]?.length ?? 0) > 0) continue;
    const slotCal  = target.calories * SLOT_WEIGHTS[mealType];
    const slotProt = target.proteinG * SLOT_WEIGHTS[mealType];
    const slotCarb = target.carbsG   * SLOT_WEIGHTS[mealType];
    const slotFat  = target.fatG     * SLOT_WEIGHTS[mealType];
    const candidates = getCandidates(mealType);
    if (!candidates.length) continue;
    const best = candidates.reduce((prev, r) =>
      score(r, slotCal, slotProt, slotCarb, slotFat) < score(prev, slotCal, slotProt, slotCarb, slotFat) ? r : prev
    );
    const rawPortion = best.totalMacros.calories > 0 ? slotCal / best.totalMacros.calories : 1;
    result[mealType] = { recipeId: best.id, portion: snapPortion(rawPortion) };
    usedThisDay.add(best.id);
    usageCount.set(best.id, (usageCount.get(best.id) ?? 0) + 1);
    weekRecipes.push(best);
  }

  // Pass 2: snack fills the remaining calorie gap
  if (activeMeals.includes("snack") && (existingSlots["snack"]?.length ?? 0) === 0) {
    let usedCals = 0;
    for (const items of Object.values(existingSlots)) usedCals += sumMacros(items ?? []).calories;
    for (const entry of Object.values(result)) {
      const r = RECIPE_MAP.get(entry.recipeId);
      if (r) usedCals += r.totalMacros.calories * entry.portion;
    }
    const remaining = target.calories - usedCals;
    if (remaining > 50) {
      const candidates = getCandidates("snack");
      if (candidates.length) {
        const best = candidates.reduce((prev, r) =>
          Math.abs(r.totalMacros.calories - remaining) < Math.abs(prev.totalMacros.calories - remaining) ? r : prev
        );
        const rawPortion = best.totalMacros.calories > 0 ? remaining / best.totalMacros.calories : 1;
        result["snack"] = { recipeId: best.id, portion: snapPortion(rawPortion) };
        usedThisDay.add(best.id);
        usageCount.set(best.id, (usageCount.get(best.id) ?? 0) + 1);
        weekRecipes.push(best);
      }
    }
  }

  return result;
}

function projectAutofill(target: MacroTarget, goal: GoalType, existingSlots: Partial<Record<MealType, SlotItem[]>>): MacroTarget {
  const filled = autofillDay(target, goal, existingSlots);
  let calories = 0, proteinG = 0, carbsG = 0, fatG = 0;
  for (const items of Object.values(existingSlots)) {
    const m = sumMacros(items ?? []);
    calories += m.calories; proteinG += m.proteinG; carbsG += m.carbsG; fatG += m.fatG;
  }
  for (const entry of Object.values(filled)) {
    const r = RECIPE_MAP.get(entry.recipeId);
    if (!r) continue;
    calories += r.totalMacros.calories * entry.portion;
    proteinG += r.totalMacros.proteinG * entry.portion;
    carbsG   += r.totalMacros.carbsG   * entry.portion;
    fatG     += r.totalMacros.fatG     * entry.portion;
  }
  return { calories: Math.round(calories), proteinG: round1(proteinG), carbsG: round1(carbsG), fatG: round1(fatG) };
}

// ── Shared small components ─────────────────────────────────────────────────
function GoalBadge({ goal }: { goal: GoalType }) {
  const c = GOAL_COLORS[goal];
  return (
    <View style={[gb.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[gb.text, { color: c.text }]}>{goal.toUpperCase()}</Text>
    </View>
  );
}
const gb = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderWidth: StyleSheet.hairlineWidth },
  text:  { fontFamily: OUT_L, fontSize: 7, letterSpacing: 2 },
});

function MacroBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={mbar.track}>
      <View style={[mbar.fill, { width: `${pct * 100}%`, backgroundColor: value > target && target > 0 ? P.red : color }]} />
    </View>
  );
}
const mbar = StyleSheet.create({
  track: { flex: 1, height: 3, backgroundColor: P.s3, overflow: "hidden" },
  fill:  { height: "100%" },
});

// ── Item Detail Modal ───────────────────────────────────────────────────────
function ItemDetailModal({
  item,
  mealType,
  onUpdatePortion,
  onSwap,
  onRemove,
  onClose,
}: {
  item:     SlotItem;
  mealType: MealType;
  onUpdatePortion: (portion: number) => void;
  onSwap:   (recipeId: string) => void;
  onRemove: () => void;
  onClose:  () => void;
}) {
  const recipe = RECIPE_MAP.get(item.recipeId);
  const [portion, setPortion] = useState(item.portion);
  const [showSwap, setShowSwap] = useState(false);
  // useMemo must be called before any early return (Rules of Hooks)
  const similar = useMemo(() => recipe ? getSimilar(recipe, 5) : [], [recipe?.id]);

  if (!recipe) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg, alignItems: "center", justifyContent: "center" }} edges={["top","bottom"]}>
      <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid }}>Recipe not found</Text>
    </SafeAreaView>
  );

  const macros = scaledMacros(recipe, portion);

  const handlePortionChange = (p: number) => {
    setPortion(p);
    onUpdatePortion(p);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top","bottom"]}>
      {/* Header */}
      <View style={id.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={id.closeText}>×</Text>
        </TouchableOpacity>
        <Text style={id.headerTitle}>{MEAL_TYPE_LABELS[mealType].toUpperCase()}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={12}>
          <Text style={id.removeText}>REMOVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={id.scroll} showsVerticalScrollIndicator={false}>

        {/* Recipe identity */}
        <View style={id.topRow}>
          <GoalBadge goal={recipe.goal} />
          <Text style={id.mealTypeLabel}>{MEAL_TYPE_LABELS[recipe.mealType].toUpperCase()}</Text>
          <Text style={id.timeLabel}>⏱ {recipe.prepTimeMins + recipe.cookTimeMins} min</Text>
        </View>
        <Text style={id.name}>{recipe.name}</Text>
        <Text style={id.desc}>{recipe.description}</Text>

        {/* Portion stepper */}
        <Text style={id.sectionLabel}>PORTION</Text>
        <View style={id.portionRow}>
          {PORTION_STEPS.map(p => (
            <TouchableOpacity
              key={p}
              style={[id.portionBtn, portion === p && id.portionBtnActive]}
              onPress={() => handlePortionChange(p)}
            >
              <Text style={[id.portionText, portion === p && id.portionTextActive]}>
                {PORTION_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Macro summary (scaled) */}
        <View style={id.macroCard}>
          <View style={id.macroRow}>
            <View style={id.macroItem}>
              <Text style={[id.macroBig, { color: P.gold }]}>{macros.calories}</Text>
              <Text style={id.macroLabel}>KCAL</Text>
            </View>
            <View style={id.macroDivider} />
            <View style={id.macroItem}>
              <Text style={[id.macroBig, { color: C_PROTEIN }]}>{macros.proteinG}</Text>
              <Text style={id.macroLabel}>PROTEIN</Text>
            </View>
            <View style={id.macroDivider} />
            <View style={id.macroItem}>
              <Text style={[id.macroBig, { color: C_CARBS }]}>{macros.carbsG}</Text>
              <Text style={id.macroLabel}>CARBS</Text>
            </View>
            <View style={id.macroDivider} />
            <View style={id.macroItem}>
              <Text style={[id.macroBig, { color: C_FAT }]}>{macros.fatG}</Text>
              <Text style={id.macroLabel}>FAT</Text>
            </View>
          </View>
          <Text style={id.macroNote}>grams · adjusted for {PORTION_LABELS[portion]} portion</Text>
        </View>

        {/* Ingredients */}
        <Text style={id.sectionLabel}>INGREDIENTS</Text>
        <View style={id.ingTable}>
          <View style={[id.ingRow, id.ingHeader]}>
            <Text style={[id.ingCell, id.ingHeaderText, { flex: 2 }]}>ITEM</Text>
            <Text style={[id.ingCell, id.ingHeaderText]}>KCAL</Text>
            <Text style={[id.ingCell, id.ingHeaderText, { color: C_PROTEIN }]}>P</Text>
            <Text style={[id.ingCell, id.ingHeaderText, { color: C_CARBS }]}>C</Text>
            <Text style={[id.ingCell, id.ingHeaderText, { color: C_FAT }]}>F</Text>
          </View>
          {recipe.ingredients.map((ing, idx) => (
            <View key={idx} style={[id.ingRow, idx % 2 === 1 && id.ingAlt]}>
              <View style={{ flex: 2 }}>
                <Text style={id.ingName}>{ing.name}</Text>
                <Text style={id.ingAmount}>{ing.amount}</Text>
              </View>
              <Text style={[id.ingCell, id.ingValue]}>{Math.round(ing.calories * portion)}</Text>
              <Text style={[id.ingCell, id.ingValue, { color: C_PROTEIN }]}>{round1(ing.proteinG * portion)}</Text>
              <Text style={[id.ingCell, id.ingValue, { color: C_CARBS }]}>{round1(ing.carbsG * portion)}</Text>
              <Text style={[id.ingCell, id.ingValue, { color: C_FAT }]}>{round1(ing.fatG * portion)}</Text>
            </View>
          ))}
        </View>

        {/* Method */}
        <Text style={id.sectionLabel}>METHOD</Text>
        <View style={id.steps}>
          {recipe.instructions.map((step, idx) => (
            <View key={idx} style={id.stepRow}>
              <View style={id.stepNum}><Text style={id.stepNumText}>{idx + 1}</Text></View>
              <Text style={id.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Swap section */}
        <TouchableOpacity
          style={id.swapToggle}
          onPress={() => setShowSwap(v => !v)}
        >
          <Text style={id.swapToggleText}>SWAP WITH SIMILAR</Text>
          <Text style={id.swapToggleChevron}>{showSwap ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        {showSwap && (
          <Animated.View entering={FadeIn.duration(180)}>
            {similar.map(r => {
              const diff = Math.round(r.totalMacros.calories - recipe.totalMacros.calories);
              const sign = diff > 0 ? "+" : "";
              return (
                <TouchableOpacity
                  key={r.id}
                  style={id.similarRow}
                  onPress={() => onSwap(r.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <GoalBadge goal={r.goal} />
                      <Text style={id.similarMealType}>{MEAL_TYPE_LABELS[r.mealType].toUpperCase()}</Text>
                    </View>
                    <Text style={id.similarName}>{r.name}</Text>
                    <Text style={id.similarMacros}>
                      {r.totalMacros.calories} kcal · P{round1(r.totalMacros.proteinG)} · C{round1(r.totalMacros.carbsG)} · F{round1(r.totalMacros.fatG)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Text style={[id.diffText, { color: diff === 0 ? P.mid : diff > 0 ? P.red : P.green }]}>
                      {sign}{diff} kcal
                    </Text>
                    <Text style={id.swapAction}>SWAP →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const id = StyleSheet.create({
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  closeText:       { fontFamily: OUT_L, fontSize: 26, color: P.mid, lineHeight: 28 },
  headerTitle:     { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.mid, textTransform: "uppercase" },
  removeText:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.red },
  scroll:          { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  topRow:          { flexDirection: "row", alignItems: "center", gap: 10 },
  mealTypeLabel:   { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
  timeLabel:       { fontFamily: OUT_L, fontSize: 11, color: P.dim, marginLeft: "auto" },
  name:            { fontFamily: CG_ITALIC, fontSize: 30, color: P.ink, letterSpacing: -0.3, lineHeight: 36 },
  desc:            { fontFamily: OUT_L, fontSize: 12, color: P.mid, lineHeight: 18 },
  sectionLabel:    { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.mid, textTransform: "uppercase", marginBottom: -6 },
  portionRow:      { flexDirection: "row", gap: 8 },
  portionBtn:      { flex: 1, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center" },
  portionBtnActive:{ borderColor: P.gold, backgroundColor: P.goldDim },
  portionText:     { fontFamily: CG, fontSize: 16, color: P.mid },
  portionTextActive:{ color: P.gold },
  macroCard:       { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, backgroundColor: P.s1, padding: 18, gap: 10 },
  macroRow:        { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  macroItem:       { alignItems: "center", flex: 1, gap: 3 },
  macroBig:        { fontFamily: CG, fontSize: 28, lineHeight: 32 },
  macroLabel:      { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  macroDivider:    { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: P.border },
  macroNote:       { fontFamily: OUT_L, fontSize: 9, color: P.dim, textAlign: "center" },
  ingTable:        { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border },
  ingRow:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  ingHeader:       { backgroundColor: P.s2 },
  ingAlt:          { backgroundColor: P.s1 },
  ingHeaderText:   { fontFamily: OUT_L, fontSize: 8, letterSpacing: 1.5, color: P.mid, textTransform: "uppercase", textAlign: "right" },
  ingCell:         { width: 38, textAlign: "right" },
  ingName:         { fontFamily: OUT, fontSize: 13, color: P.ink, marginBottom: 1 },
  ingAmount:       { fontFamily: CG, fontSize: 16, color: P.ink },
  ingValue:        { fontFamily: CG, fontSize: 13, color: P.ink },
  steps:           { gap: 10 },
  stepRow:         { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum:         { width: 22, height: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText:     { fontFamily: CG, fontSize: 12, color: P.gold },
  stepText:        { flex: 1, fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20 },
  swapToggle:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 14 },
  swapToggleText:  { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.gold, textTransform: "uppercase" },
  swapToggleChevron: { fontFamily: OUT_L, fontSize: 10, color: P.gold },
  similarRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border, gap: 12 },
  similarMealType: { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.dim },
  similarName:     { fontFamily: OUT, fontSize: 14, color: P.ink, marginBottom: 3 },
  similarMacros:   { fontFamily: OUT_L, fontSize: 11, color: P.mid },
  diffText:        { fontFamily: CG, fontSize: 13 },
  swapAction:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold },
});

// ── Recipe Picker Modal ─────────────────────────────────────────────────────
function RecipePicker({
  mealType,
  onPick,
  onClose,
}: { mealType: MealType; onPick: (r: Recipe) => void; onClose: () => void }) {
  const [goalFilter, setGoalFilter] = useState<"all" | GoalType>("all");
  const filtered = useMemo(() =>
    RECIPES
      .filter(r => goalFilter === "all" || r.goal === goalFilter)
      .sort((a, b) => (a.mealType === mealType ? 0 : 1) - (b.mealType === mealType ? 0 : 1))
  , [goalFilter, mealType]);

  const GOAL_OPTS: { key: "all" | GoalType; label: string }[] = [
    { key: "all", label: "ALL" }, { key: "cut", label: "CUT" },
    { key: "bulk", label: "BULK" }, { key: "maintain", label: "MAINTAIN" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top","bottom"]}>
      <View style={rp.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}><Text style={rp.closeText}>×</Text></TouchableOpacity>
        <Text style={rp.title}>ADD TO {MEAL_TYPE_LABELS[mealType].toUpperCase()}</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={rp.goalRow}>
        {GOAL_OPTS.map(opt => (
          <TouchableOpacity key={opt.key} style={[rp.goalBtn, goalFilter === opt.key && rp.goalBtnActive]} onPress={() => setGoalFilter(opt.key)}>
            <Text style={[rp.goalBtnText, goalFilter === opt.key && { color: P.gold }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={rp.list} showsVerticalScrollIndicator={false}>
        {filtered.map(recipe => {
          const m = recipe.totalMacros;
          return (
            <TouchableOpacity key={recipe.id} style={rp.row} onPress={() => onPick(recipe)} activeOpacity={0.75}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <GoalBadge goal={recipe.goal} />
                  <Text style={rp.mealTypeLabel}>{MEAL_TYPE_LABELS[recipe.mealType].toUpperCase()}</Text>
                </View>
                <Text style={rp.name}>{recipe.name}</Text>
                <Text style={rp.macroLine}>{m.calories} kcal · P{round1(m.proteinG)}g · C{round1(m.carbsG)}g · F{round1(m.fatG)}g</Text>
              </View>
              <Text style={rp.addText}>+ ADD</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
const rp = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  closeText:    { fontFamily: OUT_L, fontSize: 26, color: P.mid, lineHeight: 28 },
  title:        { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.ink, textTransform: "uppercase" },
  goalRow:      { flexDirection: "row", paddingHorizontal: 16, gap: 6, paddingVertical: 12 },
  goalBtn:      { flex: 1, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center" },
  goalBtnActive:{ borderColor: P.gold, backgroundColor: P.goldDim },
  goalBtnText:  { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.dim, textTransform: "uppercase" },
  list:         { paddingHorizontal: 16 },
  row:          { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border, gap: 12 },
  mealTypeLabel:{ fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.dim },
  name:         { fontFamily: OUT, fontSize: 14, color: P.ink, marginBottom: 3 },
  macroLine:    { fontFamily: OUT_L, fontSize: 11, color: P.mid },
  addText:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold },
});

// ── Copy Day Modal ──────────────────────────────────────────────────────────
function CopyDayModal({ fromDayIndex, onCopy, onClose }: { fromDayIndex: number; onCopy: (i: number) => void; onClose: () => void }) {
  return (
    <View style={cd.wrap}>
      <Text style={cd.title}>COPY {DAY_LABELS[fromDayIndex]} TO</Text>
      <View style={cd.grid}>
        {DAY_LABELS.map((label, idx) => idx === fromDayIndex ? null : (
          <TouchableOpacity key={idx} style={cd.btn} onPress={() => onCopy(idx)}>
            <Text style={cd.btnText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onClose} style={cd.cancel}>
        <Text style={cd.cancelText}>CANCEL</Text>
      </TouchableOpacity>
    </View>
  );
}
const cd = StyleSheet.create({
  wrap:       { backgroundColor: P.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 20, margin: 20 },
  title:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.mid, textTransform: "uppercase", textAlign: "center", marginBottom: 16 },
  grid:       { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  btn:        { flex: 1, minWidth: "28%", paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center" },
  btnText:    { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.gold },
  cancel:     { marginTop: 14, alignItems: "center", paddingVertical: 8 },
  cancelText: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
});

// ── AutoFill Modal ──────────────────────────────────────────────────────────
function AutoFillModal({
  target, defaultGoal, existingSlots, filling,
  onFillDay, onFillWeek, onClose,
}: {
  target: MacroTarget; defaultGoal: GoalType;
  existingSlots: Partial<Record<MealType, SlotItem[]>>;
  filling: boolean;
  onFillDay:  (goal: GoalType) => void;
  onFillWeek: (goal: GoalType) => void;
  onClose: () => void;
}) {
  const [goal, setGoal] = useState<GoalType>(defaultGoal);
  const preview = useMemo(() => projectAutofill(target, goal, existingSlots), [target, goal, existingSlots]);
  const calPct  = target.calories > 0 ? preview.calories / target.calories : 0;
  const calOver = preview.calories > target.calories;

  const GOAL_OPTS: { key: GoalType; label: string }[] = [
    { key: "cut", label: "CUT" }, { key: "bulk", label: "BULK" }, { key: "maintain", label: "MAINTAIN" },
  ];
  return (
    <View style={af.wrap}>
      <View style={af.header}>
        <Text style={af.title}>AUTO-FILL MEALS</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12}><Text style={af.closeText}>×</Text></TouchableOpacity>
      </View>
      <Text style={af.sectionLabel}>GOAL</Text>
      <View style={af.goalRow}>
        {GOAL_OPTS.map(opt => {
          const c = GOAL_COLORS[opt.key]; const active = goal === opt.key;
          return (
            <TouchableOpacity key={opt.key} style={[af.goalBtn, active && { borderColor: c.border, backgroundColor: c.bg }]} onPress={() => setGoal(opt.key)}>
              <Text style={[af.goalBtnText, active && { color: c.text }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[af.sectionLabel, { marginTop: 14 }]}>TODAY'S PROJECTION</Text>
      <View style={af.previewCard}>
        <View style={af.previewTop}>
          <Text style={[af.previewCals, calOver && { color: P.red }]}>{preview.calories}</Text>
          <Text style={af.previewOf}> / {target.calories} kcal</Text>
          <Text style={[af.previewPct, calOver && { color: P.red }]}>{Math.round(calPct * 100)}%</Text>
        </View>
        <View style={af.barTrack}><View style={[af.barFill, { width: `${Math.min(calPct,1)*100}%` }, calOver && { backgroundColor: P.red }]} /></View>
        <View style={af.macroRow}>
          {[{ val: preview.proteinG, lbl: "PROTEIN", color: C_PROTEIN }, { val: preview.carbsG, lbl: "CARBS", color: C_CARBS }, { val: preview.fatG, lbl: "FAT", color: C_FAT }].map(({ val, lbl, color }) => (
            <View key={lbl} style={af.macroItem}>
              <Text style={[af.macroVal, { color }]}>{val}g</Text>
              <Text style={af.macroLbl}>{lbl}</Text>
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity style={[af.fillBtn, filling && { opacity: 0.5 }]} onPress={() => onFillDay(goal)} disabled={filling}>
        {filling ? <ActivityIndicator color={P.gold} /> : <Text style={af.fillBtnText}>FILL TODAY</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={[af.fillBtnSecondary, filling && { opacity: 0.5 }]} onPress={() => onFillWeek(goal)} disabled={filling}>
        <Text style={af.fillBtnSecondaryText}>FILL ENTIRE WEEK</Text>
        <Text style={af.fillBtnSecondaryNote}>fills all 7 days · varies recipes</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} style={af.cancelBtn}><Text style={af.cancelText}>CANCEL</Text></TouchableOpacity>
    </View>
  );
}
const af = StyleSheet.create({
  wrap:              { backgroundColor: P.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, margin: 16, padding: 20, gap: 10 },
  header:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title:             { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.ink, textTransform: "uppercase" },
  closeText:         { fontFamily: OUT_L, fontSize: 22, color: P.mid, lineHeight: 24 },
  sectionLabel:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.mid, textTransform: "uppercase" },
  goalRow:           { flexDirection: "row", gap: 8, marginTop: 6 },
  goalBtn:           { flex: 1, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center" },
  goalBtnText:       { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim, textTransform: "uppercase" },
  previewCard:       { backgroundColor: P.s2, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 16, gap: 10, marginTop: 4 },
  previewTop:        { flexDirection: "row", alignItems: "baseline", gap: 4 },
  previewCals:       { fontFamily: CG, fontSize: 28, color: P.gold, lineHeight: 32 },
  previewOf:         { fontFamily: OUT_L, fontSize: 12, color: P.mid, flex: 1 },
  previewPct:        { fontFamily: OUT_L, fontSize: 12, color: P.mid },
  barTrack:          { height: 4, backgroundColor: P.s3, overflow: "hidden" },
  barFill:           { height: "100%", backgroundColor: P.gold },
  macroRow:          { flexDirection: "row", justifyContent: "space-around" },
  macroItem:         { alignItems: "center", gap: 3 },
  macroVal:          { fontFamily: CG, fontSize: 18, lineHeight: 22 },
  macroLbl:          { fontFamily: OUT_L, fontSize: 8, letterSpacing: 1.5, color: P.dim, textTransform: "uppercase" },
  fillBtn:           { height: 52, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center", justifyContent: "center", marginTop: 6 },
  fillBtnText:       { fontFamily: OUT_L, fontSize: 11, letterSpacing: 3, color: P.gold, textTransform: "uppercase" },
  fillBtnSecondary:  { height: 52, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center", justifyContent: "center" },
  fillBtnSecondaryText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  fillBtnSecondaryNote: { fontFamily: OUT_L, fontSize: 9, color: P.dim, marginTop: 2 },
  cancelBtn:         { alignItems: "center", paddingVertical: 8 },
  cancelText:        { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim },
});

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function MealPlannerScreen() {
  const router   = useRouter();
  const { userId } = useCurrentUser();

  // ── Week ─────────────────────────────────────────────────────────────────
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMonday(new Date()));
  const weekStart = toDateStr(weekMonday);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeDay,    setActiveDay]    = useState(0);
  const [pickerMeal,   setPickerMeal]   = useState<MealType | null>(null);
  const [activeItem,   setActiveItem]   = useState<{ item: SlotItem; mealType: MealType } | null>(null);
  const [copyFrom,     setCopyFrom]     = useState<number | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [copying,           setCopying]           = useState(false);
  const [filling,           setFilling]           = useState(false);
  const [resetting,         setResetting]         = useState(false);
  const [resetConfirmOpen,  setResetConfirmOpen]  = useState(false);

  // ── Convex ───────────────────────────────────────────────────────────────
  const rawSlots  = useQuery(api.mealPlanSlots.getWeekSlots, userId ? { userId, weekStart } : "skip") ?? [];
  const targets   = useQuery(api.nutrition.getFoodTarget,    userId ? { userId } : "skip");
  const prefs     = useQuery(api.foodPreferences.get,        userId ? { userId } : "skip");
  const addItem        = useMutation(api.mealPlanSlots.addItem);
  const updatePortion  = useMutation(api.mealPlanSlots.updatePortion);
  const swapItem       = useMutation(api.mealPlanSlots.swapItem);
  const removeItem     = useMutation(api.mealPlanSlots.removeItem);
  const copyDay        = useMutation(api.mealPlanSlots.copyDay);
  const deleteItems        = useMutation(api.mealPlanSlots.deleteItems);
  const clearAllUserSlots  = useMutation(api.mealPlanSlots.clearAllUserSlots);

  // ── Slot map ─────────────────────────────────────────────────────────────
  const slotMap: SlotMap = useMemo(() => {
    const map: SlotMap = {};
    for (let i = 0; i < 7; i++) map[i] = {};
    for (const s of rawSlots) {
      const mt = s.mealType as MealType;
      if (!map[s.dayIndex][mt]) map[s.dayIndex][mt] = [];
      map[s.dayIndex][mt]!.push({ _id: s._id, recipeId: s.recipeId, portion: s.portion ?? 1, order: s.order ?? 0 });
      map[s.dayIndex][mt]!.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [rawSlots]);

  // ── Day totals ────────────────────────────────────────────────────────────
  const dayTotals = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      let total = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
      for (const items of Object.values(slotMap[i] ?? {})) {
        const m = sumMacros(items ?? []);
        total.calories += m.calories; total.proteinG += m.proteinG;
        total.carbsG   += m.carbsG;   total.fatG     += m.fatG;
      }
      return { calories: Math.round(total.calories), proteinG: round1(total.proteinG), carbsG: round1(total.carbsG), fatG: round1(total.fatG) };
    })
  , [slotMap]);

  // ── Weekly average ────────────────────────────────────────────────────────
  const weeklyAvg = useMemo(() => {
    const days = dayTotals.filter(d => d.calories > 0).length || 1;
    return {
      calories: Math.round(dayTotals.reduce((s, d) => s + d.calories, 0) / days),
      proteinG: round1(dayTotals.reduce((s, d) => s + d.proteinG, 0) / days),
      carbsG:   round1(dayTotals.reduce((s, d) => s + d.carbsG,   0) / days),
      fatG:     round1(dayTotals.reduce((s, d) => s + d.fatG,     0) / days),
    };
  }, [dayTotals]);

  const tgt = targets ?? { calories: 2000, proteinG: 160, carbsG: 200, fatG: 60 };

  // ── Derived active day ────────────────────────────────────────────────────
  const activeDaySlots = slotMap[activeDay] ?? {};
  const activeDayTotal = dayTotals[activeDay];
  const calPct  = tgt.calories > 0 ? activeDayTotal.calories / tgt.calories : 0;
  const calOver = activeDayTotal.calories > tgt.calories;
  const activeDayDate  = addDays(weekMonday, activeDay);
  const activeDayLabel = `${activeDayDate.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][activeDayDate.getMonth()]}`;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePickRecipe = async (recipe: Recipe) => {
    if (!userId || !pickerMeal) return;
    await addItem({ userId, weekStart, dayIndex: activeDay, mealType: pickerMeal, recipeId: recipe.id, portion: 1 });
    setPickerMeal(null);
  };

  const handleUpdatePortion = async (portion: number) => {
    if (!activeItem) return;
    await updatePortion({ itemId: activeItem.item._id, portion });
    // update local modal state too
    setActiveItem(prev => prev ? { ...prev, item: { ...prev.item, portion } } : null);
  };

  const handleSwap = async (newRecipeId: string) => {
    if (!activeItem) return;
    await swapItem({ itemId: activeItem.item._id, recipeId: newRecipeId });
    setActiveItem(prev => prev ? { ...prev, item: { ...prev.item, recipeId: newRecipeId } } : null);
  };

  const handleRemoveItem = async () => {
    if (!activeItem) return;
    await removeItem({ itemId: activeItem.item._id });
    setActiveItem(null);
  };

  const handleCopyDay = async (toDayIndex: number) => {
    if (!userId || copyFrom === null) return;
    setCopying(true); setCopyFrom(null);
    try { await copyDay({ userId, weekStart, fromDayIndex: copyFrom, toDayIndex }); setActiveDay(toDayIndex); }
    finally { setCopying(false); }
  };

  const handleAutofillDay = async (goal: GoalType) => {
    if (!userId) return;
    setFilling(true); setAutofillOpen(false);
    try {
      const filled = autofillDay(tgt, goal, activeDaySlots, new Set(), prefs ?? null);
      for (const [mealType, entry] of Object.entries(filled) as [MealType, AutofillEntry][]) {
        if (!entry) continue;
        await addItem({ userId, weekStart, dayIndex: activeDay, mealType, recipeId: entry.recipeId, portion: entry.portion });
      }
    } finally { setFilling(false); }
  };

  const handleAutofillWeek = async (goal: GoalType) => {
    if (!userId) return;
    setFilling(true); setAutofillOpen(false);
    try {
      const used        = new Set<string>();
      const weekRecipes: Recipe[] = [];
      const usageCount  = new Map<string, number>();
      for (let d = 0; d < 7; d++) {
        const filled = autofillDay(tgt, goal, slotMap[d] ?? {}, used, prefs ?? null, weekRecipes, usageCount);
        for (const [mealType, entry] of Object.entries(filled) as [MealType, AutofillEntry][]) {
          if (!entry) continue;
          await addItem({ userId, weekStart, dayIndex: d, mealType, recipeId: entry.recipeId, portion: entry.portion });
          used.add(entry.recipeId);
        }
      }
    } finally { setFilling(false); }
  };

  const prevWeek = () => setWeekMonday(d => addDays(d, -7));
  const nextWeek = () => setWeekMonday(d => addDays(d,  7));

  const handleResetWeek = () => setResetConfirmOpen(true);

  const handleConfirmReset = async () => {
    if (!userId) return;
    setResetting(true);
    setResetConfirmOpen(false);
    try {
      await clearAllUserSlots({ userId });
    } finally {
      setResetting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>NUTRITION</Text>
          <Text style={s.heroItalic}>Week Plan.</Text>
        </View>
      </View>

      {/* Week navigator */}
      <View style={s.weekNav}>
        <TouchableOpacity onPress={prevWeek} hitSlop={12}><Text style={s.weekArrow}>‹</Text></TouchableOpacity>
        <Text style={s.weekLabel}>{formatWeekLabel(weekMonday)}</Text>
        <TouchableOpacity onPress={nextWeek} hitSlop={12}><Text style={s.weekArrow}>›</Text></TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/grocery-list", params: { weekStart } })}
          hitSlop={12}
          style={s.listBtn}
        >
          <Text style={s.listBtnText}>LIST</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleResetWeek}
          hitSlop={12}
          style={[s.resetBtn, resetting && { opacity: 0.4 }]}
          disabled={resetting}
        >
          {resetting
            ? <ActivityIndicator size="small" color={P.red} style={{ paddingHorizontal: 4 }} />
            : <Text style={s.resetBtnText}>RESET</Text>}
        </TouchableOpacity>
      </View>

      {/* Day tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayTabs}>
        {DAY_LABELS.map((label, idx) => {
          const tot = dayTotals[idx];
          const pct = tgt.calories > 0 ? Math.min(tot.calories / tgt.calories, 1) : 0;
          const isActive = activeDay === idx;
          return (
            <TouchableOpacity key={idx} style={[s.dayTab, isActive && s.dayTabActive]} onPress={() => setActiveDay(idx)}>
              <Text style={[s.dayTabLabel, isActive && s.dayTabLabelActive]}>{label}</Text>
              <View style={s.dayTabBar}>
                <View style={[s.dayTabFill, { width: `${pct*100}%` }, tot.calories > 0 && { backgroundColor: tot.calories > tgt.calories ? P.red : P.gold }]} />
              </View>
              {tot.calories > 0 && <Text style={[s.dayTabCals, isActive && { color: P.gold }]}>{tot.calories}</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Sticky daily total strip ─────────────────────────────────── */}
        <View style={s.dailyStrip}>
          <View style={s.dailyStripTop}>
            <Text style={s.dailyStripLabel}>{DAY_LABELS[activeDay]} TOTAL</Text>
            <Text style={[s.dailyStripCals, calOver && { color: P.red }]}>
              {activeDayTotal.calories}<Text style={s.dailyStripOf}> / {tgt.calories}</Text>
            </Text>
            <Text style={[s.dailyStripPct, calOver && { color: P.red }]}>{Math.round(calPct * 100)}%</Text>
          </View>
          {/* Calorie bar */}
          <View style={s.dailyBar}>
            <View style={[s.dailyBarFill, { width: `${Math.min(calPct, 1) * 100}%` }, calOver && { backgroundColor: P.red }]} />
          </View>
          {/* Macro pills */}
          <View style={s.dailyMacros}>
            {[
              { label: "P", val: activeDayTotal.proteinG, tgt: tgt.proteinG, color: C_PROTEIN },
              { label: "C", val: activeDayTotal.carbsG,   tgt: tgt.carbsG,   color: C_CARBS   },
              { label: "F", val: activeDayTotal.fatG,     tgt: tgt.fatG,     color: C_FAT     },
            ].map(({ label, val, tgt: t, color }) => (
              <View key={label} style={s.dailyMacroPill}>
                <Text style={[s.dailyMacroLabel, { color }]}>{label}</Text>
                <Text style={[s.dailyMacroVal, val > t && t > 0 && { color: P.red }]}>{val}<Text style={s.dailyMacroOf}>/{t}g</Text></Text>
                <MacroBar value={val} target={t} color={color} />
              </View>
            ))}
          </View>
        </View>

        {/* ── Day header + actions ─────────────────────────────────────── */}
        <View style={s.dayHeader}>
          <View>
            <Text style={s.dayTitle}>{DAY_LABELS[activeDay]}</Text>
            <Text style={s.dayDate}>{activeDayLabel}</Text>
          </View>
          <View style={s.dayActions}>
            <TouchableOpacity
              style={[s.actionBtn, (copying || filling || Object.keys(activeDaySlots).length === 0) && { opacity: 0.4 }]}
              onPress={() => setCopyFrom(activeDay)}
              disabled={copying || filling || Object.keys(activeDaySlots).length === 0}
            >
              {copying ? <ActivityIndicator size="small" color={P.gold} /> : <Text style={s.actionBtnText}>COPY</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnGold, filling && { opacity: 0.4 }]}
              onPress={() => setAutofillOpen(true)}
              disabled={filling}
            >
              {filling ? <ActivityIndicator size="small" color={P.gold} /> : <Text style={s.actionBtnGoldText}>AUTO-FILL ✦</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Meal slots ───────────────────────────────────────────────── */}
        {MEAL_ORDER.map(mealType => {
          const items = activeDaySlots[mealType] ?? [];
          const slotTotal = sumMacros(items);
          return (
            <Animated.View key={mealType} entering={FadeInDown.springify().damping(22)}>
              <View style={s.slotWrap}>
                {/* Slot header */}
                <View style={s.slotHeader}>
                  <Text style={s.slotLabel}>{MEAL_TYPE_LABELS[mealType].toUpperCase()}</Text>
                  {items.length > 0 && (
                    <Text style={s.slotTotal}>
                      {slotTotal.calories} kcal · P{slotTotal.proteinG} · C{slotTotal.carbsG} · F{slotTotal.fatG}
                    </Text>
                  )}
                </View>

                {/* Existing items */}
                {items.map(item => {
                  const recipe = RECIPE_MAP.get(item.recipeId);
                  if (!recipe) return null;
                  const macros = scaledMacros(recipe, item.portion);
                  return (
                    <TouchableOpacity
                      key={item._id}
                      style={s.itemCard}
                      onPress={() => setActiveItem({ item, mealType })}
                      activeOpacity={0.82}
                    >
                      <View style={s.itemCardTop}>
                        <GoalBadge goal={recipe.goal} />
                        {item.portion !== 1 && (
                          <View style={s.portionBadge}>
                            <Text style={s.portionBadgeText}>{PORTION_LABELS[item.portion] ?? `×${item.portion}`}</Text>
                          </View>
                        )}
                        <Text style={s.itemSwapHint}>TAP TO EDIT</Text>
                      </View>
                      <Text style={s.itemName}>{recipe.name}</Text>
                      <View style={s.itemMacroRow}>
                        <Text style={s.itemCals}>{macros.calories}<Text style={s.itemCalsUnit}> kcal</Text></Text>
                        <Text style={[s.itemMacro, { color: C_PROTEIN }]}>P{macros.proteinG}</Text>
                        <Text style={s.itemDot}>·</Text>
                        <Text style={[s.itemMacro, { color: C_CARBS }]}>C{macros.carbsG}</Text>
                        <Text style={s.itemDot}>·</Text>
                        <Text style={[s.itemMacro, { color: C_FAT }]}>F{macros.fatG}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Add food button */}
                <TouchableOpacity
                  style={[s.addFoodBtn, items.length === 0 && s.addFoodBtnEmpty]}
                  onPress={() => setPickerMeal(mealType)}
                  activeOpacity={0.7}
                >
                  <Text style={s.addFoodPlus}>+</Text>
                  <Text style={s.addFoodText}>
                    {items.length === 0 ? `Add ${MEAL_TYPE_LABELS[mealType]}` : "Add another food"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}

        {/* ── Weekly summary ───────────────────────────────────────────── */}
        <View style={s.weeklySummary}>
          <Text style={s.weeklySummaryTitle}>WEEKLY AVERAGE</Text>
          <View style={s.weeklyGrid}>
            {[
              { val: weeklyAvg.calories, tgtVal: tgt.calories, label: "KCAL / DAY", color: P.gold, unit: "" },
              { val: weeklyAvg.proteinG, tgtVal: tgt.proteinG, label: "PROTEIN",    color: C_PROTEIN, unit: "g" },
              { val: weeklyAvg.carbsG,   tgtVal: tgt.carbsG,   label: "CARBS",      color: C_CARBS,   unit: "g" },
              { val: weeklyAvg.fatG,     tgtVal: tgt.fatG,     label: "FAT",        color: C_FAT,     unit: "g" },
            ].map(({ val, tgtVal, label, color, unit }) => (
              <View key={label} style={s.weeklyItem}>
                <Text style={[s.weeklyBig, { color }]}>{val}{unit}</Text>
                <Text style={s.weeklySmall}>{label}</Text>
                <MacroBar value={val} target={tgtVal} color={color} />
              </View>
            ))}
          </View>
          {!targets && <Text style={s.noTargetNote}>Set macro targets in the Fuel tab for accurate progress.</Text>}

          {/* Preferences strip */}
          <View style={s.prefStrip}>
            {prefs ? (
              <>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.prefLabel}>MEAL PREFERENCES</Text>
                  <Text style={s.prefValue} numberOfLines={1}>
                    {[...prefs.proteinSources, ...prefs.carbSources, ...prefs.fatSources]
                      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
                      .join(" · ")}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/food-preferences-onboarding")} hitSlop={8}>
                  <Text style={s.prefEditBtn}>EDIT ›</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.prefLabel}>MEAL PREFERENCES</Text>
                  <Text style={s.prefHint}>Set preferences for smarter auto-fill</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/food-preferences-onboarding")}
                  style={s.prefSetupBtn}
                >
                  <Text style={s.prefSetupBtnText}>SET UP ✦</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Item Detail Modal ────────────────────────────────────────────── */}
      <Modal visible={activeItem !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveItem(null)}>
        {activeItem && (
          <ItemDetailModal
            item={activeItem.item}
            mealType={activeItem.mealType}
            onUpdatePortion={handleUpdatePortion}
            onSwap={handleSwap}
            onRemove={handleRemoveItem}
            onClose={() => setActiveItem(null)}
          />
        )}
      </Modal>

      {/* ── Recipe Picker Modal ──────────────────────────────────────────── */}
      <Modal visible={pickerMeal !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerMeal(null)}>
        {pickerMeal && <RecipePicker mealType={pickerMeal} onPick={handlePickRecipe} onClose={() => setPickerMeal(null)} />}
      </Modal>

      {/* ── Copy Day Modal ───────────────────────────────────────────────── */}
      <Modal visible={copyFrom !== null} animationType="fade" transparent onRequestClose={() => setCopyFrom(null)}>
        <View style={s.modalOverlay}>
          {copyFrom !== null && <CopyDayModal fromDayIndex={copyFrom} onCopy={handleCopyDay} onClose={() => setCopyFrom(null)} />}
        </View>
      </Modal>

      {/* ── AutoFill Modal ───────────────────────────────────────────────── */}
      <Modal visible={autofillOpen} animationType="fade" transparent onRequestClose={() => setAutofillOpen(false)}>
        <View style={s.modalOverlay}>
          <AutoFillModal
            target={tgt}
            defaultGoal={(targets?.goal as GoalType) ?? "maintain"}
            existingSlots={activeDaySlots}
            filling={filling}
            onFillDay={handleAutofillDay}
            onFillWeek={handleAutofillWeek}
            onClose={() => setAutofillOpen(false)}
          />
        </View>
      </Modal>

      {/* ── Reset Confirm Modal ──────────────────────────────────────────── */}
      <Modal visible={resetConfirmOpen} animationType="fade" transparent onRequestClose={() => setResetConfirmOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.resetModal}>
            <Text style={s.resetModalTitle}>RESET ALL PLANS?</Text>
            <Text style={s.resetModalBody}>This will permanently remove all meals across every week.</Text>
            <View style={s.resetModalBtns}>
              <TouchableOpacity style={s.resetModalCancel} onPress={() => setResetConfirmOpen(false)}>
                <Text style={s.resetModalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.resetModalConfirm} onPress={handleConfirmReset} disabled={resetting}>
                {resetting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.resetModalConfirmText}>RESET ALL</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll:           { paddingHorizontal: 20, paddingTop: 4, gap: 4 },

  header:           { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 12 },
  backText:         { fontFamily: OUT_L, fontSize: 22, color: P.mid, lineHeight: 28, marginBottom: 4 },
  eyebrow:          { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:       { fontFamily: CG_ITALIC, fontSize: 42, letterSpacing: -0.5, lineHeight: 48, color: P.ink },

  weekNav:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 8, gap: 12 },
  weekArrow:        { fontFamily: CG, fontSize: 22, color: P.gold, lineHeight: 26, paddingHorizontal: 4 },
  weekLabel:        { flex: 1, fontFamily: OUT_L, fontSize: 13, color: P.ink, textAlign: "center", letterSpacing: 0.5 },
  listBtn:          { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "80", paddingHorizontal: 10, paddingVertical: 5 },
  listBtnText:      { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.gold },
  resetBtn:         { borderWidth: StyleSheet.hairlineWidth, borderColor: P.red + "80", paddingHorizontal: 10, paddingVertical: 5 },
  resetBtnText:     { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.red },
  resetModal:       { marginHorizontal: 32, backgroundColor: P.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 24, gap: 12 },
  resetModalTitle:  { fontFamily: OUT_L, fontSize: 11, letterSpacing: 3, color: P.red, textAlign: "center" },
  resetModalBody:   { fontFamily: OUT_L, fontSize: 13, color: P.mid, textAlign: "center", lineHeight: 20 },
  resetModalBtns:   { flexDirection: "row", gap: 10, marginTop: 8 },
  resetModalCancel: { flex: 1, height: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center", justifyContent: "center" },
  resetModalCancelText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid },
  resetModalConfirm:    { flex: 1, height: 44, backgroundColor: P.red, alignItems: "center", justifyContent: "center" },
  resetModalConfirmText:{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: "#fff" },

  dayTabs:          { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  dayTab:           { width: 52, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, gap: 5 },
  dayTabActive:     { borderColor: P.gold, backgroundColor: P.goldDim },
  dayTabLabel:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
  dayTabLabelActive:{ color: P.gold },
  dayTabBar:        { width: "100%", height: 2, backgroundColor: P.s3, overflow: "hidden" },
  dayTabFill:       { height: "100%", backgroundColor: P.s3 },
  dayTabCals:       { fontFamily: CG, fontSize: 11, color: P.mid },

  // Daily total strip
  dailyStrip:       { backgroundColor: P.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 14, gap: 8, marginBottom: 8 },
  dailyStripTop:    { flexDirection: "row", alignItems: "center", gap: 8 },
  dailyStripLabel:  { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.mid, textTransform: "uppercase", flex: 1 },
  dailyStripCals:   { fontFamily: CG, fontSize: 20, color: P.gold },
  dailyStripOf:     { fontFamily: OUT_L, fontSize: 11, color: P.mid },
  dailyStripPct:    { fontFamily: OUT_L, fontSize: 11, color: P.mid, minWidth: 32, textAlign: "right" },
  dailyBar:         { height: 3, backgroundColor: P.s3, overflow: "hidden" },
  dailyBarFill:     { height: "100%", backgroundColor: P.gold },
  dailyMacros:      { flexDirection: "row", gap: 8 },
  dailyMacroPill:   { flex: 1, gap: 4 },
  dailyMacroLabel:  { fontFamily: OUT_L, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" },
  dailyMacroVal:    { fontFamily: CG, fontSize: 13, color: P.ink },
  dailyMacroOf:     { fontFamily: OUT_L, fontSize: 9, color: P.dim },

  // Day header
  dayHeader:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, marginTop: 4 },
  dayTitle:         { fontFamily: CG, fontSize: 26, color: P.ink, letterSpacing: -0.3 },
  dayDate:          { fontFamily: OUT_L, fontSize: 11, color: P.mid, marginTop: 2 },
  dayActions:       { flexDirection: "row", gap: 8 },
  actionBtn:        { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText:    { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
  actionBtnGold:    { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, backgroundColor: P.goldDim, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnGoldText:{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold },

  // Meal slot
  slotWrap:         { marginBottom: 12, gap: 6 },
  slotHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  slotLabel:        { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.mid, textTransform: "uppercase" },
  slotTotal:        { fontFamily: OUT_L, fontSize: 10, color: P.dim },

  // Item card
  itemCard:         { backgroundColor: P.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 14, gap: 6 },
  itemCardTop:      { flexDirection: "row", alignItems: "center", gap: 8 },
  portionBadge:     { backgroundColor: P.goldDim, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "60", paddingHorizontal: 6, paddingVertical: 2 },
  portionBadgeText: { fontFamily: OUT_L, fontSize: 8, letterSpacing: 1, color: P.gold },
  itemSwapHint:     { marginLeft: "auto", fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.dim },
  itemName:         { fontFamily: CG, fontSize: 19, color: P.ink, letterSpacing: -0.3 },
  itemMacroRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  itemCals:         { fontFamily: CG, fontSize: 22, color: P.gold, lineHeight: 26 },
  itemCalsUnit:     { fontFamily: OUT_L, fontSize: 10, color: P.dim },
  itemMacro:        { fontFamily: OUT_L, fontSize: 12 },
  itemDot:          { fontFamily: OUT_L, fontSize: 12, color: P.dim },

  // Add food button
  addFoodBtn:       { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderStyle: "dashed", paddingHorizontal: 14, paddingVertical: 10 },
  addFoodBtnEmpty:  { paddingVertical: 16 },
  addFoodPlus:      { fontFamily: CG, fontSize: 20, color: P.dim, lineHeight: 22 },
  addFoodText:      { fontFamily: OUT_L, fontSize: 13, color: P.dim },

  // Weekly summary
  weeklySummary:    { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, backgroundColor: P.s1, padding: 18, gap: 14 },
  weeklySummaryTitle: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 4, color: P.mid, textTransform: "uppercase" },
  weeklyGrid:       { flexDirection: "row", gap: 10 },
  weeklyItem:       { flex: 1, gap: 4 },
  weeklyBig:        { fontFamily: CG, fontSize: 22, lineHeight: 26 },
  weeklySmall:      { fontFamily: OUT_L, fontSize: 8, letterSpacing: 1.5, color: P.mid, textTransform: "uppercase" },
  noTargetNote:     { fontFamily: OUT_L, fontSize: 11, color: P.dim, textAlign: "center" },

  // Preferences strip (in weekly summary)
  prefStrip:        { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingTop: 14, gap: 12 },
  prefLabel:        { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2.5, color: P.dim, textTransform: "uppercase" },
  prefValue:        { fontFamily: OUT_L, fontSize: 12, color: P.mid },
  prefHint:         { fontFamily: OUT_L, fontSize: 12, color: P.dim },
  prefEditBtn:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
  prefSetupBtn:     { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, backgroundColor: P.goldDim, paddingHorizontal: 10, paddingVertical: 6 },
  prefSetupBtnText: { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.gold },

  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center" },
});
