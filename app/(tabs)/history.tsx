import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { MUSCLE_BADGE_COLORS } from "@/constants/colors";

const INDICATOR_LABEL: Record<string, { symbol: string; color: string }> = {
  increase:  { symbol: "↑", color: "#26A870" },
  decrease:  { symbol: "↓", color: "#CC2020" },
  add_rep:   { symbol: "+1", color: "#4A90D9" },
  maintain:  { symbol: "→", color: "#888" },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function SetChip({ set, colors }: { set: any; colors: any }) {
  const ind = set.overloadIndicator ? INDICATOR_LABEL[set.overloadIndicator] : null;
  return (
    <View style={[chipStyles.row, { backgroundColor: colors.fillSecondary }]}>
      <Text style={[chipStyles.num, { color: colors.label }]}>
        {set.weight}kg × {set.reps}
      </Text>
      <Text style={[chipStyles.rir, { color: colors.labelTertiary }]}>RIR {set.rir}</Text>
      {ind && (
        <Text style={[chipStyles.ind, { color: ind.color }]}>{ind.symbol}</Text>
      )}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6, marginBottom: 4 },
  num: { fontSize: 13, fontWeight: "600" },
  rir: { fontSize: 11 },
  ind: { fontSize: 12, fontWeight: "800" },
});

function WorkoutCard({ workout, colors, typography }: { workout: any; colors: any; typography: any }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.75}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption2, { color: colors.labelTertiary, letterSpacing: 0.8, textTransform: "uppercase" }]}>
              {formatDate(workout.date)} · Wk {workout.weekNumber}
            </Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>
              {workout.sessionName}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {workout.durationMin && (
              <Text style={[typography.caption1, { color: colors.labelSecondary }]}>
                {workout.durationMin} min
              </Text>
            )}
            <Text style={{ color: colors.labelTertiary, fontSize: 14 }}>{expanded ? "▾" : "▸"}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 12, gap: 12 }}>
          {workout.exercises.map((ex: any) => {
            const badgeColor = MUSCLE_BADGE_COLORS[ex.muscleGroup] ?? "#555";
            return (
              <View key={ex.name}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <View style={[styles.exBadge, { backgroundColor: badgeColor + "22" }]}>
                    <Text style={{ color: badgeColor, fontSize: 11, fontWeight: "700" }}>
                      {(MUSCLE_DISPLAY_NAMES as any)[ex.muscleGroup]?.toUpperCase() ?? ex.muscleGroup}
                    </Text>
                  </View>
                  <Text style={[typography.subheadline, { color: colors.label, flex: 1 }]}>{ex.name}</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {ex.sets.map((s: any, i: number) => (
                    <SetChip key={i} set={s} colors={colors} />
                  ))}
                </View>
                {/* Overload summary for this exercise */}
                {ex.sets.length > 0 && (() => {
                  const lastSet = ex.sets[ex.sets.length - 1];
                  const ind = lastSet.overloadIndicator ? INDICATOR_LABEL[lastSet.overloadIndicator] : null;
                  if (!ind || lastSet.overloadIndicator === "maintain") return null;
                  return (
                    <Text style={{ color: ind.color, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                      {ind.symbol} {lastSet.overloadIndicator === "increase" ? "Weight increased" : lastSet.overloadIndicator === "decrease" ? "Weight reduced" : "+1 rep next session"}
                    </Text>
                  );
                })()}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { colors, typography } = useTheme();
  const { userId, loading } = useCurrentUser();

  const history = useQuery(
    api.workouts.getHistory,
    userId ? { userId } : "skip"
  );

  const isLoading = loading || history === undefined;

  // Group by date string
  const grouped: { label: string; workouts: any[] }[] = [];
  if (history) {
    const map = new Map<string, any[]>();
    for (const w of history) {
      const label = formatDate(w.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(w);
    }
    for (const [label, workouts] of map) {
      grouped.push({ label, workouts });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
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
              Complete a workout to see your history and overload tracking here.
            </Text>
          </View>
        )}

        {!isLoading && grouped.map(({ label, workouts }) => (
          <View key={label}>
            <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }]}>
              {label}
            </Text>
            {workouts.map((w) => (
              <WorkoutCard key={w._id} workout={w} colors={colors} typography={typography} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 8,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  exBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  empty: {
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
  },
});
