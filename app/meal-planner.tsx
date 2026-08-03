import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, TextInput,
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
  GOAL_COLORS, MEAL_TYPE_LABELS,
  type Recipe, type GoalType, type MealType, type MealSlot,
} from "@/data/mealPlans";

// ── Meal variety (unique recipes to rotate per meal type) ─────────────────────
type MealVariety = { breakfast: number; lunch: number; dinner: number; snack: number };
const DEFAULT_MEAL_VARIETY: MealVariety = { breakfast: 2, lunch: 2, dinner: 2, snack: 1 };
const VARIETY_MEALS: { key: keyof MealVariety; label: string }[] = [
  { key: "breakfast", label: "BREAKFAST" },
  { key: "lunch",     label: "LUNCH"     },
  { key: "dinner",    label: "DINNER"    },
  { key: "snack",     label: "SNACKS"    },
];
// Colours for rotation slots A/B/C…
const ROT_COLORS = [P.gold, "#5A9FD4", "#4DAA7A", "#E88C35", "#C084D4", "#E05555", "#9BAEC8"];
function varietyBatchNote(n: number): string {
  if (n === 1) return "1 recipe · same all week";
  if (n === 7) return "7 recipes · different every day";
  return `${n} recipes · rotates every ${Math.floor(7 / n)}–${Math.ceil(7 / n)} days`;
}

// ── Food preferences type (mirrors Convex schema) ────────────────────────────
type FoodPrefs = {
  proteinSources:      string[];
  carbSources:         string[];
  fatSources:          string[];
  excludedIngredients: string[];
  plannedMealTypes:    string[];
  varietyLevel:        number;
  mealFrequency?:      { breakfast: number; lunch: number; dinner: number; snack: number };
  mealVariety?:        { breakfast: number; lunch: number; dinner: number; snack: number };
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

/** Scale an ingredient amount string by a portion factor. */
function scaleAmount(amount: string, portion: number): string {
  if (portion === 1) return amount;
  const s = amount.replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75");
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gMatch) {
    const v = Math.round(parseFloat(gMatch[1]) * portion);
    return s.replace(gMatch[0], `${v}g`);
  }
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) {
    const v = Math.round(parseFloat(mlMatch[1]) * portion);
    return s.replace(mlMatch[0], `${v}ml`);
  }
  const numMatch = s.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)/);
  if (numMatch) {
    const v = Math.round(parseFloat(numMatch[1]) * portion * 4) / 4;
    const display = v % 1 === 0 ? `${v}` : v.toFixed(2).replace(/\.?0+$/, "");
    return `${display} ${numMatch[2]}`.trim();
  }
  return amount;
}

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
const MEAL_ORDER: MealSlot[] = ["breakfast","lunch","dinner","snack"];
const PORTION_STEPS = [0.5, 1, 1.5, 2, 3];
const PORTION_LABELS: Record<number, string> = { 0.5: "×½", 1: "×1", 1.5: "×1½", 2: "×2", 3: "×3" };

// ── Recipe map & types ──────────────────────────────────────────────────────

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
function sumMacros(items: SlotItem[], recipeMap: Map<string, Recipe>): MacroTarget {
  let calories = 0, proteinG = 0, carbsG = 0, fatG = 0;
  for (const item of items) {
    const r = recipeMap.get(item.recipeId);
    if (!r) continue;
    calories += r.totalMacros.calories * item.portion;
    proteinG += r.totalMacros.proteinG * item.portion;
    carbsG   += r.totalMacros.carbsG   * item.portion;
    fatG     += r.totalMacros.fatG     * item.portion;
  }
  return { calories: Math.round(calories), proteinG: round1(proteinG), carbsG: round1(carbsG), fatG: round1(fatG) };
}

// ── Similarity: top N recipes closest in macros to given recipe ─────────────
function getSimilar(recipe: Recipe, n = 5, recipes: Recipe[] = []): Recipe[] {
  const m = recipe.totalMacros;
  return recipes
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
const SLOT_WEIGHTS: Record<MealSlot, number> = {
  breakfast: 0.25, lunch: 0.35, dinner: 0.40, snack: 0,
};

type AutofillEntry = { recipeId: string; portion: number };

/** Pick the largest PORTION_STEPS value that does not exceed `raw` (never overshoot). */
function snapPortion(raw: number): number {
  const below = PORTION_STEPS.filter(p => p <= raw);
  return below.length ? below[below.length - 1] : PORTION_STEPS[0];
}

function autofillDay(
  target: MacroTarget,
  goal: GoalType,
  existingSlots: Partial<Record<MealType, SlotItem[]>>,
  allRecipes: Recipe[],
  recipeMap: Map<string, Recipe>,
  usedThisWeek: Set<string> = new Set(),
  prefs: FoodPrefs = null,
  weekRecipes: Recipe[] = [],
  usageCount: Map<string, number> = new Map(),
  preferredIds: Set<string> = new Set(),
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

  const isPreferred = (r: Recipe) => r.id.startsWith("user:") || preferredIds.has(r.id);
  const notOverused = (r: Recipe) => (usageCount.get(r.id) ?? 0) < maxRep;

  const getCandidates = (mealType: MealType) => {
    // Try MY MEALS first (user-created + starred), then fall back to full pool
    let c = allRecipes.filter((r) => isPreferred(r) && r.mealType === mealType && r.goal === goal && !usedThisDay.has(r.id) && notOverused(r));
    if (!c.length) c = allRecipes.filter((r) => isPreferred(r) && r.mealType === mealType && !usedThisDay.has(r.id) && notOverused(r));
    if (!c.length) c = allRecipes.filter((r) => r.mealType === mealType && r.goal === goal && !usedThisDay.has(r.id) && notOverused(r));
    if (!c.length) c = allRecipes.filter((r) => r.mealType === mealType && !usedThisDay.has(r.id) && notOverused(r));
    if (!c.length) c = allRecipes.filter((r) => r.mealType === mealType);
    return c;
  };

  // Pass 1: fill breakfast / lunch / dinner
  const primaryMeals: MealSlot[] = ["breakfast", "lunch", "dinner"];
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
    for (const items of Object.values(existingSlots)) usedCals += sumMacros(items ?? [], recipeMap).calories;
    for (const entry of Object.values(result)) {
      const r = recipeMap.get(entry.recipeId);
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

function projectAutofill(target: MacroTarget, goal: GoalType, existingSlots: Partial<Record<MealType, SlotItem[]>>, allRecipes: Recipe[], recipeMap: Map<string, Recipe>): MacroTarget {
  const filled = autofillDay(target, goal, existingSlots, allRecipes, recipeMap);
  let calories = 0, proteinG = 0, carbsG = 0, fatG = 0;
  for (const items of Object.values(existingSlots)) {
    const m = sumMacros(items ?? [], recipeMap);
    calories += m.calories; proteinG += m.proteinG; carbsG += m.carbsG; fatG += m.fatG;
  }
  for (const entry of Object.values(filled)) {
    const r = recipeMap.get(entry.recipeId);
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
  recipeMap,
  recipes,
  onUpdatePortion,
  onSwap,
  onRemove,
  onClose,
}: {
  item:     SlotItem;
  mealType: MealType;
  recipeMap: Map<string, Recipe>;
  recipes:   Recipe[];
  onUpdatePortion: (portion: number) => void;
  onSwap:   (recipeId: string) => void;
  onRemove: () => void;
  onClose:  () => void;
}) {
  const recipe = recipeMap.get(item.recipeId);
  const [portion, setPortion] = useState(item.portion);
  const [showSwap, setShowSwap] = useState(false);
  // useMemo must be called before any early return (Rules of Hooks)
  const similar = useMemo(() => recipe ? getSimilar(recipe, 5, recipes) : [], [recipe?.id, recipes]);

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
                <Text style={id.ingAmount}>{scaleAmount(ing.amount, portion)}</Text>
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

// ── Recipe picker filter definitions ─────────────────────────────────────────

const PROTEIN_FILTER_OPTS = [
  { key: "chicken", label: "Chicken", kws: ["chicken"] },
  { key: "beef",    label: "Beef",    kws: ["beef", "mince"] },
  { key: "fish",    label: "Fish",    kws: ["salmon", "tuna", "fish", "cod"] },
  { key: "eggs",    label: "Eggs",    kws: ["egg"] },
  { key: "turkey",  label: "Turkey",  kws: ["turkey"] },
  { key: "plant",   label: "Plant",   kws: ["tofu", "tempeh", "lentil", "bean", "chickpea"] },
];

const CARB_FILTER_OPTS = [
  { key: "rice",    label: "Rice",    kws: ["rice"] },
  { key: "oats",    label: "Oats",    kws: ["oat"] },
  { key: "pasta",   label: "Pasta",   kws: ["pasta"] },
  { key: "potato",  label: "Potato",  kws: ["potato"] },
  { key: "bread",   label: "Bread",   kws: ["bread", "tortilla", "wrap"] },
];

type SortKey = "default" | "protein_desc" | "cal_asc" | "cal_desc";

const SORT_OPTS: { key: SortKey; label: string }[] = [
  { key: "default",      label: "BEST MATCH" },
  { key: "protein_desc", label: "PROTEIN ↓"  },
  { key: "cal_asc",      label: "CALORIES ↑" },
  { key: "cal_desc",     label: "CALORIES ↓" },
];

function ingredientNames(r: Recipe) {
  return r.ingredients.map(i => i.name.toLowerCase());
}

function matchesKeywords(names: string[], kws: string[]): boolean {
  return names.some(n => kws.some(kw => n.includes(kw)));
}

// ── Recipe Picker Modal ─────────────────────────────────────────────────────
function RecipePicker({
  mealType,
  recipes,
  savedIds,
  onPick,
  onClose,
}: { mealType: MealType; recipes: Recipe[]; savedIds: string[]; onPick: (r: Recipe) => void; onClose: () => void }) {
  const router      = useRouter();
  const { userId }  = useCurrentUser();
  const saveRecipe   = useMutation(api.mealPlans.save);
  const unsaveRecipe = useMutation(api.mealPlans.unsave);

  const [tab,           setTab]           = useState<"all" | "mine">("all");
  const [search,        setSearch]        = useState("");
  const [goalFilter,    setGoalFilter]    = useState<"all" | GoalType>("all");
  const [proteinFilter, setProteinFilter] = useState<string[]>([]);
  const [carbFilter,    setCarbFilter]    = useState<string[]>([]);
  const [sortKey,       setSortKey]       = useState<SortKey>("default");

  const toggleArr = (arr: string[], key: string) =>
    arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key];

  const toggleStar = (recipe: Recipe) => {
    if (!userId) return;
    if (savedSet.has(recipe.id)) {
      unsaveRecipe({ userId, recipeId: recipe.id });
    } else {
      saveRecipe({ userId, recipeId: recipe.id });
    }
  };

  const hasFilters = goalFilter !== "all" || proteinFilter.length > 0 || carbFilter.length > 0;

  const savedSet      = useMemo(() => new Set(savedIds), [savedIds]);
  const userRecipes   = useMemo(() => recipes.filter(r => r.id.startsWith("user:")), [recipes]);
  const globalRecipes = useMemo(() => recipes.filter(r => !r.id.startsWith("user:")), [recipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (tab === "mine") {
      const starred = globalRecipes.filter(r => savedSet.has(r.id));
      const mine = [...userRecipes, ...starred];
      return q ? mine.filter(r => r.name.toLowerCase().includes(q)) : mine;
    }

    let list = globalRecipes;

    if (goalFilter !== "all")
      list = list.filter(r => r.goal === goalFilter);

    if (proteinFilter.length > 0)
      list = list.filter(r => {
        const names = ingredientNames(r);
        return proteinFilter.some(pk => {
          const kws = PROTEIN_FILTER_OPTS.find(o => o.key === pk)?.kws ?? [];
          return matchesKeywords(names, kws);
        });
      });

    if (carbFilter.length > 0)
      list = list.filter(r => {
        const names = ingredientNames(r);
        return carbFilter.some(ck => {
          const kws = CARB_FILTER_OPTS.find(o => o.key === ck)?.kws ?? [];
          return matchesKeywords(names, kws);
        });
      });

    if (q) list = list.filter(r => r.name.toLowerCase().includes(q));

    return [...list].sort((a, b) => {
      if (sortKey === "protein_desc") return b.totalMacros.proteinG - a.totalMacros.proteinG;
      if (sortKey === "cal_asc")      return a.totalMacros.calories - b.totalMacros.calories;
      if (sortKey === "cal_desc")     return b.totalMacros.calories - a.totalMacros.calories;
      return (a.mealType === mealType ? 0 : 1) - (b.mealType === mealType ? 0 : 1);
    });
  }, [recipes, tab, search, userRecipes, globalRecipes, savedSet, goalFilter, proteinFilter, carbFilter, sortKey, mealType]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top","bottom"]}>

      {/* Header */}
      <View style={rp.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={rp.closeText}>×</Text>
        </TouchableOpacity>
        <Text style={rp.title}>ADD TO {MEAL_TYPE_LABELS[mealType].toUpperCase()}</Text>
        <TouchableOpacity
          style={rp.createBtn}
          onPress={() => { onClose(); router.push({ pathname: "/create-meal", params: { mealType } }); }}
          activeOpacity={0.75}
        >
          <Text style={rp.createBtnText}>+ CREATE</Text>
        </TouchableOpacity>
        <Text style={rp.count}>{filtered.length}</Text>
      </View>

      {/* ── MY MEALS / ALL tabs ── */}
      <View style={rp.tabRow}>
        <TouchableOpacity
          style={[rp.tabBtn, tab === "all" && rp.tabBtnActive]}
          onPress={() => setTab("all")}
          activeOpacity={0.75}
        >
          <Text style={[rp.tabBtnText, tab === "all" && rp.tabBtnTextActive]}>ALL RECIPES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[rp.tabBtn, tab === "mine" && rp.tabBtnActive]}
          onPress={() => setTab("mine")}
          activeOpacity={0.75}
        >
          <Text style={[rp.tabBtnText, tab === "mine" && rp.tabBtnTextActive]}>
            MY MEALS {userRecipes.length > 0 ? `(${userRecipes.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={rp.searchWrap}>
        <Text style={rp.searchIcon}>⊙</Text>
        <TextInput
          style={rp.searchInput}
          placeholder="Search recipes…"
          placeholderTextColor={P.dim}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Text style={{ fontFamily: OUT_L, fontSize: 16, color: P.mid }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filters — hidden on MY MEALS tab ── */}
      {tab === "all" && (
        <>
          {/* ── Protein filter ── */}
          <View style={rp.filterBlock}>
            <Text style={rp.filterLabel}>PROTEIN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rp.chipRow}>
              {PROTEIN_FILTER_OPTS.map(opt => {
                const active = proteinFilter.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[rp.chip, active && rp.chipActive]}
                    onPress={() => setProteinFilter(v => toggleArr(v, opt.key))}
                    activeOpacity={0.75}
                  >
                    <Text style={[rp.chipText, active && rp.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Carb filter ── */}
          <View style={rp.filterBlock}>
            <Text style={rp.filterLabel}>CARBS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rp.chipRow}>
              {CARB_FILTER_OPTS.map(opt => {
                const active = carbFilter.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[rp.chip, active && rp.chipActive]}
                    onPress={() => setCarbFilter(v => toggleArr(v, opt.key))}
                    activeOpacity={0.75}
                  >
                    <Text style={[rp.chipText, active && rp.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Goal + Sort row ── */}
          <View style={rp.goalSortRow}>
            {(["all","cut","bulk","maintain"] as const).map(g => (
              <TouchableOpacity
                key={g}
                style={[rp.goalBtn, goalFilter === g && rp.goalBtnActive]}
                onPress={() => setGoalFilter(g)}
              >
                <Text style={[rp.goalBtnText, goalFilter === g && { color: P.gold }]}>
                  {g === "all" ? "ALL" : g.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={rp.sortBtn}
              onPress={() => {
                const keys = SORT_OPTS.map(o => o.key);
                const idx  = keys.indexOf(sortKey);
                setSortKey(keys[(idx + 1) % keys.length]);
              }}
            >
              <Text style={rp.sortBtnText} numberOfLines={1}>
                {SORT_OPTS.find(o => o.key === sortKey)?.label}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Clear + result count */}
          <View style={rp.bar}>
            <Text style={rp.barCount}>{filtered.length} RECIPE{filtered.length !== 1 ? "S" : ""}</Text>
            {hasFilters && (
              <TouchableOpacity onPress={() => {
                setGoalFilter("all"); setProteinFilter([]); setCarbFilter([]); setSortKey("default");
              }} hitSlop={8}>
                <Text style={rp.clearText}>CLEAR FILTERS</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Recipe list */}
      <ScrollView contentContainerStyle={rp.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          tab === "mine" ? (
            <View style={rp.empty}>
              <Text style={rp.emptyText}>No custom meals yet.</Text>
              <TouchableOpacity
                style={rp.createEmptyBtn}
                onPress={() => { onClose(); router.push({ pathname: "/create-meal", params: { mealType } }); }}
              >
                <Text style={rp.createEmptyBtnText}>+ CREATE YOUR FIRST MEAL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={rp.empty}>
              <Text style={rp.emptyText}>No recipes match these filters.</Text>
            </View>
          )
        ) : (
          filtered.map(recipe => {
            const m = recipe.totalMacros;
            return (
              <View key={recipe.id} style={rp.row}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onPick(recipe)} activeOpacity={0.75}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <GoalBadge goal={recipe.goal} />
                    <Text style={rp.mealTypeLabel}>{MEAL_TYPE_LABELS[recipe.mealType].toUpperCase()}</Text>
                    <Text style={rp.timeLabel}>⏱ {recipe.prepTimeMins + recipe.cookTimeMins}m</Text>
                  </View>
                  <Text style={rp.name}>{recipe.name}</Text>
                  <View style={rp.macroRow}>
                    <Text style={[rp.macroVal, { color: P.gold }]}>{m.calories}</Text>
                    <Text style={rp.macroUnit}>kcal</Text>
                    <Text style={rp.macroDot}>·</Text>
                    <Text style={[rp.macroVal, { color: "#D4A017" }]}>{round1(m.proteinG)}</Text>
                    <Text style={rp.macroUnit}>P</Text>
                    <Text style={rp.macroDot}>·</Text>
                    <Text style={[rp.macroVal, { color: "#5A9FD4" }]}>{round1(m.carbsG)}</Text>
                    <Text style={rp.macroUnit}>C</Text>
                    <Text style={rp.macroDot}>·</Text>
                    <Text style={[rp.macroVal, { color: "#E88C35" }]}>{round1(m.fatG)}</Text>
                    <Text style={rp.macroUnit}>F</Text>
                  </View>
                </TouchableOpacity>
                {!recipe.id.startsWith("user:") && (
                  <TouchableOpacity onPress={() => toggleStar(recipe)} hitSlop={10} style={rp.starBtn}>
                    <Text style={[rp.starIcon, savedSet.has(recipe.id) && rp.starIconActive]}>
                      {savedSet.has(recipe.id) ? "★" : "☆"}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onPick(recipe)} hitSlop={6} style={rp.addBtn}>
                  <Text style={rp.addText}>+ ADD</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const rp = StyleSheet.create({
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  closeText:     { fontFamily: OUT_L, fontSize: 26, color: P.mid, lineHeight: 28 },
  title:         { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.ink, textTransform: "uppercase" },
  count:         { fontFamily: CG, fontSize: 16, color: P.gold, minWidth: 32, textAlign: "right" },
  createBtn:     { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, paddingHorizontal: 10, paddingVertical: 6 },
  createBtnText: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold, textTransform: "uppercase" },

  tabRow:        { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  tabBtn:        { flex: 1, paddingVertical: 11, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive:  { borderBottomColor: P.gold },
  tabBtnText:    { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim, textTransform: "uppercase" },
  tabBtnTextActive: { color: P.gold },

  createEmptyBtn:     { marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, paddingHorizontal: 20, paddingVertical: 10 },
  createEmptyBtnText: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold, textTransform: "uppercase" },

  filterBlock:   { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  filterLabel:   { fontFamily: OUT_L, fontSize: 8, letterSpacing: 3, color: P.dim, textTransform: "uppercase", marginBottom: 8 },
  chipRow:       { gap: 6, paddingBottom: 2 },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border },
  chipActive:    { borderColor: P.gold, backgroundColor: P.goldDim },
  chipText:      { fontFamily: OUT_L, fontSize: 12, color: P.mid },
  chipTextActive:{ color: P.gold },

  goalSortRow:   { flexDirection: "row", paddingHorizontal: 12, gap: 5, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  goalBtn:       { flex: 1, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center" },
  goalBtnActive: { borderColor: P.gold, backgroundColor: P.goldDim },
  goalBtnText:   { fontFamily: OUT_L, fontSize: 7, letterSpacing: 1.5, color: P.dim, textTransform: "uppercase" },
  sortBtn:       { paddingHorizontal: 10, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border },
  sortBtnText:   { fontFamily: OUT_L, fontSize: 7, letterSpacing: 1, color: P.mid, textTransform: "uppercase" },

  bar:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  barCount:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim },
  clearText:     { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold, textDecorationLine: "underline" },

  searchWrap:    { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, backgroundColor: P.s1 },
  searchIcon:    { fontFamily: OUT_L, fontSize: 14, color: P.dim },
  searchInput:   { flex: 1, fontFamily: OUT_L, fontSize: 14, color: P.ink, paddingVertical: 10 },

  list:          { paddingHorizontal: 16 },
  empty:         { paddingTop: 48, alignItems: "center" },
  emptyText:     { fontFamily: OUT_L, fontSize: 13, color: P.dim },
  row:           { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border, gap: 10 },
  mealTypeLabel: { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.dim },
  timeLabel:     { fontFamily: OUT_L, fontSize: 9, color: P.dim, marginLeft: "auto" },
  name:          { fontFamily: OUT, fontSize: 14, color: P.ink, marginBottom: 6 },
  macroRow:      { flexDirection: "row", alignItems: "baseline", gap: 4 },
  macroVal:      { fontFamily: CG, fontSize: 15, lineHeight: 18 },
  macroUnit:     { fontFamily: OUT_L, fontSize: 9, color: P.mid },
  macroDot:      { fontFamily: OUT_L, fontSize: 9, color: P.dim },
  starBtn:       { padding: 4 },
  starIcon:      { fontSize: 18, color: P.dim },
  starIconActive:{ color: P.gold },
  addBtn:        { paddingLeft: 4 },
  addText:       { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold },
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
  target, defaultGoal, existingSlots, filling, recipes, recipeMap,
  onFillDay, onFillWeek, onClose,
}: {
  target: MacroTarget; defaultGoal: GoalType;
  existingSlots: Partial<Record<MealType, SlotItem[]>>;
  filling: boolean;
  recipes: Recipe[];
  recipeMap: Map<string, Recipe>;
  onFillDay:  (goal: GoalType) => void;
  onFillWeek: (goal: GoalType) => void;
  onClose: () => void;
}) {
  const [goal, setGoal] = useState<GoalType>(defaultGoal);
  const preview = useMemo(() => projectAutofill(target, goal, existingSlots, recipes, recipeMap), [target, goal, existingSlots, recipes, recipeMap]);
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
  const [viewMode,     setViewMode]     = useState<"week" | "setup">("week");
  const [activeDay,    setActiveDay]    = useState(0);
  const [pickerMeal,   setPickerMeal]   = useState<MealSlot | null>(null);
  // slot recipe assignment: { breakfast: { A: Recipe, B: Recipe }, ... }
  const [chosenSlots,  setChosenSlots]  = useState<Partial<Record<MealType, Record<string, Recipe>>>>({});
  const [pickingSlot,  setPickingSlot]  = useState<{ mealType: MealType; letter: string } | null>(null);
  const [activeItem,   setActiveItem]   = useState<{ item: SlotItem; mealType: MealType } | null>(null);
  const [copyFrom,     setCopyFrom]     = useState<number | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [copying,           setCopying]           = useState(false);
  const [filling,           setFilling]           = useState(false);
  const [resetting,         setResetting]         = useState(false);
  const [resetConfirmOpen,  setResetConfirmOpen]  = useState(false);

  // ── Convex ───────────────────────────────────────────────────────────────
  const rawSlots      = useQuery(api.mealPlanSlots.getWeekSlots, userId ? { userId, weekStart } : "skip") ?? [];
  const targets       = useQuery(api.nutrition.getFoodTarget,    userId ? { userId } : "skip");
  const prefs         = useQuery(api.foodPreferences.get,        userId ? { userId } : "skip");
  const convexRecipesData  = useQuery(api.mealPlans.listRecipes);
  const convexRecipes      = convexRecipesData ?? [];
  const userRecipesData    = useQuery(api.userRecipes.getUserRecipes, userId ? { userId } : "skip");
  const userRecipesRaw     = userRecipesData ?? [];
  const savedIds           = useQuery(api.mealPlans.getSaved, userId ? { userId } : "skip") ?? [];
  const myMealIds          = useMemo(() => new Set<string>([
    ...userRecipesRaw.map(r => `user:${r._id}`),
    ...savedIds,
  ]), [userRecipesRaw, savedIds]);
  const addItem        = useMutation(api.mealPlanSlots.addItem);
  const updatePortion  = useMutation(api.mealPlanSlots.updatePortion);
  const swapItem       = useMutation(api.mealPlanSlots.swapItem);
  const removeItem     = useMutation(api.mealPlanSlots.removeItem);
  const copyDay        = useMutation(api.mealPlanSlots.copyDay);
  const deleteItems        = useMutation(api.mealPlanSlots.deleteItems);
  const clearAllUserSlots  = useMutation(api.mealPlanSlots.clearAllUserSlots);
  const savePrefs          = useMutation(api.foodPreferences.save);

  // ── Recipe pool (global + user-created) ──────────────────────────────────
  const allRecipes = useMemo<Recipe[]>(() => {
    const global = convexRecipes.map(r => ({
      id:           r.recipeId,
      name:         r.name,
      description:  r.description,
      goal:         r.goal,
      mealType:     r.mealType as MealType,
      prepTimeMins: r.prepTimeMins,
      cookTimeMins: r.cookTimeMins,
      tags:         r.tags,
      ingredients:  r.ingredients.map(i => ({
        name:     i.name,
        amount:   i.amount,
        calories: i.calories ?? 0,
        proteinG: i.proteinG ?? 0,
        carbsG:   i.carbsG   ?? 0,
        fatG:     i.fatG     ?? 0,
      })),
      instructions: r.instructions,
      totalMacros:  r.totalMacros,
    }));
    const user = userRecipesRaw.map(r => ({
      id:           `user:${r._id}`,
      name:         r.name,
      description:  r.description,
      goal:         r.goal,
      mealType:     r.mealType as MealType,
      prepTimeMins: r.prepTimeMins,
      cookTimeMins: r.cookTimeMins,
      tags:         r.tags,
      ingredients:  r.ingredients,
      instructions: r.instructions,
      totalMacros:  r.totalMacros,
    }));
    return [...user, ...global];
  }, [convexRecipes, userRecipesRaw]);

  const recipeMap = useMemo(() =>
    new Map<string, Recipe>(allRecipes.map(r => [r.id, r]))
  , [allRecipes]);

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
        const m = sumMacros(items ?? [], recipeMap);
        total.calories += m.calories; total.proteinG += m.proteinG;
        total.carbsG   += m.carbsG;   total.fatG     += m.fatG;
      }
      return { calories: Math.round(total.calories), proteinG: round1(total.proteinG), carbsG: round1(total.carbsG), fatG: round1(total.fatG) };
    })
  , [slotMap, recipeMap]);

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
      // Respect meal frequency: only fill meal types with frequency > 0
      let dayPrefs = prefs ?? null;
      if (dayPrefs?.mealFrequency) {
        const freq = dayPrefs.mealFrequency;
        const activeMeals = (["breakfast", "lunch", "dinner", "snack"] as const)
          .filter(mt => (freq[mt] ?? 7) > 0) as string[];
        dayPrefs = { ...dayPrefs, plannedMealTypes: activeMeals };
      }
      const filled = autofillDay(tgt, goal, activeDaySlots, allRecipes, recipeMap, new Set(), dayPrefs, [], new Map(), myMealIds);
      for (const [mealType, entry] of Object.entries(filled) as [MealSlot, AutofillEntry][]) {
        if (!entry) continue;
        await addItem({ userId, weekStart, dayIndex: activeDay, mealType, recipeId: entry.recipeId, portion: entry.portion });
      }
    } finally { setFilling(false); }
  };

  const handleAutofillWeek = async (goal: GoalType) => {
    if (!userId) return;
    setFilling(true); setAutofillOpen(false);
    try {
      const variety = prefs?.mealVariety ?? DEFAULT_MEAL_VARIETY;
      const mealTypes: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

      // ── Step 1: build recipe pool per meal type ─────────────────────────
      //   Honour user-chosen slot recipes; auto-pick the rest.
      const weekPool: Partial<Record<MealType, Recipe[]>> = {};

      for (const mt of mealTypes) {
        const n        = variety[mt];
        const slotCal  = tgt.calories * SLOT_WEIGHTS[mt];
        const slotProt = tgt.proteinG * SLOT_WEIGHTS[mt];
        const slotCarb = tgt.carbsG   * SLOT_WEIGHTS[mt];
        const slotFat  = tgt.fatG     * SLOT_WEIGHTS[mt];

        const usedIds  = new Set<string>();
        const pool: Recipe[] = [];

        for (let i = 0; i < n; i++) {
          const letter = String.fromCharCode(65 + i);
          const chosen = chosenSlots[mt]?.[letter];

          if (chosen) {
            pool.push(chosen);
            usedIds.add(chosen.id);
          } else {
            // Auto-pick: prefer MY MEALS (user-created + starred), fall back to full pool
            const scoreRecipe = (r: Recipe) => {
              const macroS =
                Math.abs(r.totalMacros.calories - slotCal)  / (slotCal  || 1) +
                Math.abs(r.totalMacros.proteinG - slotProt) / (slotProt || 1) * 0.6 +
                Math.abs(r.totalMacros.carbsG   - slotCarb) / (slotCarb || 1) * 0.3 +
                Math.abs(r.totalMacros.fatG     - slotFat)  / (slotFat  || 1) * 0.2;
              const pref = prefScore(r, prefs ?? null);
              if (!isFinite(pref)) return null;
              return { r, score: macroS - pref * 1.5 + (r.goal === goal ? -0.3 : 0) };
            };
            const isPreferredWeek = (r: Recipe) => r.id.startsWith("user:") || myMealIds.has(r.id);
            const basePool = allRecipes.filter(r => r.mealType === mt && !usedIds.has(r.id));
            const preferredPool = basePool.filter(isPreferredWeek);
            const pickFrom = (pool: Recipe[]) =>
              pool.map(scoreRecipe).filter((x): x is { r: Recipe; score: number } => x !== null)
                .sort((a, b) => a.score - b.score)[0]?.r;
            const best = pickFrom(preferredPool) ?? pickFrom(basePool);

            if (best) { pool.push(best); usedIds.add(best.id); }
          }
        }

        weekPool[mt] = pool;
      }

      // ── Step 2: assign to each day by rotation ─────────────────────────
      for (let d = 0; d < 7; d++) {
        for (const mt of mealTypes) {
          const pool = weekPool[mt];
          if (!pool?.length) continue;
          if ((slotMap[d][mt]?.length ?? 0) > 0) continue; // skip already filled

          const recipe = pool[d % pool.length];
          const rawPortion = recipe.totalMacros.calories > 0
            ? (tgt.calories * SLOT_WEIGHTS[mt]) / recipe.totalMacros.calories
            : 1;
          await addItem({
            userId, weekStart,
            dayIndex: d, mealType: mt,
            recipeId: recipe.id,
            portion: snapPortion(rawPortion),
          });
        }
      }
    } finally { setFilling(false); }
  };

  // ── Meal-plan setup helpers ───────────────────────────────────────────────
  const curVariety: MealVariety = prefs?.mealVariety ?? DEFAULT_MEAL_VARIETY;

  const handleSlotPick = (recipe: Recipe) => {
    if (!pickingSlot) return;
    setChosenSlots(prev => ({
      ...prev,
      [pickingSlot.mealType]: { ...(prev[pickingSlot.mealType] ?? {}), [pickingSlot.letter]: recipe },
    }));
    setPickingSlot(null);
  };

  const handleSlotClear = (mealType: MealType, letter: string) => {
    setChosenSlots(prev => {
      const copy = { ...(prev[mealType] ?? {}) };
      delete copy[letter];
      return { ...prev, [mealType]: copy };
    });
  };

  const updateMealVariety = (key: keyof MealVariety, delta: number) => {
    if (!userId) return;
    const next = { ...curVariety, [key]: Math.max(1, Math.min(7, curVariety[key] + delta)) };
    savePrefs({
      userId,
      proteinSources:      prefs?.proteinSources      ?? [],
      carbSources:         prefs?.carbSources          ?? [],
      fatSources:          prefs?.fatSources           ?? [],
      excludedIngredients: prefs?.excludedIngredients  ?? [],
      varietyLevel:        prefs?.varietyLevel         ?? 2,
      plannedMealTypes:    prefs?.plannedMealTypes      ?? ["breakfast","lunch","dinner","snack"],
      mealVariety:         next,
    });
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
          onPress={() => router.push({ pathname: "/batch-prep", params: { weekStart } })}
          hitSlop={12}
          style={s.prepBtn}
        >
          <Text style={s.prepBtnText}>PREP</Text>
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

      {/* Mode toggle */}
      <View style={s.modeRow}>
        <TouchableOpacity
          style={[s.modeTab, viewMode === "week" && s.modeTabActive]}
          onPress={() => setViewMode("week")}
        >
          <Text style={[s.modeTabText, viewMode === "week" && s.modeTabTextActive]}>WEEK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modeTab, viewMode === "setup" && s.modeTabActive]}
          onPress={() => setViewMode("setup")}
        >
          <Text style={[s.modeTabText, viewMode === "setup" && s.modeTabTextActive]}>MEAL PLAN</Text>
        </TouchableOpacity>
      </View>

      {viewMode === "week" && (
        <>
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
              style={[s.actionBtnGold, (filling || !convexRecipesData) && { opacity: 0.4 }]}
              onPress={() => setAutofillOpen(true)}
              disabled={filling || !convexRecipesData}
            >
              {filling
                ? <ActivityIndicator size="small" color={P.gold} />
                : <Text style={s.actionBtnGoldText}>{convexRecipesData ? "AUTO-FILL ✦" : "LOADING..."}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Meal slots ───────────────────────────────────────────────── */}
        {MEAL_ORDER.map(mealType => {
          const items = activeDaySlots[mealType] ?? [];
          const slotTotal = sumMacros(items, recipeMap);
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
                  const recipe = recipeMap.get(item.recipeId);
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
                <TouchableOpacity onPress={() => setViewMode("setup")} hitSlop={8}>
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
                  onPress={() => setViewMode("setup")}
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
        </>
      )}

      {/* ── MEAL PLAN setup tab ──────────────────────────────────────────── */}
      {viewMode === "setup" && (
        <ScrollView contentContainerStyle={su.scroll} showsVerticalScrollIndicator={false}>

          <Text style={su.sectionLabel}>HOW MANY VARIETIES?</Text>
          <Text style={su.sectionNote}>
            Pick how many different recipes to rotate through each meal type per week.
            Fewer varieties = bigger batches = easier meal prep.
          </Text>

          {VARIETY_MEALS.map(({ key, label }) => {
            const n = curVariety[key];
            return (
              <View key={key} style={su.row}>

                {/* Label + batch note */}
                <View style={su.rowTop}>
                  <Text style={su.mealLabel}>{label}</Text>
                  <Text style={su.batchNote}>{varietyBatchNote(n)}</Text>
                </View>

                {/* Stepper */}
                <View style={su.stepper}>
                  <TouchableOpacity
                    style={[su.stepBtn, n === 1 && su.stepBtnDim]}
                    onPress={() => updateMealVariety(key, -1)}
                    disabled={n === 1}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <Text style={[su.stepBtnTxt, n === 1 && { color: P.dim }]}>−</Text>
                  </TouchableOpacity>
                  <View style={su.countBox}>
                    <Text style={su.countNum}>{n}</Text>
                    <Text style={su.countUnit}>RECIPES</Text>
                  </View>
                  <TouchableOpacity
                    style={[su.stepBtn, n === 7 && su.stepBtnDim]}
                    onPress={() => updateMealVariety(key, 1)}
                    disabled={n === 7}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <Text style={[su.stepBtnTxt, n === 7 && { color: P.dim }]}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Rotation grid — tap any box to pick that slot's recipe */}
                <View style={su.rotRow}>
                  {["M","T","W","T","F","S","S"].map((day, d) => {
                    const slot   = d % n;
                    const letter = String.fromCharCode(65 + slot);
                    const color  = ROT_COLORS[slot];
                    const picked = !!chosenSlots[key]?.[letter];
                    return (
                      <TouchableOpacity
                        key={d}
                        style={su.rotCell}
                        onPress={() => setPickingSlot({ mealType: key, letter })}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          su.rotBox,
                          { backgroundColor: color + (picked ? "45" : "20"), borderColor: color + (picked ? "BB" : "60") },
                        ]}>
                          <Text style={[su.rotLetter, { color }]}>{letter}</Text>
                        </View>
                        <Text style={su.rotDay}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Slot assignment rows */}
                <View style={su.slotList}>
                  {Array.from({ length: n }, (_, i) => {
                    const letter  = String.fromCharCode(65 + i);
                    const color   = ROT_COLORS[i];
                    const chosen  = chosenSlots[key]?.[letter];
                    return (
                      <View key={letter} style={su.slotRow}>
                        <View style={[su.slotBadge, { backgroundColor: color + "25", borderColor: color + "70" }]}>
                          <Text style={[su.slotBadgeTxt, { color }]}>{letter}</Text>
                        </View>
                        <TouchableOpacity
                          style={su.slotNameBtn}
                          onPress={() => setPickingSlot({ mealType: key, letter })}
                          activeOpacity={0.8}
                        >
                          <Text style={[su.slotName, !chosen && su.slotNameAuto]} numberOfLines={1}>
                            {chosen ? chosen.name : "Tap to choose a recipe"}
                          </Text>
                          {chosen && (
                            <Text style={su.slotMacros}>
                              {chosen.totalMacros.calories} kcal · P{chosen.totalMacros.proteinG}g
                            </Text>
                          )}
                        </TouchableOpacity>
                        {chosen ? (
                          <TouchableOpacity onPress={() => handleSlotClear(key, letter)} hitSlop={10} style={su.slotClearBtn}>
                            <Text style={su.slotClearTxt}>×</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={su.slotChooseTxt}>AUTO</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

              </View>
            );
          })}

          <View style={su.divider} />

          <TouchableOpacity
            style={[su.fillBtn, (filling || !convexRecipesData) && { opacity: 0.4 }]}
            onPress={() => { setViewMode("week"); setAutofillOpen(true); }}
            disabled={filling || !convexRecipesData}
            activeOpacity={0.85}
          >
            <Text style={su.fillBtnText}>AUTO-FILL WEEK WITH THESE SETTINGS  ✦</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── Item Detail Modal ────────────────────────────────────────────── */}
      <Modal visible={activeItem !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveItem(null)}>
        {activeItem && (
          <ItemDetailModal
            item={activeItem.item}
            mealType={activeItem.mealType}
            recipeMap={recipeMap}
            recipes={allRecipes}
            onUpdatePortion={handleUpdatePortion}
            onSwap={handleSwap}
            onRemove={handleRemoveItem}
            onClose={() => setActiveItem(null)}
          />
        )}
      </Modal>

      {/* ── Recipe Picker Modal ──────────────────────────────────────────── */}
      <Modal visible={pickerMeal !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerMeal(null)}>
        {pickerMeal && <RecipePicker mealType={pickerMeal} recipes={allRecipes} savedIds={savedIds} onPick={handlePickRecipe} onClose={() => setPickerMeal(null)} />}
      </Modal>

      {/* ── Slot Recipe Picker Modal (MEAL PLAN tab) ─────────────────────── */}
      <Modal visible={pickingSlot !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickingSlot(null)}>
        {pickingSlot && (
          <RecipePicker
            mealType={pickingSlot.mealType}
            recipes={allRecipes}
            savedIds={savedIds}
            onPick={handleSlotPick}
            onClose={() => setPickingSlot(null)}
          />
        )}
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
            recipes={allRecipes}
            recipeMap={recipeMap}
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
  prepBtn:          { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, backgroundColor: P.goldDim, paddingHorizontal: 10, paddingVertical: 5 },
  prepBtnText:      { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.gold },
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

  // Mode toggle
  modeRow:          { flexDirection: "row", paddingHorizontal: 20, gap: 6, paddingBottom: 10 },
  modeTab:          { flex: 1, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center" },
  modeTabActive:    { borderColor: P.gold, backgroundColor: P.goldDim },
  modeTabText:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.dim, textTransform: "uppercase" },
  modeTabTextActive:{ color: P.gold },
});

// ── Setup tab styles ─────────────────────────────────────────────────────────
const su = StyleSheet.create({
  scroll:      { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel:{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.gold, textTransform: "uppercase", marginBottom: 6 },
  sectionNote: { fontFamily: OUT_L, fontSize: 12, color: P.dim, lineHeight: 18, marginBottom: 24 },
  divider:     { height: StyleSheet.hairlineWidth, backgroundColor: P.border, marginVertical: 24 },

  row:         { marginBottom: 28 },
  rowTop:      { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  mealLabel:   { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.ink, textTransform: "uppercase" },
  batchNote:   { fontFamily: OUT_L, fontSize: 10, color: P.gold },

  stepper:     { flexDirection: "row", marginBottom: 10 },
  stepBtn:     { width: 56, height: 56, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center", justifyContent: "center" },
  stepBtnDim:  { borderColor: P.border },
  stepBtnTxt:  { fontFamily: CG, fontSize: 28, color: P.gold, lineHeight: 32 },
  countBox:    { flex: 1, alignItems: "center", justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: P.gold, height: 56, gap: 1 },
  countNum:    { fontFamily: CG, fontSize: 28, color: P.gold, lineHeight: 32 },
  countUnit:   { fontFamily: OUT_L, fontSize: 7, letterSpacing: 2, color: P.dim, textTransform: "uppercase" },

  // Rotation preview
  rotRow:      { flexDirection: "row", gap: 4 },
  rotCell:     { flex: 1, alignItems: "center", gap: 4 },
  rotBox:      { width: "100%", aspectRatio: 1, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  rotLetter:   { fontFamily: CG, fontSize: 14, lineHeight: 18 },
  rotDay:      { fontFamily: OUT_L, fontSize: 7, color: P.dim, letterSpacing: 0.5 },

  // Slot assignment rows
  slotList:       { gap: 6, marginTop: 4 },
  slotRow:        { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingVertical: 10, paddingHorizontal: 12 },
  slotBadge:      { width: 28, height: 28, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  slotBadgeTxt:   { fontFamily: CG, fontSize: 14, lineHeight: 18 },
  slotNameBtn:    { flex: 1, gap: 2 },
  slotName:       { fontFamily: OUT_L, fontSize: 13, color: P.ink },
  slotNameAuto:   { color: P.dim, fontStyle: "italic" },
  slotMacros:     { fontFamily: OUT_L, fontSize: 10, color: P.mid },
  slotClearBtn:   { padding: 4 },
  slotClearTxt:   { fontFamily: CG, fontSize: 20, color: P.dim, lineHeight: 22 },
  slotChooseTxt:  { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.dim },

  fillBtn:     { height: 56, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, backgroundColor: P.goldDim, alignItems: "center", justifyContent: "center" },
  fillBtnText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.gold, textTransform: "uppercase" },
});
