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
import { RECIPES, MEAL_TYPE_LABELS, type Recipe } from "@/data/mealPlans";

// ── Recipe map ───────────────���────────────────────────────────────────────────
const RECIPE_MAP = new Map<string, Recipe>(RECIPES.map((r) => [r.id, r]));

// ── Types ───────────────────────────────────────���─────────────────────────────

type Category = "proteins" | "carbs" | "vegetables" | "dairy" | "condiments" | "other";

type GroceryItem = {
  displayName: string;
  amounts:     string[];
  category:    Category;
  checked:     boolean;
};

// ── Ingredient aggregation ─────────��──────────────────────────────────────────

function normalizeIngName(name: string): string {
  return name.toLowerCase().replace(/\s*\(.*?\)/g, "").trim();
}

type ParsedAmt =
  | { type: "g";     value: number }
  | { type: "ml";    value: number }
  | { type: "count"; value: number; unit: string }
  | { type: "raw";   display: string };

function parseAmount(amount: string, portion: number): ParsedAmt {
  const s = amount.replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75");

  // Grams (anywhere in string, including parentheticals)
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gMatch) return { type: "g", value: parseFloat(gMatch[1]) * portion };

  // Millilitres
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) return { type: "ml", value: parseFloat(mlMatch[1]) * portion };

  // "N unit" pattern (e.g., "2 tbsp", "1 medium", "3 large")
  const countMatch = s.trim().match(/^(\d+(?:\.\d+)?)\s+(.+?)(?:\s+\(.*\))?$/i);
  if (countMatch) {
    return { type: "count", value: parseFloat(countMatch[1]) * portion, unit: countMatch[2].trim().toLowerCase() };
  }

  return { type: "raw", display: amount };
}

const CATEGORY_MAP: Array<{ cat: Category; kws: string[] }> = [
  { cat: "proteins",   kws: ["chicken", "beef", "salmon", "tuna", "turkey", "egg", "whey", "protein", "cottage"] },
  { cat: "carbs",      kws: ["rice", "oat", "pasta", "potato", "bread", "tortilla", "granola", "banana", "fruit"] },
  { cat: "vegetables", kws: ["broccoli", "spinach", "tomato", "zucchini", "cucumber", "lettuce", "salad", "courgette"] },
  { cat: "dairy",      kws: ["milk", "yoghurt", "cheese", "cream", "butter", "quark"] },
  { cat: "condiments", kws: ["olive oil", "oil", "sauce", "mustard", "peanut butter", "peanut"] },
];

function assignCategory(normName: string): Category {
  for (const { cat, kws } of CATEGORY_MAP) {
    if (kws.some((kw) => normName.includes(kw))) return cat;
  }
  return "other";
}

function formatAmount(amt: ParsedAmt & { total?: number }): string {
  if (amt.type === "g")     return `${Math.round(amt.total ?? (amt as any).value)}g`;
  if (amt.type === "ml")    return `${Math.round(amt.total ?? (amt as any).value)}ml`;
  if (amt.type === "count") {
    const n = amt.total ?? (amt as any).value;
    const rounded = Math.round(n * 2) / 2;
    return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)} ${(amt as any).unit}`;
  }
  return (amt as any).display ?? "";
}

type AggEntry = { total: number; normName: string; displayName: string } &
  ({ type: "g" } | { type: "ml" } | { type: "count"; unit: string } | { type: "raw"; display: string });

function buildGroceryList(slots: {
  recipeId: string; portion: number | null | undefined; dayIndex: number; mealType: string;
}[]): GroceryItem[] {
  // Key: normName + ':' + type + ':' + unit  →  aggregated entry
  const agg = new Map<string, AggEntry>();

  for (const slot of slots) {
    const recipe = RECIPE_MAP.get(slot.recipeId);
    if (!recipe) continue;
    const portion = slot.portion ?? 1;

    for (const ing of recipe.ingredients) {
      const normName    = normalizeIngName(ing.name);
      const displayName = ing.name.replace(/\s*\(.*?\)/g, "").trim();
      const parsed      = parseAmount(ing.amount, portion);

      let key: string;
      if (parsed.type === "g") {
        key = `${normName}:g:`;
        const prev = agg.get(key) as (AggEntry & { type: "g" }) | undefined;
        agg.set(key, { type: "g", total: (prev?.total ?? 0) + parsed.value, normName, displayName });
      } else if (parsed.type === "ml") {
        key = `${normName}:ml:`;
        const prev = agg.get(key) as (AggEntry & { type: "ml" }) | undefined;
        agg.set(key, { type: "ml", total: (prev?.total ?? 0) + parsed.value, normName, displayName });
      } else if (parsed.type === "count") {
        key = `${normName}:count:${parsed.unit}`;
        const prev = agg.get(key) as (AggEntry & { type: "count" }) | undefined;
        agg.set(key, { type: "count", unit: parsed.unit, total: (prev?.total ?? 0) + parsed.value, normName, displayName });
      } else {
        key = `${normName}:raw:${parsed.display}`;
        if (!agg.has(key)) agg.set(key, { type: "raw", display: parsed.display, total: 1, normName, displayName });
      }
    }
  }

  // Group multiple amount types for the same ingredient
  const byName = new Map<string, { displayName: string; amounts: string[]; category: Category }>();
  for (const entry of agg.values()) {
    const amountStr = formatAmount(entry as any);
    const existing  = byName.get(entry.normName);
    if (existing) {
      existing.amounts.push(amountStr);
    } else {
      byName.set(entry.normName, {
        displayName: entry.displayName,
        amounts:     [amountStr],
        category:    assignCategory(entry.normName),
      });
    }
  }

  return Array.from(byName.values())
    .map(({ displayName, amounts, category }) => ({ displayName, amounts, category, checked: false }));
}

// ── Category metadata ────────��────────────────────────────────────────────────

const CAT_META: Record<Category, { label: string; color: string }> = {
  proteins:   { label: "PROTEINS",          color: P.gold },
  carbs:      { label: "CARBS",             color: "#5A9FD4" },
  vegetables: { label: "VEGETABLES",        color: "#4DAA7A" },
  dairy:      { label: "DAIRY",             color: "#C0A88A" },
  condiments: { label: "OILS & CONDIMENTS", color: P.mid },
  other:      { label: "OTHER",             color: P.dim },
};

const CAT_ORDER: Category[] = ["proteins", "carbs", "vegetables", "dairy", "condiments", "other"];

// ── Week label helper ─────────────────────────────────────────────��────────────

function formatWeekLabel(weekStart: string): string {
  const d   = new Date(weekStart + "T00:00:00");
  const end = new Date(d); end.setDate(d.getDate() + 6);
  const M   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (d.getMonth() === end.getMonth())
    return `${d.getDate()} – ${end.getDate()} ${M[d.getMonth()]}`;
  return `${d.getDate()} ${M[d.getMonth()]} – ${end.getDate()} ${M[end.getMonth()]}`;
}

// ── Main screen ──────────���──────────────────────────���─────────────────────────

export default function GroceryListScreen() {
  const router = useRouter();
  const { weekStart } = useLocalSearchParams<{ weekStart: string }>();
  const { userId }    = useCurrentUser();

  const rawSlots = useQuery(
    api.mealPlanSlots.getWeekSlots,
    userId && weekStart ? { userId, weekStart } : "skip"
  ) ?? [];

  const baseList = useMemo(() => buildGroceryList(rawSlots), [rawSlots]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggleCheck = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<Category, GroceryItem[]>();
    for (const cat of CAT_ORDER) map.set(cat, []);
    for (const item of baseList) {
      map.get(item.category)!.push({ ...item, checked: checked.has(item.displayName) });
    }
    return map;
  }, [baseList, checked]);

  const totalItems   = baseList.length;
  const checkedCount = checked.size;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>NUTRITION</Text>
          <Text style={s.heroItalic}>Grocery List.</Text>
        </View>
      </View>

      {/* Week + progress */}
      <View style={s.subHeader}>
        <Text style={s.weekLabel}>{weekStart ? formatWeekLabel(weekStart) : ""}</Text>
        <View style={s.progressPill}>
          <Text style={s.progressText}>
            {checkedCount}/{totalItems} <Text style={s.progressLabel}>ITEMS</Text>
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: totalItems > 0 ? `${(checkedCount / totalItems) * 100}%` as any : "0%" }]} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {rawSlots.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No meals planned yet.</Text>
            <Text style={s.emptyBody}>Fill your week in the Meal Planner and come back here to generate your shopping list.</Text>
          </View>
        ) : (
          CAT_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            const meta = CAT_META[cat];
            return (
              <View key={cat} style={s.section}>
                {/* Section header */}
                <View style={s.sectionHeader}>
                  <View style={[s.sectionDot, { backgroundColor: meta.color }]} />
                  <Text style={[s.sectionLabel, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={s.sectionCount}>{items.length}</Text>
                </View>

                {items.map((item) => (
                  <TouchableOpacity
                    key={item.displayName}
                    style={[s.itemRow, item.checked && s.itemRowChecked]}
                    onPress={() => toggleCheck(item.displayName)}
                    activeOpacity={0.75}
                  >
                    {/* Checkbox */}
                    <View style={[s.checkbox, item.checked && s.checkboxChecked]}>
                      {item.checked && <Text style={s.checkmark}>✓</Text>}
                    </View>

                    {/* Name + amounts */}
                    <View style={s.itemBody}>
                      <Text style={[s.itemName, item.checked && s.itemNameChecked]}>
                        {item.displayName}
                      </Text>
                      <Text style={[s.itemAmount, item.checked && s.itemAmountChecked]}>
                        {item.amounts.join(" + ")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────��──────────────────────────────────���──────────────────────

const s = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 12 },
  backText:     { fontFamily: OUT_L, fontSize: 22, color: P.mid, lineHeight: 28, marginBottom: 4 },
  eyebrow:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:   { fontFamily: CG_ITALIC, fontSize: 42, letterSpacing: -0.5, lineHeight: 48, color: P.ink },

  subHeader:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 10, gap: 12 },
  weekLabel:    { flex: 1, fontFamily: OUT_L, fontSize: 12, color: P.mid, letterSpacing: 0.5 },
  progressPill: { backgroundColor: P.s2, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 4 },
  progressText: { fontFamily: CG, fontSize: 16, color: P.gold },
  progressLabel:{ fontFamily: OUT_L, fontSize: 9, color: P.mid },

  progressTrack:{ height: 2, backgroundColor: P.s3, marginHorizontal: 24, marginBottom: 8 },
  progressFill: { height: "100%", backgroundColor: P.gold },

  scroll:       { paddingHorizontal: 20, paddingTop: 8 },

  emptyState:   { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  emptyTitle:   { fontFamily: CG, fontSize: 22, color: P.ink, letterSpacing: -0.3, textAlign: "center" },
  emptyBody:    { fontFamily: OUT_L, fontSize: 14, color: P.mid, textAlign: "center", lineHeight: 22 },

  section:      { marginBottom: 20 },
  sectionHeader:{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: P.border, marginBottom: 4 },
  sectionDot:   { width: 5, height: 5, borderRadius: 2.5 },
  sectionLabel: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, textTransform: "uppercase", flex: 1 },
  sectionCount: { fontFamily: OUT_L, fontSize: 9, color: P.dim },

  itemRow:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: P.s3 },
  itemRowChecked: { opacity: 0.4 },
  checkbox:       { width: 20, height: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked:{ backgroundColor: P.gold, borderColor: P.gold },
  checkmark:      { fontFamily: OUT_L, fontSize: 11, color: P.bg },
  itemBody:       { flex: 1, gap: 2 },
  itemName:       { fontFamily: OUT_L, fontSize: 14, color: P.ink },
  itemNameChecked:{ textDecorationLine: "line-through", color: P.mid },
  itemAmount:     { fontFamily: CG, fontSize: 16, color: P.gold, lineHeight: 20 },
  itemAmountChecked:{ color: P.dim },
});
