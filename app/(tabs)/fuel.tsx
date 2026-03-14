import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState, useEffect } from "react";
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

  const proteinG = Math.round(lbm * (goal === "cut" ? 2.5 : 2.2));
  const fatG     = Math.round(calories * 0.27 / 9);
  const carbsG   = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return { calories, proteinG, carbsG, fatG, goal };
}

function goalColor(goal: "cut" | "bulk" | "maintain") {
  if (goal === "cut")  return P.red;
  if (goal === "bulk") return P.green;
  return P.gold;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function FuelScreen() {
  const today = todayStr();
  const router = useRouter();
  const { userId } = useCurrentUser();

  const [date,         setDate]         = useState(today);
  const [deleteTarget, setDeleteTarget] = useState<Id<"foodEntries"> | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const profile      = useQuery(api.userProfile.getByUser,    userId ? { userId } : "skip");
  const storedTarget = useQuery(api.nutrition.getFoodTarget,   userId ? { userId } : "skip");
  const dayEntries   = useQuery(api.nutrition.getDayEntries,   userId ? { userId, date } : "skip") ?? [];
  const weekSummary  = useQuery(api.nutrition.getWeekSummary,  userId ? { userId, date } : "skip") ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveFoodTarget  = useMutation(api.nutrition.saveFoodTarget);
  const deleteFoodEntry = useMutation(api.nutrition.deleteFoodEntry);

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openAdd = (meal: MealType) => {
    router.push({ pathname: "/add-food", params: { meal, date } });
  };

  const handleDelete = (entryId: Id<"foodEntries">) => setDeleteTarget(entryId);

  const confirmDelete = () => {
    if (deleteTarget) deleteFoodEntry({ entryId: deleteTarget });
    setDeleteTarget(null);
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
                <Text style={s.sectionLabel}>CALORIES</Text>
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
                    <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid }}>{val}g</Text>
                  </View>
                  <View style={{ height: 2, backgroundColor: P.border, borderRadius: 1 }}>
                    <View style={{
                      height: 2,
                      width: `${Math.min(val / Math.max(t, 1) * 100, 100)}%` as any,
                      backgroundColor: color,
                      borderRadius: 1,
                    }} />
                  </View>
                  <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim, marginTop: 3 }}>
                    {t}g goal
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}


        {/* ── Meal sections ───────────────────────────────────────────────── */}
        {MEALS.map(({ type, label }, idx) => {
          const mealEntries = dayEntries.filter(e => e.mealType === type);
          const mealCals    = mealEntries.reduce((s, e) => s + e.calories, 0);
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

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
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

  addBtn:       { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  addBtnText:   { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  emptyMeal:    { fontFamily: OUT_L, fontSize: 13, color: P.dim, marginTop: 10 },

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
