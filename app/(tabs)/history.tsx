import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { MUSCLE_BADGE_COLORS } from "@/constants/colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Heatmap ──────────────────────────────────────────────────────────────────

const WEEKS = 26;
const DAY_LABEL_W = 18;
const CELL_GAP = 2;

function Heatmap({ workoutDates, colors }: { workoutDates: Set<string>; colors: any }) {
  const { width: screenWidth } = useWindowDimensions();

  const cellSize = Math.floor(
    (screenWidth - 32 - DAY_LABEL_W - CELL_GAP * (WEEKS + 1)) / WEEKS
  );

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Go back WEEKS*7 days, align to Sunday
    const start = new Date(today);
    start.setDate(today.getDate() - WEEKS * 7 + 1);
    start.setDate(start.getDate() - start.getDay());

    const weeks: Array<Array<{ key: string; date: Date; hasWorkout: boolean; isFuture: boolean }>> = [];
    const monthLabels: { label: string; col: number }[] = [];
    let seenMonths = new Set<string>();
    const cur = new Date(start);

    for (let w = 0; w < WEEKS; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const key = dayKey(cur.getTime());
        week.push({
          key,
          date: new Date(cur),
          hasWorkout: workoutDates.has(key),
          isFuture: cur > today,
        });
        // Month label on first day of month
        const monthKey = `${cur.getFullYear()}-${cur.getMonth()}`;
        if (cur.getDate() === 1 && !seenMonths.has(monthKey)) {
          seenMonths.add(monthKey);
          monthLabels.push({ label: MONTH_SHORT[cur.getMonth()], col: w });
        }
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return { weeks, monthLabels };
  }, [workoutDates]);

  return (
    <View>
      {/* Month labels */}
      <View style={{ height: 16, position: "relative", marginLeft: DAY_LABEL_W + CELL_GAP }}>
        {monthLabels.map((m, i) => (
          <Text
            key={i}
            style={[
              styles.monthLabel,
              {
                color: colors.labelTertiary,
                left: m.col * (cellSize + CELL_GAP),
              },
            ]}
          >
            {m.label}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={{ flexDirection: "row", gap: CELL_GAP }}>
        {/* Day labels (Mon, Wed, Fri) */}
        <View style={{ width: DAY_LABEL_W, gap: CELL_GAP }}>
          {["", "M", "", "W", "", "F", ""].map((l, i) => (
            <View key={i} style={{ height: cellSize, justifyContent: "center" }}>
              <Text style={{ fontSize: 9, color: colors.labelTertiary }}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Week columns */}
        {weeks.map((week, wi) => (
          <View key={wi} style={{ gap: CELL_GAP }}>
            {week.map((day, di) => (
              <View
                key={di}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  backgroundColor: day.isFuture
                    ? "transparent"
                    : day.hasWorkout
                    ? colors.accent
                    : colors.fillSecondary,
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={[styles.legendLabel, { color: colors.labelTertiary }]}>Less</Text>
        <View style={[styles.legendCell, { backgroundColor: colors.fillSecondary }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.accent + "66" }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.accent }]} />
        <Text style={[styles.legendLabel, { color: colors.labelTertiary }]}>More</Text>
      </View>
    </View>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  value, label, accent = false, colors, typography,
}: {
  value: string; label: string; accent?: boolean; colors: any; typography: any;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[typography.numericLarge, { color: accent ? colors.accent : colors.label, fontSize: 26, fontWeight: "800" }]}>
        {value}
      </Text>
      <Text style={[typography.caption2, { color: colors.labelSecondary, marginTop: 3, textAlign: "center" }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Workout card ─────────────────────────────────────────────────────────────

function WorkoutCard({ workout, colors, typography }: { workout: any; colors: any; typography: any }) {
  const [expanded, setExpanded] = useState(false);
  const muscles = [...new Set<string>(workout.exercises.map((e: any) => e.muscleGroup))];

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
      <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.75}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption2, { color: colors.labelTertiary, textTransform: "uppercase", letterSpacing: 0.8 }]}>
              {formatDate(workout.date)}  ·  Week {workout.weekNumber}
            </Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>
              {workout.sessionName}
            </Text>
            <View style={styles.musclePillRow}>
              {muscles.map(m => (
                <View key={m} style={[styles.musclePill, { backgroundColor: (MUSCLE_BADGE_COLORS[m] ?? "#555") + "22" }]}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: MUSCLE_BADGE_COLORS[m] ?? "#555" }}>
                    {(MUSCLE_DISPLAY_NAMES as any)[m]?.toUpperCase() ?? m}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {!!workout.durationMin && (
              <Text style={[typography.caption1, { color: colors.labelSecondary }]}>
                {workout.durationMin}m
              </Text>
            )}
            <Text style={{ color: colors.labelTertiary, fontSize: 14 }}>
              {expanded ? "▾" : "▸"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 12, gap: 10 }}>
          {workout.exercises.map((ex: any) => (
            <View key={ex.name}>
              <Text style={[typography.subheadline, { color: colors.label, marginBottom: 5 }]}>
                {ex.name}
              </Text>
              <View style={styles.chipRow}>
                {ex.sets.map((s: any, i: number) => (
                  <View key={i} style={[styles.setChip, { backgroundColor: colors.fillSecondary }]}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                      {s.weight}kg × {s.reps}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.labelTertiary, marginLeft: 4 }}>
                      RIR {s.rir}
                    </Text>
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

  const history = useQuery(
    api.workouts.getHistory,
    userId ? { userId, limit: 300 } : "skip"
  );

  const isLoading = loading || history === undefined;

  const { workoutDates, stats } = useMemo(() => {
    if (!history || history.length === 0) {
      return { workoutDates: new Set<string>(), stats: null };
    }

    // Unique workout days
    const dates = new Set<string>();
    for (const w of history) dates.add(dayKey(w.date));

    // ── Current streak (consecutive calendar days with a workout) ──────────
    let streak = 0;
    const check = new Date();
    check.setHours(0, 0, 0, 0);
    if (!dates.has(dayKey(check.getTime()))) check.setDate(check.getDate() - 1);
    while (dates.has(dayKey(check.getTime()))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }

    // ── Longest streak ────────────────────────────────────────────────────
    const sortedDays = [...dates].map(k => {
      const [y, mo, d] = k.split("-").map(Number);
      return new Date(y, mo, d).getTime();
    }).sort((a, b) => a - b);

    let longest = 0, curRun = 0;
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) { curRun = 1; }
      else {
        const diff = (sortedDays[i] - sortedDays[i - 1]) / 86400000;
        curRun = diff === 1 ? curRun + 1 : 1;
      }
      longest = Math.max(longest, curRun);
    }

    // ── This week ─────────────────────────────────────────────────────────
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = history.filter(w => w.date >= weekStart.getTime()).length;

    // ── This month ────────────────────────────────────────────────────────
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = history.filter(w => w.date >= monthStart.getTime()).length;

    // ── Avg per week (over last 12 weeks) ─────────────────────────────────
    const twelveWeeksAgo = Date.now() - 84 * 24 * 60 * 60 * 1000;
    const avgPerWeek = (history.filter(w => w.date >= twelveWeeksAgo).length / 12).toFixed(1);

    // ── Total volume (kg) this month ──────────────────────────────────────
    let monthVolume = 0;
    for (const w of history) {
      if (w.date < monthStart.getTime()) continue;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          monthVolume += (s.weight ?? 0) * (s.reps ?? 0);
        }
      }
    }

    // ── Most trained muscle ───────────────────────────────────────────────
    const muscleCounts: Record<string, number> = {};
    for (const w of history) {
      for (const ex of w.exercises) {
        muscleCounts[ex.muscleGroup] = (muscleCounts[ex.muscleGroup] ?? 0) + ex.sets.length;
      }
    }
    const topMuscle = Object.entries(muscleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // ── Unique training days per week (last 8 weeks) ──────────────────────
    const weeklyFrequency: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date();
      wStart.setDate(wStart.getDate() - wStart.getDay() - i * 7);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 7);
      const days = new Set(
        history.filter(w => w.date >= wStart.getTime() && w.date < wEnd.getTime())
               .map(w => dayKey(w.date))
      ).size;
      weeklyFrequency.push(days);
    }

    return {
      workoutDates: dates,
      stats: { streak, longest, total: history.length, thisWeek, thisMonth, avgPerWeek, monthVolume, topMuscle, weeklyFrequency },
    };
  }, [history]);

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

        {!isLoading && history?.length === 0 && (
          <View style={[styles.empty, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[typography.title3, { color: colors.label, marginBottom: 8 }]}>No workouts yet</Text>
            <Text style={[typography.body, { color: colors.labelSecondary }]}>
              Complete a workout to see your heatmap, streaks, and stats here.
            </Text>
          </View>
        )}

        {!isLoading && stats && (
          <>
            {/* ── Heatmap ─────────────────────────────────────────── */}
            <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.sectionLabel, { color: colors.labelSecondary }]}>
                LAST 6 MONTHS
              </Text>
              <Heatmap workoutDates={workoutDates} colors={colors} />
            </View>

            {/* ── Stats row 1 ──────────────────────────────────────── */}
            <View style={styles.statRow}>
              <StatTile
                value={stats.streak > 0 ? `${stats.streak}🔥` : "0"}
                label="DAY STREAK"
                accent
                colors={colors}
                typography={typography}
              />
              <StatTile value={`${stats.total}`} label="TOTAL" colors={colors} typography={typography} />
              <StatTile value={stats.avgPerWeek} label="AVG/WEEK" colors={colors} typography={typography} />
            </View>

            {/* ── Stats row 2 ──────────────────────────────────────── */}
            <View style={styles.statRow}>
              <StatTile value={`${stats.thisWeek}`} label="THIS WEEK" colors={colors} typography={typography} />
              <StatTile value={`${stats.thisMonth}`} label="THIS MONTH" colors={colors} typography={typography} />
              <StatTile value={`${stats.longest}`} label="BEST STREAK" colors={colors} typography={typography} />
            </View>

            {/* ── Volume this month ─────────────────────────────────── */}
            {stats.monthVolume > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSecondary, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>Volume this month</Text>
                <Text style={[typography.numericMedium, { color: colors.label, fontWeight: "700" }]}>
                  {stats.monthVolume >= 1000
                    ? `${(stats.monthVolume / 1000).toFixed(1)}t`
                    : `${stats.monthVolume.toLocaleString()}kg`}
                </Text>
              </View>
            )}

            {/* ── Most trained ──────────────────────────────────────── */}
            {stats.topMuscle && (
              <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSecondary, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>Most trained</Text>
                <View style={[styles.musclePill, { backgroundColor: (MUSCLE_BADGE_COLORS[stats.topMuscle] ?? colors.accent) + "22" }]}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: MUSCLE_BADGE_COLORS[stats.topMuscle] ?? colors.accent }}>
                    {(MUSCLE_DISPLAY_NAMES as any)[stats.topMuscle] ?? stats.topMuscle}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Weekly frequency bar chart ────────────────────────── */}
            <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.sectionLabel, { color: colors.labelSecondary }]}>DAYS/WEEK (LAST 8 WEEKS)</Text>
              <View style={styles.barChart}>
                {stats.weeklyFrequency.map((days, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${(days / maxFreq) * 100}%` as any,
                            backgroundColor: days > 0 ? colors.accent : colors.fillSecondary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.labelTertiary }]}>
                      {days}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ fontSize: 9, color: colors.labelTertiary }}>8 wks ago</Text>
                <Text style={{ fontSize: 9, color: colors.labelTertiary }}>This wk</Text>
              </View>
            </View>

            {/* ── Recent workouts ───────────────────────────────────── */}
            {history && history.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.labelSecondary, marginTop: 20, marginBottom: 8 }]}>
                  RECENT WORKOUTS
                </Text>
                {history.map(w => (
                  <WorkoutCard key={w._id} workout={w} colors={colors} typography={typography} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  statTile: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  empty: {
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
  },
  monthLabel: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 10,
  },
  legendLabel: {
    fontSize: 10,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  musclePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6,
  },
  musclePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  setChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 60,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: 72,
    justifyContent: "flex-end",
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  barFill: {
    width: "100%",
    borderRadius: 3,
    minHeight: 3,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
});
