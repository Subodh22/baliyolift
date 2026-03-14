import React, { useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, useWindowDimensions, Modal, Image, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { MUSCLE_BADGE_COLORS } from "@/constants/colors";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function toPhotoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function formatDate(ts: number) {
  const d = new Date(ts), today = new Date(), yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}
function formatPhotoDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d), today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ── Calendar Heatmap ─────────────────────────────────────────────────────────
function CalendarHeatmap({ workoutDates, photoDates, colors, onDayPress }: {
  workoutDates: Set<string>; photoDates: Set<string>; colors: any; onDayPress: (d: string) => void;
}) {
  const { width } = useWindowDimensions();
  const LABEL_W = 26, LABEL_GAP = 8, H_GAP = 2, ROW_GAP = 4;
  const CELL = Math.max(6, Math.floor((width - 60 - LABEL_W - LABEL_GAP - 30 * H_GAP) / 31));

  const months = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: 12 }, (_, i) => {
      const base = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
      const year = base.getFullYear(), month = base.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const days = Array.from({ length: 31 }, (_, di) => {
        const day = di + 1;
        if (day > daysInMonth) return { empty: true };
        const cellDate = new Date(year, month, day);
        const pd = toPhotoDate(year, month, day);
        return { empty: false, isFuture: cellDate > today, hasWorkout: workoutDates.has(`${year}-${month}-${day}`), hasPhoto: photoDates.has(pd), photoDate: pd };
      });
      return { label: MONTH_SHORT[month], days };
    });
  }, [workoutDates, photoDates]);

  return (
    <View>
      {months.map((month, mi) => (
        <View key={mi} style={{ flexDirection: "row", alignItems: "center", marginBottom: mi < 11 ? ROW_GAP : 0 }}>
          <Text style={{ width: LABEL_W, fontSize: 9, color: colors.labelTertiary, fontFamily: "Outfit_300Light", marginRight: LABEL_GAP }}>
            {month.label}
          </Text>
          {month.days.map((day, di) => {
            const canPress = !day.empty && !day.isFuture && (day.hasWorkout || day.hasPhoto);
            return (
              <TouchableOpacity key={di} disabled={!canPress}
                onPress={() => canPress && day.photoDate && onDayPress(day.photoDate)}
                activeOpacity={0.7}
                style={{
                  width: CELL, height: CELL, borderRadius: 1.5,
                  marginRight: di < 30 ? H_GAP : 0,
                  backgroundColor: day.empty ? "transparent" : day.hasWorkout ? colors.accent : colors.fillSecondary,
                  ...(day.hasPhoto && !day.empty ? { borderWidth: 1, borderColor: colors.background } : {}),
                }}
              />
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 10 }}>
        <View style={{ width: CELL, height: CELL, borderRadius: 1.5, backgroundColor: colors.fillSecondary }} />
        <Text style={{ fontFamily: "Outfit_300Light", fontSize: 9, color: colors.labelTertiary }}>Rest</Text>
        <View style={{ width: CELL, height: CELL, borderRadius: 1.5, backgroundColor: colors.accent, marginLeft: 8 }} />
        <Text style={{ fontFamily: "Outfit_300Light", fontSize: 9, color: colors.labelTertiary }}>Trained</Text>
      </View>
    </View>
  );
}

// ── Month Calendar ────────────────────────────────────────────────────────────
const DAY_HEADERS = ["M","T","W","T","F","S","S"];

function MonthCalendar({ viewDate, workoutDates, photoDates, colors, onDayPress }: any) {
  const { width } = useWindowDimensions();
  const GAP = 4, CELL = Math.floor((width - 60 - 6 * GAP) / 7);
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const result: any[] = Array.from({ length: startOffset }, () => ({ day: null }));
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d), pd = toPhotoDate(year, month, d);
      result.push({ day: d, hasWorkout: workoutDates.has(`${year}-${month}-${d}`), hasPhoto: photoDates.has(pd), isFuture: cellDate > today, isToday: cellDate.toDateString() === today.toDateString(), photoDate: pd });
    }
    while (result.length % 7 !== 0) result.push({ day: null });
    return result;
  }, [viewDate, workoutDates, photoDates, today]);

  const rows: any[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP + 2 }}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={{ width: CELL, alignItems: "center" }}>
            <Text style={{ fontFamily: "Outfit_300Light", fontSize: 11, color: colors.labelTertiary }}>{d}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: GAP, marginBottom: ri < rows.length - 1 ? GAP : 0 }}>
          {row.map((cell, ci) => {
            const canPress = cell.day !== null && !cell.isFuture && (cell.hasWorkout || cell.hasPhoto);
            return (
              <TouchableOpacity key={ci} disabled={!canPress} onPress={() => canPress && onDayPress(cell.photoDate)} activeOpacity={0.7}
                style={{ width: CELL, height: CELL, borderRadius: 4, backgroundColor: cell.day === null ? "transparent" : cell.hasWorkout ? colors.accent : colors.fillSecondary, alignItems: "center", justifyContent: "center", borderWidth: cell.isToday ? 1.5 : 0, borderColor: colors.accent }}
              >
                {cell.day !== null && (
                  <Text style={{ fontFamily: cell.isToday ? "Outfit_400Regular" : "Outfit_300Light", fontSize: 12, color: cell.hasWorkout ? "#fff" : cell.isFuture ? colors.labelQuaternary : colors.labelSecondary }}>
                    {cell.day}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Photo Modal ───────────────────────────────────────────────────────────────
function PhotoModal({ visible, dateStr, userId, onClose, colors }: any) {
  const photo = useQuery(api.progressPhotos.getTodayPhoto, visible && userId && dateStr ? { userId, date: dateStr } : "skip");
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable style={[s.photoSheet, { backgroundColor: colors.backgroundSecondary }]} onPress={() => {}}>
          <View style={[s.handle, { backgroundColor: colors.separator }]} />
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 16, color: colors.label, marginBottom: 4 }}>Progress Photo</Text>
          <Text style={{ fontFamily: "Outfit_300Light", fontSize: 12, color: colors.labelSecondary, marginBottom: 16 }}>
            {dateStr ? formatPhotoDate(dateStr) : ""}
          </Text>
          {photo === undefined ? (
            <View style={{ height: 280, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : photo === null ? (
            <View style={[s.noPhoto, { borderColor: colors.separator }]}>
              <Text style={{ fontFamily: "Outfit_300Light", fontSize: 14, color: colors.labelSecondary }}>No photo for this day</Text>
            </View>
          ) : (
            <Image source={{ uri: photo.imageUrl }} style={s.photoImg} resizeMode="cover" />
          )}
          <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.fillSecondary }]}>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: colors.label }}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Workout Card ──────────────────────────────────────────────────────────────
function WorkoutCard({ workout, colors }: { workout: any; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const muscles = [...new Set<string>(workout.exercises.map((e: any) => e.muscleGroup))];
  return (
    <View style={[s.wCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
      <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.75}>
        <View style={s.wCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Outfit_300Light", fontSize: 11, color: colors.labelTertiary, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {formatDate(workout.date)}{workout.weekNumber ? `  ·  Wk ${workout.weekNumber}` : ""}
            </Text>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: colors.label, marginTop: 3 }}>{workout.sessionName}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
              {muscles.map(m => (
                <View key={m} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: (MUSCLE_BADGE_COLORS[m] ?? "#555") + "18" }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 10, color: MUSCLE_BADGE_COLORS[m] ?? "#555" }}>
                    {(MUSCLE_DISPLAY_NAMES as any)[m] ?? m}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {!!workout.durationMin && (
              <Text style={{ fontFamily: "Outfit_300Light", fontSize: 12, color: colors.labelSecondary }}>{workout.durationMin}m</Text>
            )}
            <Text style={{ color: colors.labelTertiary, fontSize: 14 }}>{expanded ? "−" : "+"}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.separator, gap: 10 }}>
          {workout.exercises.map((ex: any) => (
            <View key={ex.name}>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: colors.label, marginBottom: 5 }}>{ex.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {ex.sets.map((set: any, i: number) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.fillSecondary }}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: colors.label }}>{set.weight}kg × {set.reps}</Text>
                    <Text style={{ fontFamily: "Outfit_300Light", fontSize: 10, color: colors.labelTertiary, marginLeft: 4 }}>RIR {set.rir}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { colors } = useTheme();
  const { userId, loading } = useCurrentUser();
  const [heatmapView, setHeatmapView] = useState<"year" | "month">("year");
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedPhotoDate, setSelectedPhotoDate] = useState<string | null>(null);

  const dateSummary    = useQuery(api.workouts.getWorkoutDates, userId ? { userId } : "skip");
  const recentWorkouts = useQuery(api.workouts.getHistory, userId ? { userId, limit: 15 } : "skip");
  const allPhotos      = useQuery(api.progressPhotos.listPhotos, userId ? { userId } : "skip");
  const isLoading      = loading || dateSummary === undefined;

  const photoDates = useMemo(() => {
    const set = new Set<string>();
    for (const p of allPhotos ?? []) set.add(p.date);
    return set;
  }, [allPhotos]);

  const { workoutDates, stats } = useMemo(() => {
    if (!dateSummary || !dateSummary.length) return { workoutDates: new Set<string>(), stats: null };
    const dates = new Set<string>();
    for (const w of dateSummary) dates.add(dayKey(w.date));

    let streak = 0;
    const check = new Date(); check.setHours(0,0,0,0);
    if (!dates.has(dayKey(check.getTime()))) check.setDate(check.getDate() - 1);
    while (dates.has(dayKey(check.getTime()))) { streak++; check.setDate(check.getDate() - 1); }

    const sorted = [...dates].map(k => { const [y,mo,d] = k.split("-").map(Number); return new Date(y,mo,d).getTime(); }).sort((a,b) => a-b);
    let longest = 0, run = 0;
    for (let i = 0; i < sorted.length; i++) {
      run = i === 0 ? 1 : (sorted[i] - sorted[i-1]) / 86400000 === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const twelveWeeksAgo = Date.now() - 84 * 86400000;
    const weeklyFrequency: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const wS = new Date(); wS.setDate(wS.getDate() - wS.getDay() - i*7); wS.setHours(0,0,0,0);
      const wE = new Date(wS); wE.setDate(wS.getDate() + 7);
      weeklyFrequency.push(new Set(dateSummary.filter(w => w.date >= wS.getTime() && w.date < wE.getTime()).map(w => dayKey(w.date))).size);
    }
    return {
      workoutDates: dates,
      stats: {
        streak, longest,
        total: dateSummary.length,
        thisWeek: dateSummary.filter(w => w.date >= weekStart.getTime()).length,
        thisMonth: dateSummary.filter(w => w.date >= monthStart.getTime()).length,
        avgPerWeek: (dateSummary.filter(w => w.date >= twelveWeeksAgo).length / 12).toFixed(1),
        weeklyFrequency,
      },
    };
  }, [dateSummary]);

  const { monthVolume, topMuscle } = useMemo(() => {
    if (!recentWorkouts?.length) return { monthVolume: 0, topMuscle: null };
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    let vol = 0; const mc: Record<string,number> = {};
    for (const w of recentWorkouts) for (const ex of w.exercises) {
      if (w.date >= monthStart.getTime()) for (const s of ex.sets) vol += (s.weight ?? 0) * (s.reps ?? 0);
      mc[ex.muscleGroup] = (mc[ex.muscleGroup] ?? 0) + ex.sets.length;
    }
    return { monthVolume: vol, topMuscle: Object.entries(mc).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null };
  }, [recentWorkouts]);

  const maxFreq = stats ? Math.max(...stats.weeklyFrequency, 1) : 1;

  const statTiles = stats ? [
    { v: stats.streak > 0 ? `${stats.streak}` : "—", l: "Streak", accent: true },
    { v: `${stats.total}`, l: "All time" },
    { v: `${stats.thisWeek}`, l: "This week" },
    { v: `${stats.thisMonth}`, l: "This month" },
    { v: stats.avgPerWeek, l: "Avg / week" },
    { v: `${stats.longest}`, l: "Best streak" },
  ] : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={[s.screenLabel, { color: colors.labelSecondary }]}>Your training log</Text>
          <Text style={[s.heroItalic, { color: colors.label }]}>History.</Text>
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {!isLoading && !dateSummary?.length && (
          <View style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 17, color: colors.label }}>No workouts yet</Text>
            <Text style={{ fontFamily: "Outfit_300Light", fontSize: 14, color: colors.labelSecondary, marginTop: 8, lineHeight: 22 }}>
              Complete a workout to see your heatmap, streaks, and stats here.
            </Text>
          </View>
        )}

        {!isLoading && stats && (
          <>
            {/* Heatmap */}
            <View style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator, padding: 16 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>
                  {heatmapView === "year" ? "12 months" : `${MONTH_SHORT[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`}
                </Text>
                <View style={{ flexDirection: "row", backgroundColor: colors.fillSecondary, borderRadius: 4, padding: 2 }}>
                  {(["month","year"] as const).map(v => (
                    <TouchableOpacity key={v} onPress={() => setHeatmapView(v)}
                      style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4, backgroundColor: heatmapView === v ? colors.backgroundSecondary : "transparent" }}
                    >
                      <Text style={{ fontFamily: heatmapView === v ? "Outfit_400Regular" : "Outfit_300Light", fontSize: 12, color: heatmapView === v ? colors.label : colors.labelTertiary }}>
                        {v === "month" ? "Month" : "Year"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {heatmapView === "month" && (() => {
                const now = new Date();
                const atCurrent = viewMonth.getFullYear() === now.getFullYear() && viewMonth.getMonth() === now.getMonth();
                return (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <TouchableOpacity onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                      <Text style={{ fontSize: 20, color: colors.labelSecondary }}>‹</Text>
                    </TouchableOpacity>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: colors.label }}>
                      {MONTH_SHORT[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                    </Text>
                    <TouchableOpacity onPress={() => !atCurrent && setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                      <Text style={{ fontSize: 20, color: atCurrent ? colors.labelQuaternary : colors.labelSecondary }}>›</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {heatmapView === "year"
                ? <CalendarHeatmap workoutDates={workoutDates} photoDates={photoDates} colors={colors} onDayPress={setSelectedPhotoDate} />
                : <MonthCalendar viewDate={viewMonth} workoutDates={workoutDates} photoDates={photoDates} colors={colors} onDayPress={setSelectedPhotoDate} />
              }
            </View>

            {/* Stat tiles — 2×3 grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {statTiles.map(({ v, l, accent }) => (
                <View key={l} style={[s.statTile, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
                  <Text style={{ fontFamily: "CormorantGaramond_300Light", fontSize: 24, color: accent ? colors.accent : colors.label, letterSpacing: -0.5 }}>{v}</Text>
                  <Text style={{ fontFamily: "Outfit_300Light", fontSize: 10, color: colors.labelTertiary, marginTop: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>{l}</Text>
                </View>
              ))}
            </View>

          </>
        )}
      </ScrollView>

      <PhotoModal visible={selectedPhotoDate !== null} dateStr={selectedPhotoDate ?? ""} userId={userId}
        onClose={() => setSelectedPhotoDate(null)} colors={colors} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:      { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  header:      { marginTop: 16, marginBottom: 32 },
  screenLabel: { fontFamily: "Outfit_300Light", fontSize: 10, letterSpacing: 3, textTransform: "uppercase" },
  heroItalic:  { fontFamily: "CormorantGaramond_300Light_Italic", fontSize: 52, fontWeight: "300", letterSpacing: -0.5, lineHeight: 58, marginTop: 10 },
  sectionLabel:{ fontFamily: "Outfit_300Light", fontSize: 10, letterSpacing: 3, textTransform: "uppercase" },
  card:        { borderRadius: 4, padding: 20, borderWidth: 1 },
  statTile:    { width: "48%", borderRadius: 4, padding: 16, borderWidth: 1 },
  metaCell:    { flex: 1, paddingVertical: 20, paddingHorizontal: 16, alignItems: "center" },
  wCard:       { borderRadius: 4, borderWidth: 1, overflow: "hidden", marginBottom: 0 },
  wCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16 },
  photoSheet:  { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  noPhoto:     { height: 160, borderRadius: 4, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  photoImg:    { width: "100%", height: 320, borderRadius: 4, marginBottom: 16 },
  closeBtn:    { paddingVertical: 14, borderRadius: 4, alignItems: "center" },
});
