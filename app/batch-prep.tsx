import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import { GOAL_COLORS, MEAL_TYPE_LABELS } from "@/data/mealPlans";
import type { Recipe, MealType } from "@/data/mealPlans";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const C_PROTEIN  = P.gold;
const C_CARBS    = "#5A9FD4";
const C_FAT      = "#E88C35";

// ── Types ────────────────────────────────────────────────────────────────────

type Occurrence = { dayIndex: number; mealType: MealType; portion: number };

type BatchItem = {
  recipe:        Recipe;
  totalPortions: number;
  occurrences:   Occurrence[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildBatchList(
  slots: { recipeId: string; portion: number | null | undefined; dayIndex: number; mealType: string }[],
  recipeMap: Map<string, Recipe>,
): BatchItem[] {
  const map = new Map<string, BatchItem>();
  for (const slot of slots) {
    const recipe = recipeMap.get(slot.recipeId);
    if (!recipe) continue;
    const portion = slot.portion ?? 1;
    const existing = map.get(slot.recipeId);
    if (existing) {
      existing.totalPortions += portion;
      existing.occurrences.push({ dayIndex: slot.dayIndex, mealType: slot.mealType as MealType, portion });
    } else {
      map.set(slot.recipeId, {
        recipe,
        totalPortions: portion,
        occurrences: [{ dayIndex: slot.dayIndex, mealType: slot.mealType as MealType, portion }],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalPortions - a.totalPortions);
}

/** Scale an ingredient amount string by a factor. */
function scaleAmount(amount: string, factor: number): string {
  if (factor === 1) return amount;
  const s = amount.replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75");

  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gMatch) {
    const v = Math.round(parseFloat(gMatch[1]) * factor);
    return s.replace(gMatch[0], `${v}g`);
  }
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) {
    const v = Math.round(parseFloat(mlMatch[1]) * factor);
    return s.replace(mlMatch[0], `${v}ml`);
  }
  const numMatch = s.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)/);
  if (numMatch) {
    const v = parseFloat(numMatch[1]) * factor;
    const rounded = Math.round(v * 4) / 4;
    const display = rounded % 1 === 0 ? `${rounded}` : rounded.toFixed(2).replace(/\.?0+$/, "");
    return `${display} ${numMatch[2]}`.trim();
  }
  return amount;
}

/** Show which days/meals this recipe covers, sorted by day. */
function formatOccurrences(occs: Occurrence[]): string {
  const sorted = [...occs].sort((a, b) => a.dayIndex - b.dayIndex);
  const mealTypes = new Set(sorted.map(o => o.mealType));
  if (mealTypes.size === 1) {
    const mealLabel = MEAL_TYPE_LABELS[sorted[0].mealType];
    return `${sorted.map(o => DAY_LABELS[o.dayIndex]).join(" · ")}  —  ${mealLabel}`;
  }
  return sorted.map(o => `${DAY_LABELS[o.dayIndex]} ${MEAL_TYPE_LABELS[o.mealType]}`).join("  ·  ");
}

function formatWeekLabel(weekStart: string): string {
  const d   = new Date(weekStart + "T00:00:00");
  const end = new Date(d); end.setDate(d.getDate() + 6);
  const M   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (d.getMonth() === end.getMonth())
    return `${d.getDate()} – ${end.getDate()} ${M[d.getMonth()]}`;
  return `${d.getDate()} ${M[d.getMonth()]} – ${end.getDate()} ${M[end.getMonth()]}`;
}

function round1(n: number) { return Math.round(n * 10) / 10; }

// ── Goal badge ────────────────────────────────────────────────────────────────

function GoalBadge({ goal }: { goal: string }) {
  const c = GOAL_COLORS[goal as keyof typeof GOAL_COLORS] ?? { bg: P.s2, border: P.border, text: P.mid };
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

// ── Batch recipe card ─────────────────────────────────────────────────────────

function BatchCard({
  item,
  done,
  onToggleDone,
}: {
  item:         BatchItem;
  done:         boolean;
  onToggleDone: () => void;
}) {
  const [showIngredients, setShowIngredients] = useState(false);
  const [showMethod,      setShowMethod]      = useState(false);
  const { recipe, totalPortions, occurrences } = item;

  const totalMins = recipe.prepTimeMins + recipe.cookTimeMins;
  const batchMacros = {
    calories: Math.round(recipe.totalMacros.calories * totalPortions),
    proteinG: round1(recipe.totalMacros.proteinG     * totalPortions),
    carbsG:   round1(recipe.totalMacros.carbsG       * totalPortions),
    fatG:     round1(recipe.totalMacros.fatG          * totalPortions),
  };
  const portionFraction = totalPortions % 1 === 0 ? `${totalPortions}` : totalPortions.toFixed(1);

  // Per-serving breakdown for portioning guide
  const servings = occurrences
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map(o => ({
      label: `${DAY_LABELS[o.dayIndex]} — ${MEAL_TYPE_LABELS[o.mealType]}`,
      portion: o.portion,
    }));

  return (
    <View style={[bc.card, done && bc.cardDone]}>

      {/* ── Header row ── */}
      <TouchableOpacity style={bc.headerRow} onPress={onToggleDone} activeOpacity={0.75}>
        <View style={[bc.checkbox, done && bc.checkboxDone]}>
          {done && <Text style={bc.checkmark}>✓</Text>}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={bc.badgeRow}>
            <GoalBadge goal={recipe.goal} />
            <View style={[bc.batchPill, done && bc.batchPillDone]}>
              <Text style={[bc.batchPillText, done && bc.batchPillTextDone]}>
                ×{portionFraction} BATCH
              </Text>
            </View>
            <Text style={bc.timeText}>⏱ {totalMins} min</Text>
          </View>
          <Text style={[bc.name, done && bc.nameDone]}>{recipe.name}</Text>
          <Text style={bc.occText}>{formatOccurrences(occurrences)}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Macro strip ── */}
      <View style={bc.macroStrip}>
        {[
          { val: batchMacros.calories, unit: "",  label: "KCAL",    color: P.gold    },
          { val: batchMacros.proteinG, unit: "g", label: "PROTEIN", color: C_PROTEIN },
          { val: batchMacros.carbsG,   unit: "g", label: "CARBS",   color: C_CARBS   },
          { val: batchMacros.fatG,     unit: "g", label: "FAT",     color: C_FAT     },
        ].map(({ val, unit, label, color }, i, arr) => (
          <View key={label} style={[bc.macroItem, i < arr.length - 1 && bc.macroItemBorder]}>
            <Text style={[bc.macroVal, { color: done ? P.dim : color }]}>{val}{unit}</Text>
            <Text style={bc.macroLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Portion guide ── */}
      <View style={bc.portionGuide}>
        <Text style={bc.portionGuideTitle}>DIVIDE INTO</Text>
        <View style={bc.portionRows}>
          {servings.map((s, i) => (
            <View key={i} style={bc.portionRow}>
              <Text style={bc.portionDay}>{s.label}</Text>
              <View style={[bc.portionSizePill, done && { borderColor: P.border }]}>
                <Text style={[bc.portionSizeText, done && { color: P.dim }]}>×{s.portion % 1 === 0 ? s.portion : s.portion.toFixed(1)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── Ingredient toggle ── */}
      <TouchableOpacity style={bc.toggleRow} onPress={() => setShowIngredients(v => !v)} activeOpacity={0.7}>
        <Text style={bc.toggleLabel}>BATCH INGREDIENTS</Text>
        <Text style={bc.toggleNote}>scaled ×{portionFraction}</Text>
        <Text style={bc.toggleChevron}>{showIngredients ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {showIngredients && (
        <View style={bc.ingList}>
          {recipe.ingredients.map((ing, idx) => (
            <View key={idx} style={[bc.ingRow, idx % 2 === 1 && bc.ingAlt]}>
              <Text style={[bc.ingName, done && { color: P.dim }]}>{ing.name}</Text>
              <Text style={[bc.ingAmt, done && { color: P.dim }]}>
                {scaleAmount(ing.amount, totalPortions)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Method toggle ── */}
      <TouchableOpacity style={bc.toggleRow} onPress={() => setShowMethod(v => !v)} activeOpacity={0.7}>
        <Text style={bc.toggleLabel}>METHOD</Text>
        <Text style={bc.toggleNote}>{recipe.instructions.length} steps</Text>
        <Text style={bc.toggleChevron}>{showMethod ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {showMethod && (
        <View style={bc.steps}>
          {recipe.instructions.map((step, idx) => (
            <View key={idx} style={bc.stepRow}>
              <View style={bc.stepNum}><Text style={bc.stepNumText}>{idx + 1}</Text></View>
              <Text style={bc.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

    </View>
  );
}

const bc = StyleSheet.create({
  card:              { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, backgroundColor: P.s1, marginBottom: 12, overflow: "hidden" },
  cardDone:          { opacity: 0.55 },

  headerRow:         { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  checkbox:          { width: 22, height: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkboxDone:      { backgroundColor: P.gold, borderColor: P.gold },
  checkmark:         { fontFamily: OUT_L, fontSize: 12, color: P.bg },
  badgeRow:          { flexDirection: "row", alignItems: "center", gap: 8 },
  batchPill:         { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, backgroundColor: P.goldDim, paddingHorizontal: 7, paddingVertical: 2 },
  batchPillDone:     { borderColor: P.border, backgroundColor: P.s2 },
  batchPillText:     { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.gold },
  batchPillTextDone: { color: P.dim },
  timeText:          { fontFamily: OUT_L, fontSize: 9, color: P.dim, marginLeft: "auto" },
  name:              { fontFamily: CG, fontSize: 20, color: P.ink, letterSpacing: -0.3, lineHeight: 24 },
  nameDone:          { color: P.mid },
  occText:           { fontFamily: OUT_L, fontSize: 10, color: P.mid, lineHeight: 16 },

  macroStrip:        { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  macroItem:         { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3 },
  macroItemBorder:   { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: P.border },
  macroVal:          { fontFamily: CG, fontSize: 16, lineHeight: 20 },
  macroLabel:        { fontFamily: OUT_L, fontSize: 7, letterSpacing: 1.5, color: P.dim, textTransform: "uppercase" },

  portionGuide:      { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border, padding: 14, gap: 8 },
  portionGuideTitle: { fontFamily: OUT_L, fontSize: 8, letterSpacing: 3, color: P.mid, textTransform: "uppercase" },
  portionRows:       { gap: 6 },
  portionRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  portionDay:        { fontFamily: OUT_L, fontSize: 12, color: P.ink },
  portionSizePill:   { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "80", paddingHorizontal: 8, paddingVertical: 3 },
  portionSizeText:   { fontFamily: CG, fontSize: 13, color: P.gold },

  toggleRow:         { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border, paddingHorizontal: 14, paddingVertical: 11 },
  toggleLabel:       { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.gold, textTransform: "uppercase", flex: 1 },
  toggleNote:        { fontFamily: OUT_L, fontSize: 9, color: P.dim },
  toggleChevron:     { fontFamily: OUT_L, fontSize: 9, color: P.gold },

  ingList:           { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  ingRow:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  ingAlt:            { backgroundColor: P.s2 },
  ingName:           { fontFamily: OUT_L, fontSize: 13, color: P.ink, flex: 1, paddingRight: 12 },
  ingAmt:            { fontFamily: CG, fontSize: 16, color: P.gold },

  steps:             { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border, padding: 14, gap: 10 },
  stepRow:           { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum:           { width: 22, height: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText:       { fontFamily: CG, fontSize: 12, color: P.gold },
  stepText:          { flex: 1, fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BatchPrepScreen() {
  const router                 = useRouter();
  const { weekStart }          = useLocalSearchParams<{ weekStart: string }>();
  const { userId }             = useCurrentUser();

  const rawSlots      = useQuery(
    api.mealPlanSlots.getWeekSlots,
    userId && weekStart ? { userId, weekStart } : "skip",
  ) ?? [];
  const convexRecipes = useQuery(api.mealPlans.listRecipes) ?? [];

  const recipeMap = useMemo<Map<string, Recipe>>(
    () => new Map(convexRecipes.map(r => [r.recipeId, {
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
    }])),
    [convexRecipes],
  );

  const batchList = useMemo(() => buildBatchList(rawSlots, recipeMap), [rawSlots, recipeMap]);

  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const toggleDone = (recipeId: string) => {
    setDoneSet(prev => {
      const next = new Set(prev);
      next.has(recipeId) ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });
  };

  const totalCookMins = batchList.reduce(
    (sum, item) => sum + item.recipe.prepTimeMins + item.recipe.cookTimeMins,
    0,
  );
  const doneCount = doneSet.size;
  const totalCount = batchList.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>NUTRITION</Text>
          <Text style={s.heroItalic}>Batch Prep.</Text>
        </View>
      </View>

      {/* Sub-header */}
      <View style={s.subHeader}>
        <Text style={s.weekLabel}>{weekStart ? formatWeekLabel(weekStart) : ""}</Text>
        {batchList.length > 0 && (
          <Text style={s.metaText}>
            {totalCount} recipe{totalCount !== 1 ? "s" : ""}  ·  ~{totalCookMins} min total
          </Text>
        )}
      </View>

      {/* Progress */}
      {batchList.length > 0 && (
        <>
          <View style={s.subHeader}>
            <View style={s.progressPill}>
              <Text style={s.progressText}>
                {doneCount}/{totalCount} <Text style={s.progressLabel}>PREPPED</Text>
              </Text>
            </View>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, {
              width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` as any : "0%",
            }]} />
          </View>
        </>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {batchList.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No meals planned yet.</Text>
            <Text style={s.emptyBody}>
              Fill your week in the Meal Planner and come back here for your batch cooking guide.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.introCard}>
              <Text style={s.introTitle}>COOK ONCE, EAT ALL WEEK</Text>
              <Text style={s.introBody}>
                Each card shows the full batch quantity and how to divide it across your meals.
                Tap a card to mark it done.
              </Text>
            </View>

            {batchList.map(item => (
              <BatchCard
                key={item.recipe.id}
                item={item}
                done={doneSet.has(item.recipe.id)}
                onToggleDone={() => toggleDone(item.recipe.id)}
              />
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header:          { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 12 },
  backText:        { fontFamily: OUT_L, fontSize: 22, color: P.mid, lineHeight: 28, marginBottom: 4 },
  eyebrow:         { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:      { fontFamily: CG_ITALIC, fontSize: 42, letterSpacing: -0.5, lineHeight: 48, color: P.ink },

  subHeader:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 10, gap: 12 },
  weekLabel:       { flex: 1, fontFamily: OUT_L, fontSize: 12, color: P.mid, letterSpacing: 0.5 },
  metaText:        { fontFamily: OUT_L, fontSize: 11, color: P.dim, letterSpacing: 0.3 },
  progressPill:    { backgroundColor: P.s2, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 4 },
  progressText:    { fontFamily: CG, fontSize: 16, color: P.gold },
  progressLabel:   { fontFamily: OUT_L, fontSize: 9, color: P.mid },
  progressTrack:   { height: 2, backgroundColor: P.s3, marginHorizontal: 24, marginBottom: 8 },
  progressFill:    { height: "100%", backgroundColor: P.gold },

  scroll:          { paddingHorizontal: 20, paddingTop: 8 },

  introCard:       { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, backgroundColor: P.s1, padding: 16, marginBottom: 16, gap: 6 },
  introTitle:      { fontFamily: OUT_L, fontSize: 8, letterSpacing: 3, color: P.gold, textTransform: "uppercase" },
  introBody:       { fontFamily: OUT_L, fontSize: 12, color: P.mid, lineHeight: 18 },

  emptyState:      { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  emptyTitle:      { fontFamily: CG, fontSize: 22, color: P.ink, letterSpacing: -0.3, textAlign: "center" },
  emptyBody:       { fontFamily: OUT_L, fontSize: 14, color: P.mid, textAlign: "center", lineHeight: 22 },
});
