import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  Modal,
  Image,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { MUSCLE_BADGE_COLORS } from "@/constants/colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function toPhotoDate(year: number, month: number, day: number): string {
  // month is 0-indexed here, photo date is YYYY-MM-DD (1-indexed, padded)
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function formatPhotoDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

function CalendarHeatmap({
  workoutDates,
  photoDates,
  colors,
  onDayPress,
}: {
  workoutDates: Set<string>;
  photoDates: Set<string>;
  colors: any;
  onDayPress: (photoDate: string) => void;
}) {
  const { width } = useWindowDimensions();
  const H_GAP = 2;
  const ROW_GAP = 5;
  const LABEL_W = 26;
  const LABEL_GAP = 8;
  const contentW = width - 60;
  const CELL = Math.max(6, Math.floor((contentW - LABEL_W - LABEL_GAP - 30 * H_GAP) / 31));

  const months = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const base = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = base.getFullYear();
      const month = base.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const days: Array<{ empty: boolean; isFuture?: boolean; hasWorkout?: boolean; hasPhoto?: boolean; photoDate?: string }> = [];
      for (let day = 1; day <= 31; day++) {
        if (day > daysInMonth) {
          days.push({ empty: true });
        } else {
          const cellDate = new Date(year, month, day);
          const pd = toPhotoDate(year, month, day);
          days.push({
            empty: false,
            isFuture: cellDate > today,
            hasWorkout: workoutDates.has(`${year}-${month}-${day}`),
            hasPhoto: photoDates.has(pd),
            photoDate: pd,
          });
        }
      }
      result.push({ label: MONTH_SHORT[month], days });
    }
    return result;
  }, [workoutDates, photoDates]);

  return (
    <View>
      <View style={{ flexDirection: "row", marginLeft: LABEL_W + LABEL_GAP, marginBottom: 4 }}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
          <View key={d} style={{ width: CELL, marginRight: d < 31 ? H_GAP : 0, alignItems: "center" }}>
            {[1, 8, 15, 22, 29].includes(d) && (
              <Text style={{ fontSize: 9, color: colors.labelTertiary, fontWeight: "500" }}>{d}</Text>
            )}
          </View>
        ))}
      </View>

      {months.map((month, mi) => (
        <View
          key={mi}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: mi < 11 ? ROW_GAP : 0 }}
        >
          <Text style={{ width: LABEL_W, fontSize: 10, color: colors.labelTertiary, fontWeight: "500", marginRight: LABEL_GAP }}>
            {month.label}
          </Text>
          {month.days.map((day, di) => {
            const canPress = !day.empty && !day.isFuture && (day.hasWorkout || day.hasPhoto);
            return (
              <TouchableOpacity
                key={di}
                disabled={!canPress}
                onPress={() => canPress && day.photoDate && onDayPress(day.photoDate)}
                activeOpacity={0.7}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 2,
                  marginRight: di < 30 ? H_GAP : 0,
                  backgroundColor: day.empty
                    ? "transparent"
                    : day.hasWorkout
                    ? colors.accent
                    : colors.fillSecondary,
                  // dot indicator for photo
                  ...(day.hasPhoto && !day.empty ? { borderWidth: 1.5, borderColor: "#fff" } : {}),
                }}
              />
            );
          })}
        </View>
      ))}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 12 }}>
        <View style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: colors.fillSecondary }} />
        <Text style={{ fontSize: 10, color: colors.labelTertiary }}>Rest</Text>
        <View style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: colors.accent, marginLeft: 8 }} />
        <Text style={{ fontSize: 10, color: colors.labelTertiary }}>Trained</Text>
        <View style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: "#fff", marginLeft: 8 }} />
        <Text style={{ fontSize: 10, color: colors.labelTertiary }}>+ Photo</Text>
      </View>
    </View>
  );
}

// ─── Month Calendar ───────────────────────────────────────────────────────────

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

function MonthCalendar({
  viewDate,
  workoutDates,
  photoDates,
  colors,
  onDayPress,
}: {
  viewDate: Date;
  workoutDates: Set<string>;
  photoDates: Set<string>;
  colors: any;
  onDayPress: (photoDate: string) => void;
}) {
  const { width } = useWindowDimensions();
  const GAP = 4;
  const CELL = Math.floor((width - 60 - 6 * GAP) / 7);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

    const result: Array<{
      day: number | null;
      hasWorkout: boolean;
      hasPhoto: boolean;
      isFuture: boolean;
      isToday: boolean;
      photoDate: string;
    }> = [];
    for (let i = 0; i < startOffset; i++) result.push({ day: null, hasWorkout: false, hasPhoto: false, isFuture: false, isToday: false, photoDate: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const pd = toPhotoDate(year, month, d);
      result.push({
        day: d,
        hasWorkout: workoutDates.has(`${year}-${month}-${d}`),
        hasPhoto: photoDates.has(pd),
        isFuture: cellDate > today,
        isToday: cellDate.toDateString() === today.toDateString(),
        photoDate: pd,
      });
    }
    while (result.length % 7 !== 0) result.push({ day: null, hasWorkout: false, hasPhoto: false, isFuture: false, isToday: false, photoDate: "" });
    return result;
  }, [viewDate, workoutDates, photoDates, today]);

  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP + 2 }}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={{ width: CELL, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.labelTertiary }}>{d}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: GAP, marginBottom: ri < rows.length - 1 ? GAP : 0 }}>
          {row.map((cell, ci) => {
            const canPress = cell.day !== null && !cell.isFuture && (cell.hasWorkout || cell.hasPhoto);
            return (
              <TouchableOpacity
                key={ci}
                disabled={!canPress}
                onPress={() => canPress && onDayPress(cell.photoDate)}
                activeOpacity={0.7}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 8,
                  backgroundColor: cell.day === null ? "transparent" : cell.hasWorkout ? colors.accent : colors.fillSecondary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: cell.isToday ? 1.5 : cell.hasPhoto ? 1.5 : 0,
                  borderColor: cell.isToday ? colors.accent : cell.hasPhoto ? "#fff" : "transparent",
                }}
              >
                {cell.day !== null && (
                  <Text style={{
                    fontSize: 12,
                    fontWeight: cell.isToday ? "700" : "500",
                    color: cell.hasWorkout ? "#fff" : cell.isFuture ? colors.labelQuaternary : colors.labelSecondary,
                  }}>
                    {cell.day}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 12 }}>
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.fillSecondary }} />
        <Text style={{ fontSize: 10, color: colors.labelTertiary }}>Rest</Text>
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.accent, marginLeft: 8 }} />
        <Text style={{ fontSize: 10, color: colors.labelTertiary }}>Trained</Text>
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: "#fff", marginLeft: 8 }} />
        <Text style={{ fontSize: 10, color: colors.labelTertiary }}>+ Photo</Text>
      </View>
    </View>
  );
}

// ─── Photo Modal ──────────────────────────────────────────────────────────────

function PhotoModal({
  visible,
  dateStr,
  userId,
  onClose,
  colors,
  typography,
}: {
  visible: boolean;
  dateStr: string;
  userId: any;
  onClose: () => void;
  colors: any;
  typography: any;
}) {
  const photo = useQuery(
    api.progressPhotos.getTodayPhoto,
    visible && userId && dateStr ? { userId, date: dateStr } : "skip"
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={photoModalStyles.backdrop} onPress={onClose}>
        <Pressable style={[photoModalStyles.sheet, { backgroundColor: colors.backgroundSecondary }]} onPress={() => {}}>
          <View style={[photoModalStyles.handle, { backgroundColor: colors.separator }]} />

          <Text style={[typography.headline, { color: colors.label, marginBottom: 4 }]}>
            Progress Photo
          </Text>
          <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 16 }]}>
            {dateStr ? formatPhotoDate(dateStr) : ""}
          </Text>

          {photo === undefined ? (
            <View style={{ height: 280, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : photo === null ? (
            <View style={[photoModalStyles.noPhoto, { borderColor: colors.separator }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📷</Text>
              <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>
                No photo for this day
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: photo.imageUrl }}
              style={photoModalStyles.image}
              resizeMode="cover"
            />
          )}

          <TouchableOpacity
            onPress={onClose}
            style={[photoModalStyles.closeBtn, { backgroundColor: colors.fillSecondary }]}
          >
            <Text style={[typography.body, { color: colors.label, fontWeight: "600" }]}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const photoModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: 360,
    borderRadius: 14,
    marginBottom: 16,
  },
  noPhoto: {
    height: 200,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
});

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  value, label, accent = false, colors,
}: {
  value: string; label: string; accent?: boolean; colors: any;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.statValue, { color: accent ? colors.accent : colors.label }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.labelTertiary }]}>{label}</Text>
    </View>
  );
}

// ─── Workout Card ─────────────────────────────────────────────────────────────

function WorkoutCard({ workout, colors, typography }: { workout: any; colors: any; typography: any }) {
  const [expanded, setExpanded] = useState(false);
  const muscles = [...new Set<string>(workout.exercises.map((e: any) => e.muscleGroup))];

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
      <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.75}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: colors.labelTertiary, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {formatDate(workout.date)}{workout.weekNumber ? `  ·  Wk ${workout.weekNumber}` : ""}
            </Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>
              {workout.sessionName}
            </Text>
            <View style={styles.pillRow}>
              {muscles.map(m => (
                <View key={m} style={[styles.pill, { backgroundColor: (MUSCLE_BADGE_COLORS[m] ?? "#555") + "22" }]}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: MUSCLE_BADGE_COLORS[m] ?? "#555" }}>
                    {(MUSCLE_DISPLAY_NAMES as any)[m]?.toUpperCase() ?? m}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {!!workout.durationMin && (
              <Text style={[typography.caption1, { color: colors.labelSecondary }]}>{workout.durationMin}m</Text>
            )}
            <Text style={{ color: colors.labelTertiary, fontSize: 14 }}>{expanded ? "▾" : "▸"}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 12, gap: 10 }}>
          {workout.exercises.map((ex: any) => (
            <View key={ex.name}>
              <Text style={[typography.subheadline, { color: colors.label, marginBottom: 5 }]}>{ex.name}</Text>
              <View style={styles.chipRow}>
                {ex.sets.map((s: any, i: number) => (
                  <View key={i} style={[styles.setChip, { backgroundColor: colors.fillSecondary }]}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                      {s.weight}kg × {s.reps}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.labelTertiary, marginLeft: 4 }}>RIR {s.rir}</Text>
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { colors, typography } = useTheme();
  const { userId, loading } = useCurrentUser();
  const [heatmapView, setHeatmapView] = useState<"year" | "month">("year");
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedPhotoDate, setSelectedPhotoDate] = useState<string | null>(null);

  const dateSummary = useQuery(api.workouts.getWorkoutDates, userId ? { userId } : "skip");
  const recentWorkouts = useQuery(api.workouts.getHistory, userId ? { userId, limit: 15 } : "skip");
  const allPhotos = useQuery(api.progressPhotos.listPhotos, userId ? { userId } : "skip");

  const isLoading = loading || dateSummary === undefined;

  const photoDates = useMemo(() => {
    const set = new Set<string>();
    for (const p of allPhotos ?? []) set.add(p.date);
    return set;
  }, [allPhotos]);

  const { workoutDates, stats } = useMemo(() => {
    if (!dateSummary || dateSummary.length === 0) {
      return { workoutDates: new Set<string>(), stats: null };
    }

    const dates = new Set<string>();
    for (const w of dateSummary) dates.add(dayKey(w.date));

    let streak = 0;
    const check = new Date();
    check.setHours(0, 0, 0, 0);
    if (!dates.has(dayKey(check.getTime()))) check.setDate(check.getDate() - 1);
    while (dates.has(dayKey(check.getTime()))) { streak++; check.setDate(check.getDate() - 1); }

    const sortedDays = [...dates]
      .map(k => { const [y, mo, d] = k.split("-").map(Number); return new Date(y, mo, d).getTime(); })
      .sort((a, b) => a - b);
    let longest = 0, curRun = 0;
    for (let i = 0; i < sortedDays.length; i++) {
      curRun = i === 0 ? 1 : (sortedDays[i] - sortedDays[i - 1]) / 86400000 === 1 ? curRun + 1 : 1;
      longest = Math.max(longest, curRun);
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisWeek = dateSummary.filter(w => w.date >= weekStart.getTime()).length;
    const thisMonth = dateSummary.filter(w => w.date >= monthStart.getTime()).length;

    const twelveWeeksAgo = Date.now() - 84 * 24 * 60 * 60 * 1000;
    const avgPerWeek = (dateSummary.filter(w => w.date >= twelveWeeksAgo).length / 12).toFixed(1);

    const weeklyFrequency: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date();
      wStart.setDate(wStart.getDate() - wStart.getDay() - i * 7);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 7);
      const days = new Set(
        dateSummary.filter(w => w.date >= wStart.getTime() && w.date < wEnd.getTime()).map(w => dayKey(w.date))
      ).size;
      weeklyFrequency.push(days);
    }

    return {
      workoutDates: dates,
      stats: { streak, longest, total: dateSummary.length, thisWeek, thisMonth, avgPerWeek, weeklyFrequency },
    };
  }, [dateSummary]);

  const { monthVolume, topMuscle } = useMemo(() => {
    if (!recentWorkouts || recentWorkouts.length === 0) return { monthVolume: 0, topMuscle: null };
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let vol = 0;
    const muscleCounts: Record<string, number> = {};
    for (const w of recentWorkouts) {
      for (const ex of w.exercises) {
        if (w.date >= monthStart.getTime()) {
          for (const s of ex.sets) vol += (s.weight ?? 0) * (s.reps ?? 0);
        }
        muscleCounts[ex.muscleGroup] = (muscleCounts[ex.muscleGroup] ?? 0) + ex.sets.length;
      }
    }
    const top = Object.entries(muscleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { monthVolume: vol, topMuscle: top };
  }, [recentWorkouts]);

  const maxFreq = stats ? Math.max(...stats.weeklyFrequency, 1) : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 8, marginBottom: 20 }}>
          <Text style={[typography.largeTitle, { color: colors.label }]}>History</Text>
        </View>

        {isLoading && (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {!isLoading && dateSummary?.length === 0 && (
          <View style={[styles.card, { backgroundColor: colors.backgroundSecondary, padding: 24, marginTop: 20 }]}>
            <Text style={[typography.title3, { color: colors.label, marginBottom: 8 }]}>No workouts yet</Text>
            <Text style={[typography.body, { color: colors.labelSecondary }]}>
              Complete a workout to see your heatmap, streaks, and stats here.
            </Text>
          </View>
        )}

        {!isLoading && stats && (
          <>
            {/* ── Heatmap ───────────────────────────────────────────── */}
            <View style={[styles.card, { backgroundColor: colors.backgroundSecondary, padding: 14, marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={[styles.sectionLabel, { color: colors.labelSecondary, marginBottom: 0 }]}>
                  {heatmapView === "year" ? "12 MONTHS" : `${MONTH_SHORT[viewMonth.getMonth()].toUpperCase()} ${viewMonth.getFullYear()}`}
                </Text>
                <View style={{ flexDirection: "row", backgroundColor: colors.fillSecondary, borderRadius: 8, padding: 2 }}>
                  {(["month", "year"] as const).map(v => (
                    <TouchableOpacity
                      key={v}
                      onPress={() => setHeatmapView(v)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: heatmapView === v ? colors.background : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: heatmapView === v ? colors.label : colors.labelTertiary }}>
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
                    <TouchableOpacity
                      onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      style={{ padding: 4 }}
                    >
                      <Text style={{ fontSize: 22, color: colors.labelSecondary, lineHeight: 24 }}>‹</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.label }}>
                      {MONTH_SHORT[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => !atCurrent && setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      style={{ padding: 4 }}
                    >
                      <Text style={{ fontSize: 22, color: atCurrent ? colors.labelQuaternary : colors.labelSecondary, lineHeight: 24 }}>›</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {heatmapView === "year"
                ? <CalendarHeatmap workoutDates={workoutDates} photoDates={photoDates} colors={colors} onDayPress={setSelectedPhotoDate} />
                : <MonthCalendar viewDate={viewMonth} workoutDates={workoutDates} photoDates={photoDates} colors={colors} onDayPress={setSelectedPhotoDate} />
              }
            </View>

            {/* ── Stats ──────────────────────────────────────────────── */}
            <View style={styles.statRow}>
              <StatTile value={stats.streak > 0 ? `${stats.streak} 🔥` : "—"} label="STREAK" accent colors={colors} />
              <StatTile value={`${stats.total}`} label="ALL TIME" colors={colors} />
            </View>
            <View style={styles.statRow}>
              <StatTile value={`${stats.thisWeek}`} label="THIS WEEK" colors={colors} />
              <StatTile value={`${stats.thisMonth}`} label="THIS MONTH" colors={colors} />
            </View>
            <View style={[styles.statRow, { marginBottom: 8 }]}>
              <StatTile value={stats.avgPerWeek} label="AVG / WEEK" colors={colors} />
              <StatTile value={`${stats.longest}`} label="BEST STREAK" colors={colors} />
            </View>

            {/* ── Volume + muscle ────────────────────────────────────── */}
            {(monthVolume > 0 || topMuscle) && (
              <View style={[styles.card, { backgroundColor: colors.backgroundSecondary, flexDirection: "row", marginBottom: 8, overflow: "hidden" }]}>
                {monthVolume > 0 && (
                  <View style={[styles.metaCell, { borderRightWidth: topMuscle ? StyleSheet.hairlineWidth : 0, borderRightColor: colors.separator }]}>
                    <Text style={[styles.metaValue, { color: colors.label }]}>
                      {monthVolume >= 1000 ? `${(monthVolume / 1000).toFixed(1)}t` : `${monthVolume.toLocaleString()}kg`}
                    </Text>
                    <Text style={[styles.metaLabel, { color: colors.labelTertiary }]}>VOLUME / MONTH</Text>
                  </View>
                )}
                {topMuscle && (
                  <View style={styles.metaCell}>
                    <View style={[styles.pill, { backgroundColor: (MUSCLE_BADGE_COLORS[topMuscle] ?? colors.accent) + "22" }]}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: MUSCLE_BADGE_COLORS[topMuscle] ?? colors.accent }}>
                        {(MUSCLE_DISPLAY_NAMES as any)[topMuscle] ?? topMuscle}
                      </Text>
                    </View>
                    <Text style={[styles.metaLabel, { color: colors.labelTertiary }]}>MOST TRAINED</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Frequency bar chart ────────────────────────────────── */}
            <View style={[styles.card, { backgroundColor: colors.backgroundSecondary, padding: 14, marginBottom: 8 }]}>
              <Text style={[styles.sectionLabel, { color: colors.labelSecondary }]}>DAYS / WEEK · LAST 8 WEEKS</Text>
              <View style={styles.barChart}>
                {stats.weeklyFrequency.map((days, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${(days / maxFreq) * 100}%` as any, backgroundColor: days > 0 ? colors.accent : colors.fillSecondary }]} />
                    </View>
                    <Text style={[styles.barNum, { color: colors.labelTertiary }]}>{days}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
                <Text style={{ fontSize: 9, color: colors.labelTertiary }}>8 wks ago</Text>
                <Text style={{ fontSize: 9, color: colors.labelTertiary }}>This week</Text>
              </View>
            </View>

            {/* ── Recent workouts ────────────────────────────────────── */}
            {recentWorkouts && recentWorkouts.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.labelSecondary, marginTop: 16, marginBottom: 8 }]}>
                  RECENT WORKOUTS
                </Text>
                {recentWorkouts.map(w => (
                  <WorkoutCard key={w._id} workout={w} colors={colors} typography={typography} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Photo Modal */}
      <PhotoModal
        visible={selectedPhotoDate !== null}
        dateStr={selectedPhotoDate ?? ""}
        userId={userId}
        onClose={() => setSelectedPhotoDate(null)}
        colors={colors}
        typography={typography}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: { borderRadius: 16, marginBottom: 0 },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 12 },
  statRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statTile: { flex: 1, borderRadius: 14, padding: 16, alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  metaCell: { flex: 1, paddingVertical: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  metaValue: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  metaLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  setChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14 },
  barChart: { flexDirection: "row", alignItems: "flex-end", height: 52, gap: 4 },
  barCol: { flex: 1, alignItems: "center", height: 64, justifyContent: "flex-end" },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end", marginBottom: 4 },
  barFill: { width: "100%", borderRadius: 3, minHeight: 3 },
  barNum: { fontSize: 10, fontWeight: "600" },
});
