import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, PanResponder, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "expo-router";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";

// ── Macro colours ─────────────────────────────────────────────────────────────
const C_PROTEIN = P.gold;
const C_CARBS   = "#5A9FD4";
const C_FAT     = "#E88C35";

// ── Portion helpers (mirrors meal-planner) ────────────────────────────────────
const PORTION_STEPS  = [0.5, 1, 1.5, 2, 3] as const;
const PORTION_LABELS: Record<number, string> = { 0.5: "½×", 1: "1×", 1.5: "1½×", 2: "2×", 3: "3×" };

function round1(n: number) { return Math.round(n * 10) / 10; }

function scaleAmount(amount: string, portion: number): string {
  if (portion === 1) return amount;
  const s = amount.replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75");
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gMatch) { const v = Math.round(parseFloat(gMatch[1]) * portion); return s.replace(gMatch[0], `${v}g`); }
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) { const v = Math.round(parseFloat(mlMatch[1]) * portion); return s.replace(mlMatch[0], `${v}ml`); }
  const numMatch = s.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)/);
  if (numMatch) {
    const raw = Math.round(parseFloat(numMatch[1]) * portion * 4) / 4;
    const nice = raw === Math.floor(raw) ? String(raw) : raw === Math.floor(raw) + 0.5 ? `${Math.floor(raw)}½` : String(raw);
    return `${nice}${numMatch[2] ? " " + numMatch[2] : ""}`.trim();
  }
  return amount;
}

// ── Meal config ───────────────────────────────────────────────────────────────
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "BREAKFAST" },
  { type: "lunch",     label: "LUNCH"     },
  { type: "dinner",    label: "DINNER"    },
  { type: "snack",     label: "SNACKS"    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// Katch-McArdle BMR + RP macro split
function calcTargets(profile: {
  weightKg: number; currentBf: number; targetBf: number;
  weeklyGoal: number; sex: string; age: number; heightCm: number;
}): { calories: number; proteinG: number; carbsG: number; fatG: number; goal: "cut" | "bulk" | "maintain" } {
  const lbm = profile.weightKg * (1 - profile.currentBf / 100);
  const bmr = 370 + 21.6 * lbm;
  const actMap: Record<number, number> = { 3: 1.55, 4: 1.60, 5: 1.725 };
  const tdee = bmr * (actMap[profile.weeklyGoal] ?? 1.55);

  const bfDiff = profile.currentBf - profile.targetBf;
  let goal: "cut" | "bulk" | "maintain";
  let calories: number;
  if (bfDiff > 3)       { goal = "cut";      calories = Math.round(tdee - 400); }
  else if (bfDiff < -3) { goal = "bulk";      calories = Math.round(tdee + 250); }
  else                  { goal = "maintain";  calories = Math.round(tdee); }

  const proteinG = Math.round(profile.weightKg * (goal === "cut" ? 2.5 : 2.2));
  const fatG     = Math.round(calories * 0.27 / 9);
  const carbsG   = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return { calories, proteinG, carbsG, fatG, goal };
}

function goalColor(goal: "cut" | "bulk" | "maintain") {
  if (goal === "cut")  return P.red;
  if (goal === "bulk") return P.green;
  return P.gold;
}

// ── Custom slider ─────────────────────────────────────────────────────────────
function MacroSlider({ value, min, max, step = 1, color, onChange }: {
  value: number; min: number; max: number; step?: number; color: string;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<View>(null);
  // Keep latest values in refs so PanResponder closures are never stale
  const layoutRef = useRef({ pageX: 0, width: 1 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const paramsRef = useRef({ min, max, step });
  paramsRef.current = { min, max, step };

  const calcVal = (pageX: number) => {
    const { min, max, step } = paramsRef.current;
    const { pageX: trackX, width } = layoutRef.current;
    const pct = Math.max(0, Math.min(1, (pageX - trackX) / width));
    return Math.round((min + pct * (max - min)) / step) * step;
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_e, gs) => {
      // Re-measure on every touch so position is accurate after scroll
      trackRef.current?.measure((_fx, _fy, width, _h, pageX) => {
        layoutRef.current = { pageX, width };
        onChangeRef.current(calcVal(gs.x0));
      });
    },
    onPanResponderMove: (_e, gs) => {
      onChangeRef.current(calcVal(gs.moveX));
    },
  })).current;

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View
      ref={trackRef}
      onLayout={() => {
        trackRef.current?.measure((_fx, _fy, width, _h, pageX) => {
          layoutRef.current = { pageX, width };
        });
      }}
      style={{ height: 40, justifyContent: "center" }}
      {...panResponder.panHandlers}
    >
      <View style={{ height: 3, backgroundColor: P.border, borderRadius: 2 }}>
        <View style={{ width: `${pct * 100}%` as any, height: 3, backgroundColor: color, borderRadius: 2 }} />
      </View>
      <View style={{
        position: "absolute", left: `${pct * 100}%` as any,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: color, transform: [{ translateX: -10 }],
        shadowColor: color, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
      }} />
    </View>
  );
}

// ── Suggestion Detail Modal ───────────────────────────────────────────────────
type Suggestion = {
  slotId: string;
  mealType: string;
  portion: number;
  name: string;
  description: string;
  goal: string;
  prepTimeMins: number;
  cookTimeMins: number;
  ingredients: { name: string; amount: string; calories: number; proteinG: number; carbsG: number; fatG: number }[];
  instructions: string[];
  totalMacros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  scaledMacros: { calories: number; proteinG: number; carbsG: number; fatG: number };
};

function SuggestionDetailModal({ sg, alreadyLogged, onLog, onPortionChange, onClose }: {
  sg: Suggestion;
  alreadyLogged: boolean;
  onLog: (portion: number) => void;
  onPortionChange: (portion: number) => void;
  onClose: () => void;
}) {
  const [portion, setPortion] = useState(sg.portion);
  const macros = {
    calories: Math.round(sg.totalMacros.calories * portion),
    proteinG: round1(sg.totalMacros.proteinG * portion),
    carbsG:   round1(sg.totalMacros.carbsG   * portion),
    fatG:     round1(sg.totalMacros.fatG      * portion),
  };
  const plannedMacros = {
    calories: Math.round(sg.totalMacros.calories * sg.portion),
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={sd.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={sd.closeText}>×</Text>
        </TouchableOpacity>
        <Text style={sd.headerTitle}>PLANNED MEAL</Text>
        {alreadyLogged ? (
          <Text style={sd.loggedTag}>✓ LOGGED</Text>
        ) : (
          <TouchableOpacity onPress={() => onLog(portion)} style={sd.logHeaderBtn}>
            <Text style={sd.logHeaderBtnText}>LOG {macros.calories} KCAL</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={sd.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <View style={[sd.goalBadge, { borderColor: sg.goal === "cut" ? P.red : sg.goal === "bulk" ? P.green : P.gold }]}>
            <Text style={[sd.goalText, { color: sg.goal === "cut" ? P.red : sg.goal === "bulk" ? P.green : P.gold }]}>
              {sg.goal.toUpperCase()}
            </Text>
          </View>
          <Text style={sd.timeText}>⏱ {sg.prepTimeMins + sg.cookTimeMins} min</Text>
        </View>
        <Text style={sd.name}>{sg.name}</Text>
        {!!sg.description && <Text style={sd.desc}>{sg.description}</Text>}

        {/* Portion selector */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
          <Text style={sd.sectionLabel}>PORTION</Text>
          {portion !== sg.portion && (
            <Text style={sd.plannedNote}>planned: {PORTION_LABELS[sg.portion]} · {plannedMacros.calories} kcal</Text>
          )}
        </View>
        <View style={sd.portionRow}>
          {PORTION_STEPS.map(p => (
            <TouchableOpacity
              key={p}
              style={[sd.portionChip, p === portion && sd.portionChipActive]}
              onPress={() => { setPortion(p); onPortionChange(p); }}
              activeOpacity={0.7}
            >
              <Text style={[sd.portionChipText, p === portion && sd.portionChipTextActive]}>
                {PORTION_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Macro card */}
        <View style={sd.macroCard}>
          <View style={{ flexDirection: "row" }}>
            {([
              { val: macros.calories, label: "KCAL",    color: P.gold },
              { val: macros.proteinG, label: "PROTEIN", color: C_PROTEIN },
              { val: macros.carbsG,   label: "CARBS",   color: C_CARBS },
              { val: macros.fatG,     label: "FAT",     color: C_FAT },
            ] as const).map(({ val, label, color }, i) => (
              <View key={label} style={{ flex: 1, alignItems: "center", flexDirection: "row" }}>
                {i > 0 && <View style={sd.macroDivider} />}
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={[sd.macroBig, { color }]}>{val}</Text>
                  <Text style={sd.macroLabel}>{label}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={sd.macroNote}>adjusted for {PORTION_LABELS[portion] ?? `${portion}×`} portion</Text>
        </View>

        {/* Ingredients */}
        {sg.ingredients.length > 0 && (
          <>
            <Text style={sd.sectionLabel}>INGREDIENTS</Text>
            <View style={sd.ingTable}>
              <View style={[sd.ingRow, sd.ingHeader]}>
                <Text style={[sd.ingCell, sd.ingHeaderText, { flex: 2 }]}>ITEM</Text>
                <Text style={[sd.ingCell, sd.ingHeaderText]}>KCAL</Text>
                <Text style={[sd.ingCell, sd.ingHeaderText, { color: C_PROTEIN }]}>P</Text>
                <Text style={[sd.ingCell, sd.ingHeaderText, { color: C_CARBS }]}>C</Text>
                <Text style={[sd.ingCell, sd.ingHeaderText, { color: C_FAT }]}>F</Text>
              </View>
              {sg.ingredients.map((ing, idx) => (
                <View key={idx} style={[sd.ingRow, idx % 2 === 1 && sd.ingAlt]}>
                  <View style={{ flex: 2 }}>
                    <Text style={sd.ingName}>{ing.name}</Text>
                    <Text style={sd.ingAmount}>{scaleAmount(ing.amount, portion)}</Text>
                  </View>
                  <Text style={[sd.ingCell, sd.ingValue]}>{Math.round(ing.calories * portion)}</Text>
                  <Text style={[sd.ingCell, sd.ingValue, { color: C_PROTEIN }]}>{round1(ing.proteinG * portion)}</Text>
                  <Text style={[sd.ingCell, sd.ingValue, { color: C_CARBS }]}>{round1(ing.carbsG * portion)}</Text>
                  <Text style={[sd.ingCell, sd.ingValue, { color: C_FAT }]}>{round1(ing.fatG * portion)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Method */}
        {sg.instructions.length > 0 && (
          <>
            <Text style={sd.sectionLabel}>METHOD</Text>
            <View style={sd.steps}>
              {sg.instructions.map((step, idx) => (
                <View key={idx} style={sd.stepRow}>
                  <View style={sd.stepNum}><Text style={sd.stepNumText}>{idx + 1}</Text></View>
                  <Text style={sd.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const sd = StyleSheet.create({
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  closeText:        { fontFamily: OUT_L, fontSize: 26, color: P.mid, lineHeight: 28 },
  headerTitle:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.mid },
  loggedTag:        { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
  logHeaderBtn:     { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4, backgroundColor: P.gold },
  logHeaderBtnText: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 1, color: P.bg },
  plannedNote:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 1, color: P.mid },
  scroll:           { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  goalBadge:        { borderWidth: StyleSheet.hairlineWidth, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 3 },
  goalText:         { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2 },
  timeText:         { fontFamily: OUT_L, fontSize: 11, color: P.dim },
  name:             { fontFamily: CG_ITALIC, fontSize: 30, color: P.ink, letterSpacing: -0.3, lineHeight: 36 },
  desc:             { fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20 },
  sectionLabel:     { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.mid, textTransform: "uppercase", marginTop: 6 },
  portionRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  portionChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border },
  portionChipActive:{ borderColor: P.gold, backgroundColor: "rgba(201,168,76,0.12)" },
  portionChipText:  { fontFamily: OUT_L, fontSize: 11, color: P.dim },
  portionChipTextActive: { color: P.gold },
  macroCard:        { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 16, backgroundColor: P.s1 },
  macroBig:         { fontFamily: CG, fontSize: 24, letterSpacing: -0.5 },
  macroLabel:       { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.mid, marginTop: 2 },
  macroDivider:     { width: StyleSheet.hairlineWidth, backgroundColor: P.border, alignSelf: "stretch", marginVertical: 4 },
  macroNote:        { fontFamily: OUT_L, fontSize: 9, color: P.dim, textAlign: "center", marginTop: 12 },
  ingTable:         { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, overflow: "hidden" },
  ingRow:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  ingHeader:        { backgroundColor: P.s2 },
  ingHeaderText:    { fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.mid, flex: 1, textAlign: "right" },
  ingAlt:           { backgroundColor: P.s2 },
  ingName:          { fontFamily: OUT_L, fontSize: 13, color: P.ink },
  ingAmount:        { fontFamily: OUT_L, fontSize: 10, color: P.mid, marginTop: 2 },
  ingCell:          { flex: 1, textAlign: "right" },
  ingValue:         { fontFamily: OUT_L, fontSize: 11, color: P.ink },
  steps:            { gap: 10 },
  stepRow:          { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum:          { width: 22, height: 22, borderRadius: 11, backgroundColor: P.s2, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  stepNumText:      { fontFamily: OUT_L, fontSize: 10, color: P.mid },
  stepText:         { fontFamily: OUT_L, fontSize: 13, color: P.ink, lineHeight: 20, flex: 1 },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function FuelScreen() {
  const today = todayStr();
  const router = useRouter();
  const { userId } = useCurrentUser();

  const [date,              setDate]              = useState(today);
  const [deleteTarget,      setDeleteTarget]      = useState<Id<"foodEntries"> | null>(null);
  const [macroEditorOpen,   setMacroEditorOpen]   = useState(false);
  const [activeSuggestion,  setActiveSuggestion]  = useState<Suggestion | null>(null);
  const [draftCals,   setDraftCals]   = useState(0);
  const [draftPro,    setDraftPro]    = useState(0);
  const [draftCarbs,  setDraftCarbs]  = useState(0);
  const [draftFat,    setDraftFat]    = useState(0);

  // ── Queries ───────────────────────────────────────────────────────────────
  const profile       = useQuery(api.userProfile.getByUser,          userId ? { userId } : "skip");
  const storedTarget  = useQuery(api.nutrition.getFoodTarget,         userId ? { userId } : "skip");
  const dayEntries    = useQuery(api.nutrition.getDayEntries,         userId ? { userId, date } : "skip") ?? [];
  const weekSummary   = useQuery(api.nutrition.getWeekSummary,        userId ? { userId, date } : "skip") ?? [];
  const suggestions   = useQuery(api.mealPlanSlots.getDaySuggestions, userId ? { userId, date } : "skip") ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveFoodTarget   = useMutation(api.nutrition.saveFoodTarget);
  const deleteFoodEntry  = useMutation(api.nutrition.deleteFoodEntry);
  const addFoodEntry     = useMutation(api.nutrition.addFoodEntry);
  const updateSlotPortion = useMutation(api.mealPlanSlots.updatePortion);

  // Auto-init targets from profile the first time (storedTarget === null means loaded but no record)
  useEffect(() => {
    if (!userId || !profile || storedTarget !== null) return;
    const computed = calcTargets(profile);
    saveFoodTarget({ userId, ...computed });
  }, [userId, profile, storedTarget]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const targets   = storedTarget ?? (profile ? calcTargets(profile) : null);
  const totalCals  = dayEntries.reduce((s, e) => s + e.calories, 0);
  const totalPro   = dayEntries.reduce((s, e) => s + e.proteinG, 0);
  const totalCarbs = dayEntries.reduce((s, e) => s + e.carbsG, 0);
  const totalFat   = dayEntries.reduce((s, e) => s + e.fatG, 0);
  const remaining  = targets ? targets.calories - totalCals : 0;

  const plannedTotals = useMemo(() => ({
    calories: suggestions.reduce((s, sg) => s + sg.scaledMacros.calories, 0),
    proteinG: round1(suggestions.reduce((s, sg) => s + sg.scaledMacros.proteinG, 0)),
    carbsG:   round1(suggestions.reduce((s, sg) => s + sg.scaledMacros.carbsG, 0)),
    fatG:     round1(suggestions.reduce((s, sg) => s + sg.scaledMacros.fatG, 0)),
  }), [suggestions]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openAdd = (meal: MealType) => {
    router.push({ pathname: "/add-food", params: { meal, date } });
  };

  const handleDelete = (entryId: Id<"foodEntries">) => setDeleteTarget(entryId);

  const confirmDelete = () => {
    if (deleteTarget) deleteFoodEntry({ entryId: deleteTarget });
    setDeleteTarget(null);
  };

  const logSuggestion = async (sg: Suggestion, portion?: number) => {
    if (!userId) return;
    const p = portion ?? sg.portion;
    await addFoodEntry({
      userId, date,
      mealType: sg.mealType as "breakfast" | "lunch" | "dinner" | "snack",
      name:     sg.name,
      calories: Math.round(sg.totalMacros.calories * p),
      proteinG: round1(sg.totalMacros.proteinG * p),
      carbsG:   round1(sg.totalMacros.carbsG   * p),
      fatG:     round1(sg.totalMacros.fatG      * p),
    });
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!targets && profile === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={P.gold} />
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>NUTRITION</Text>
            <Text style={s.heroItalic}>Fuel.</Text>
          </View>
        </View>

        {/* ── Date nav ────────────────────────────────────────────────────── */}
        <View style={s.dateNav}>
          <TouchableOpacity onPress={() => setDate(d => offsetDate(d, -1))} hitSlop={12}>
            <Text style={s.navArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.dateLabel}>{fmtDate(date)}</Text>
          <TouchableOpacity
            onPress={() => setDate(d => offsetDate(d, 1))}
            disabled={date >= today}
            hitSlop={12}
          >
            <Text style={[s.navArrow, date >= today && { opacity: 0.2 }]}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Weekly bars ─────────────────────────────────────────────────── */}
        {weekSummary.length > 0 && targets && (
          <Animated.View entering={FadeInDown.springify()} style={s.card}>
            <Text style={s.sectionLabel}>THIS WEEK</Text>
            <View style={s.weekRow}>
              {weekSummary.map((day, i) => {
                const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
                const isSelected = day.date === date;
                const isToday    = day.date === today;
                const pct = targets.calories > 0
                  ? Math.min(day.calories / targets.calories, 1)
                  : 0;
                return (
                  <TouchableOpacity
                    key={day.date}
                    onPress={() => setDate(day.date)}
                    style={s.weekDay}
                  >
                    <View style={s.weekBarTrack}>
                      {pct > 0 && (
                        <View style={[
                          s.weekBarFill,
                          { height: pct * 48 },
                          { backgroundColor: isSelected ? P.gold : P.s3 },
                        ]} />
                      )}
                    </View>
                    <Text style={[s.weekDayLabel, (isSelected || isToday) && { color: P.gold }]}>
                      {DAY_LABELS[i]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── Daily summary ───────────────────────────────────────────────── */}
        {targets && (
          <Animated.View entering={FadeInDown.delay(60).springify()} style={s.card}>
            {/* Calories */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={s.sectionLabel}>CALORIES</Text>
                  <TouchableOpacity onPress={() => {
                    setDraftCals(targets.calories);
                    setDraftPro(targets.proteinG);
                    setDraftCarbs(targets.carbsG);
                    setDraftFat(targets.fatG);
                    setMacroEditorOpen(true);
                  }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontFamily: OUT_L, fontSize: 16, color: P.mid, letterSpacing: 2 }}>⋯</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                  <Text style={s.bigNumber}>{totalCals}</Text>
                  <Text style={s.bigDenom}>/ {targets.calories}</Text>
                </View>
              </View>
              <Text style={[s.remainingText, { color: remaining < 0 ? P.red : P.mid }]}>
                {remaining < 0 ? `${Math.abs(remaining)} over` : `${remaining} left`}
              </Text>
            </View>

            {/* Calorie bar */}
            <View style={s.calBarTrack}>
              <View style={[
                s.calBarFill,
                {
                  width: `${Math.min(totalCals / Math.max(targets.calories, 1) * 100, 100)}%` as any,
                  backgroundColor: totalCals > targets.calories ? P.red : P.gold,
                },
              ]} />
            </View>

            {/* Planned totals row */}
            {plannedTotals.calories > 0 && (
              <View style={s.plannedRow}>
                <Text style={s.plannedLabel}>PLANNED</Text>
                <Text style={s.plannedCals}>{plannedTotals.calories} kcal</Text>
                <Text style={s.plannedMacros}>
                  P {plannedTotals.proteinG}g · C {plannedTotals.carbsG}g · F {plannedTotals.fatG}g
                </Text>
              </View>
            )}

            {/* Macro bars */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              {[
                { label: "PROTEIN", val: totalPro,   target: targets.proteinG, color: C_PROTEIN },
                { label: "CARBS",   val: totalCarbs,  target: targets.carbsG,   color: C_CARBS },
                { label: "FAT",     val: totalFat,    target: targets.fatG,     color: C_FAT },
              ].map(({ label, val, target: t, color }) => (
                <View key={label} style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <Text style={[s.sectionLabel, { fontSize: 9, letterSpacing: 2 }]}>{label}</Text>
                    <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid }}>{Math.round(val)}g</Text>
                  </View>
                  <View style={{ height: 2, backgroundColor: P.border, borderRadius: 1 }}>
                    <View style={{
                      height: 2,
                      width: `${Math.min(val / Math.max(t, 1) * 100, 100)}%` as any,
                      backgroundColor: color,
                      borderRadius: 1,
                    }} />
                  </View>
                  <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.dim, marginTop: 3 }}>
                    {t}g goal
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}


        {/* ── Meal sections ───────────────────────────────────────────────── */}
        {MEALS.map(({ type, label }, idx) => {
          const mealEntries  = dayEntries.filter(e => e.mealType === type);
          const mealCals     = mealEntries.reduce((s, e) => s + e.calories, 0);
          const mealSuggestions = suggestions.filter(s => s.mealType === type);
          // Mark a suggestion as already logged if an entry with the same name exists
          const loggedNames  = new Set(mealEntries.map(e => e.name));
          return (
            <Animated.View
              key={type}
              entering={FadeInDown.delay(120 + idx * 40).springify()}
              style={s.card}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={s.sectionLabel}>{label}</Text>
                  {mealCals > 0 && (
                    <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid, marginTop: 2 }}>
                      {mealCals} kcal
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => openAdd(type)} style={s.addBtn}>
                  <Text style={s.addBtnText}>+ ADD</Text>
                </TouchableOpacity>
              </View>

              {/* Planned meal suggestions */}
              {mealSuggestions.length > 0 && (
                <View style={s.suggestionsWrap}>
                  <Text style={s.suggestLabel}>PLANNED</Text>
                  {mealSuggestions.map((sg) => {
                    const logged = loggedNames.has(sg.name);
                    return (
                      <TouchableOpacity
                        key={sg.slotId}
                        style={[s.suggestRow, logged && s.suggestRowLogged]}
                        onPress={() => setActiveSuggestion(sg as unknown as Suggestion)}
                        activeOpacity={0.75}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.suggestName} numberOfLines={1}>{sg.name}</Text>
                          <Text style={s.suggestMacros}>
                            {sg.scaledMacros.calories} kcal · P {sg.scaledMacros.proteinG}g · C {sg.scaledMacros.carbsG}g · F {sg.scaledMacros.fatG}g
                          </Text>
                        </View>
                        {logged ? (
                          <Text style={s.loggedBadge}>✓ LOGGED</Text>
                        ) : (
                          <TouchableOpacity onPress={() => logSuggestion(sg as unknown as Suggestion, sg.portion)} style={s.logBtn}>
                            <Text style={s.logBtnText}>LOG</Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {mealEntries.length === 0 ? (
                <Text style={s.emptyMeal}>—</Text>
              ) : (
                <View style={{ marginTop: 12 }}>
                  {mealEntries.map(entry => (
                    <View key={entry._id} style={s.foodRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.foodName}>{entry.name}</Text>
                        <Text style={s.foodMacros}>
                          P {entry.proteinG}g · C {entry.carbsG}g · F {entry.fatG}g
                        </Text>
                      </View>
                      <Text style={s.foodCals}>{entry.calories}</Text>
                      <TouchableOpacity
                        onPress={() => handleDelete(entry._id)}
                        hitSlop={12}
                        style={s.deleteBtn}
                      >
                        <Text style={s.deleteBtnText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Suggestion detail modal ─────────────────────────────────────── */}
      <Modal
        visible={activeSuggestion !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveSuggestion(null)}
      >
        {activeSuggestion && (
          <SuggestionDetailModal
            sg={activeSuggestion}
            alreadyLogged={dayEntries.some(e => e.name === activeSuggestion.name)}
            onLog={(portion) => { logSuggestion(activeSuggestion, portion); setActiveSuggestion(null); }}
            onPortionChange={(portion) => updateSlotPortion({ itemId: activeSuggestion.slotId as Id<"mealPlanSlots">, portion })}
            onClose={() => setActiveSuggestion(null)}
          />
        )}
      </Modal>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      {/* ── Macro editor ──────────────────────────────────────────────────── */}
      <Modal visible={macroEditorOpen} transparent animationType="slide" onRequestClose={() => setMacroEditorOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMacroEditorOpen(false)} />
        <View style={{ backgroundColor: P.s1, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: P.border }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.border, alignSelf: "center", marginBottom: 20 }} />
          <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, marginBottom: 16 }}>ADJUST TARGETS</Text>

          {/* Calorie budget — stepper, no slider */}
          {(() => {
            const usedCals = draftPro * 4 + draftCarbs * 4 + draftFat * 9;
            const remaining = draftCals - usedCals;
            const overBudget = remaining < 0;
            return (
              <View style={{ marginBottom: 20, padding: 14, backgroundColor: P.s2, borderRadius: 10, borderWidth: 1, borderColor: overBudget ? P.red : P.border }}>
                <Text style={{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, marginBottom: 8 }}>CALORIE BUDGET</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <TouchableOpacity onPress={() => { const n = draftCals - 50; if (n >= 1200) { setDraftCals(n); setDraftCarbs(Math.max(0, Math.round((n - draftPro * 4 - draftFat * 9) / 4))); }}} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: P.border, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: CG, fontSize: 20, color: P.ink, lineHeight: 24 }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontFamily: CG, fontSize: 32, color: P.gold, letterSpacing: -1 }}>{draftCals} <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid }}>kcal</Text></Text>
                  <TouchableOpacity onPress={() => { const n = draftCals + 50; if (n <= 6000) { setDraftCals(n); setDraftCarbs(Math.max(0, Math.round((n - draftPro * 4 - draftFat * 9) / 4))); }}} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: P.border, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: CG, fontSize: 20, color: P.ink, lineHeight: 24 }}>+</Text>
                  </TouchableOpacity>
                </View>
                {/* Used bar */}
                <View style={{ height: 3, backgroundColor: P.border, borderRadius: 2, marginTop: 12 }}>
                  <View style={{ height: 3, width: `${Math.min(usedCals / draftCals * 100, 100)}%` as any, backgroundColor: overBudget ? P.red : P.gold, borderRadius: 2 }} />
                </View>
                <Text style={{ fontFamily: OUT_L, fontSize: 9, color: overBudget ? P.red : P.mid, marginTop: 6, textAlign: "right" }}>
                  {overBudget ? `${Math.abs(remaining)} over budget` : `${remaining} kcal remaining`}
                </Text>
              </View>
            );
          })()}

          {/* Macro sliders — carbs auto-fills remaining */}
          {[
            { label: "PROTEIN", val: draftPro,   color: C_PROTEIN, kcalPer: 4, max: 400, step: 5,
              onChange: (v: number) => { setDraftPro(v); setDraftCarbs(Math.max(0, Math.round((draftCals - v * 4 - draftFat * 9) / 4))); } },
            { label: "FAT",     val: draftFat,   color: C_FAT,     kcalPer: 9, max: 200, step: 5,
              onChange: (v: number) => { setDraftFat(v); setDraftCarbs(Math.max(0, Math.round((draftCals - draftPro * 4 - v * 9) / 4))); } },
            { label: "CARBS",   val: draftCarbs, color: C_CARBS,   kcalPer: 4, max: 700, step: 5,
              onChange: (v: number) => { const max = Math.max(0, Math.round((draftCals - draftPro * 4 - draftFat * 9) / 4)); setDraftCarbs(Math.min(v, max)); } },
          ].map(({ label, val, color, kcalPer, max, step, onChange }) => {
            const pct = draftCals > 0 ? Math.round(val * kcalPer / draftCals * 100) : 0;
            return (
              <View key={label} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
                  <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid }}>{label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                    <Text style={{ fontFamily: CG, fontSize: 22, color: P.ink, letterSpacing: -0.5 }}>{val}g</Text>
                    <Text style={{ fontFamily: OUT_L, fontSize: 10, color }}>{pct}%</Text>
                  </View>
                </View>
                <MacroSlider value={val} min={0} max={max} step={step} color={color} onChange={onChange} />
              </View>
            );
          })}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity onPress={() => setMacroEditorOpen(false)}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: P.s2, alignItems: "center", borderWidth: 1, borderColor: P.border }}>
              <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid }}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!userId) return;
                saveFoodTarget({ userId, calories: draftCals, proteinG: draftPro, carbsG: draftCarbs, fatG: draftFat, goal: targets?.goal ?? "maintain" });
                setMacroEditorOpen(false);
              }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: P.gold, alignItems: "center" }}>
              <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.bg }}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setDeleteTarget(null)}>
          <TouchableOpacity activeOpacity={1} style={s.dialog}>
            <Text style={s.dialogTitle}>Remove food?</Text>
            <Text style={s.dialogDesc}>This entry will be removed from today's log.</Text>
            <View style={s.dialogBtns}>
              <TouchableOpacity style={s.dialogCancel} onPress={() => setDeleteTarget(null)}>
                <Text style={s.dialogCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dialogRemove} onPress={confirmDelete}>
                <Text style={s.dialogRemoveText}>REMOVE</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll:       { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingTop: 8 },
  eyebrow:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.mid, textTransform: "uppercase", marginBottom: 4 },
  heroItalic:   { fontFamily: CG_ITALIC, fontSize: 40, color: P.ink, letterSpacing: -1 },
  goalBadge:    { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, alignItems: "flex-end" },
  goalLabel:    { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, textTransform: "uppercase" },
  goalCals:     { fontFamily: CG, fontSize: 22, color: P.ink, marginTop: 2 },
  goalUnit:     { fontFamily: OUT_L, fontSize: 9, color: P.mid, letterSpacing: 1 },

  dateNav:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 4 },
  navArrow:     { fontFamily: OUT_L, fontSize: 18, color: P.mid },
  dateLabel:    { fontFamily: OUT_L, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: P.ink },

  card:         { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 20, marginBottom: 12, backgroundColor: P.s1 },
  sectionLabel: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: P.mid },

  weekRow:      { flexDirection: "row", gap: 6, marginTop: 16 },
  weekDay:      { flex: 1, alignItems: "center", gap: 6 },
  weekBarTrack: { height: 48, width: "100%", backgroundColor: P.border, borderRadius: 2, justifyContent: "flex-end" },
  weekBarFill:  { width: "100%", borderRadius: 2 },
  weekDayLabel: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 1, color: P.dim },

  bigNumber:    { fontFamily: CG, fontSize: 44, color: P.ink, letterSpacing: -1 },
  bigDenom:     { fontFamily: CG, fontSize: 20, color: P.mid },
  remainingText:{ fontFamily: OUT_L, fontSize: 12 },
  calBarTrack:  { height: 2, backgroundColor: P.border, borderRadius: 1, marginTop: 10, overflow: "hidden" },
  calBarFill:   { height: 2, borderRadius: 1 },

  plannedRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border, flexWrap: "wrap" },
  plannedLabel: { fontFamily: OUT_L, fontSize: 8, letterSpacing: 3, color: "rgba(201,168,76,0.6)" },
  plannedCals:  { fontFamily: CG, fontSize: 15, color: P.mid, letterSpacing: -0.3 },
  plannedMacros:{ fontFamily: OUT_L, fontSize: 10, color: P.dim, flex: 1 },

  addBtn:       { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  addBtnText:   { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  emptyMeal:    { fontFamily: OUT_L, fontSize: 13, color: P.dim, marginTop: 10 },

  suggestionsWrap:  { marginTop: 14, gap: 6 },
  suggestLabel:     { fontFamily: OUT_L, fontSize: 8, letterSpacing: 3, color: "rgba(201,168,76,0.6)", marginBottom: 4 },
  suggestRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(201,168,76,0.35)", backgroundColor: "rgba(201,168,76,0.05)" },
  suggestRowLogged: { borderColor: P.border, backgroundColor: "transparent", opacity: 0.5 },
  suggestName:      { fontFamily: OUT_L, fontSize: 13, color: P.ink, marginBottom: 2 },
  suggestMacros:    { fontFamily: OUT_L, fontSize: 10, color: P.mid },
  logBtn:           { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 3, backgroundColor: P.gold, marginLeft: 8 },
  logBtnText:       { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.bg },
  loggedBadge:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, marginLeft: 8 },

  foodRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  foodName:     { fontFamily: OUT, fontSize: 14, color: P.ink, marginBottom: 2 },
  foodMacros:   { fontFamily: OUT_L, fontSize: 11, color: P.mid },
  foodCals:     { fontFamily: CG, fontSize: 18, color: P.gold },
  deleteBtn:      { marginLeft: 12, padding: 4 },
  deleteBtnText:  { fontFamily: OUT_L, fontSize: 20, color: P.red, lineHeight: 22 },

  overlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  dialog:         { width: 280, backgroundColor: P.s1, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 24 },
  dialogTitle:    { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: P.ink, marginBottom: 8 },
  dialogDesc:     { fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 19, marginBottom: 24 },
  dialogBtns:     { flexDirection: "row", gap: 10 },
  dialogCancel:   { flex: 1, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 4, alignItems: "center" },
  dialogCancelText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  dialogRemove:   { flex: 1, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: P.red, borderRadius: 4, alignItems: "center" },
  dialogRemoveText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.red, textTransform: "uppercase" },
});
