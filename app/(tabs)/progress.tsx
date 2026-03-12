import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── BF Category helper ───────────────────────────────────────────────────────
function bfCategory(sex: "male" | "female", bf: number): { label: string; color: string } {
  if (sex === "male") {
    if (bf < 6) return { label: "Essential", color: "#5AC8FA" };
    if (bf < 14) return { label: "Athletic", color: "#34C759" };
    if (bf < 18) return { label: "Fitness", color: "#FFD60A" };
    if (bf < 25) return { label: "Average", color: "#FF9F0A" };
    return { label: "Obese", color: "#FF3B30" };
  } else {
    if (bf < 14) return { label: "Essential", color: "#5AC8FA" };
    if (bf < 21) return { label: "Athletic", color: "#34C759" };
    if (bf < 25) return { label: "Fitness", color: "#FFD60A" };
    if (bf < 32) return { label: "Average", color: "#FF9F0A" };
    return { label: "Obese", color: "#FF3B30" };
  }
}

function estimateMonths(currentBf: number, targetBf: number, weeklyGoal: number): string {
  if (currentBf <= targetBf) return "Goal reached!";
  const weeksPerPercent = 1 / (weeklyGoal * 0.125);
  const weeks = (currentBf - targetBf) * weeksPerPercent;
  const months = Math.ceil(weeks / 4.3);
  if (months <= 1) return "~1 month";
  return `~${months} months`;
}

// ── BF Zone Bar ──────────────────────────────────────────────────────────────
function BfZoneBar({ sex, current, target, colors, typography }: any) {
  const minBf = sex === "male" ? 3 : 10;
  const maxBf = 40;
  const range = maxBf - minBf;
  const currentPct = Math.min(Math.max((current - minBf) / range, 0), 1);
  const targetPct = Math.min(Math.max((target - minBf) / range, 0), 1);

  const zones = sex === "male"
    ? [
        { end: 6, color: "#5AC8FA" },
        { end: 14, color: "#34C759" },
        { end: 18, color: "#FFD60A" },
        { end: 25, color: "#FF9F0A" },
        { end: 40, color: "#FF3B30" },
      ]
    : [
        { end: 14, color: "#5AC8FA" },
        { end: 21, color: "#34C759" },
        { end: 25, color: "#FFD60A" },
        { end: 32, color: "#FF9F0A" },
        { end: 40, color: "#FF3B30" },
      ];

  const cat = bfCategory(sex, current);

  return (
    <View>
      {/* Big BF number */}
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 20 }}>
        <Text style={{ fontSize: 52, fontWeight: "800", color: cat.color }}>{current}%</Text>
        <View style={{ paddingBottom: 4 }}>
          <View style={[{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: cat.color + "22" }]}>
            <Text style={[typography.caption1, { color: cat.color, fontWeight: "700" }]}>{cat.label}</Text>
          </View>
        </View>
      </View>

      {/* Zone bar */}
      <View style={{ height: 10, borderRadius: 5, flexDirection: "row", overflow: "hidden", marginBottom: 20 }}>
        {zones.map((z, i) => {
          const start = i === 0 ? minBf : zones[i - 1].end;
          return (
            <View key={i} style={{ flex: (z.end - start) / range, backgroundColor: z.color, opacity: 0.8 }} />
          );
        })}
      </View>

      {/* Marker labels row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <View style={{ alignItems: "flex-start", left: `${currentPct * 85}%` as any, position: "absolute" }}>
          <View style={{ width: 2, height: 10, backgroundColor: colors.label, borderRadius: 1 }} />
          <Text style={[typography.caption2, { color: colors.label, fontWeight: "700", marginTop: 2 }]}>Now</Text>
        </View>
        <View style={{ alignItems: "flex-start", left: `${targetPct * 85}%` as any, position: "absolute" }}>
          <View style={{ width: 2, height: 10, backgroundColor: colors.accent, borderRadius: 1 }} />
          <Text style={[typography.caption2, { color: colors.accent, fontWeight: "700", marginTop: 2 }]}>Goal</Text>
        </View>
      </View>

      <View style={{ height: 28 }} />

      {/* From / To */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={[typography.caption1, { color: colors.labelSecondary }]}>Now</Text>
          <Text style={[typography.headline, { color: colors.label, fontWeight: "700" }]}>{current}%</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[typography.caption1, { color: colors.labelSecondary }]}>Goal</Text>
          <Text style={[typography.headline, { color: colors.accent, fontWeight: "700" }]}>{target}%</Text>
        </View>
      </View>
    </View>
  );
}

// ── Weekly dots ──────────────────────────────────────────────────────────────
function WeeklyPace({ done, goal, colors, typography }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
        {Array.from({ length: goal }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: i < done ? colors.accentGreen : colors.fillSecondary,
            }}
          />
        ))}
      </View>
      <Text style={[typography.caption1, { color: colors.labelSecondary }]}>
        {done}/{goal} this week
      </Text>
    </View>
  );
}

// ── Strength chart ───────────────────────────────────────────────────────────
function E1RMChart({ points, colors, typography }: any) {
  const chartHeight = 80;
  const max = Math.max(...points.map((p: any) => p.e1rm));
  const min = Math.min(...points.map((p: any) => p.e1rm));
  const range = max - min || 1;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartHeight, gap: 6 }}>
        {points.map((p: any, i: number) => {
          const heightPct = 0.2 + ((p.e1rm - min) / range) * 0.8;
          const isLast = i === points.length - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
              <View
                style={{
                  width: "100%",
                  height: chartHeight * heightPct,
                  backgroundColor: isLast ? colors.accent : colors.fillPrimary,
                  borderRadius: 4,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 8, gap: 6 }}>
        {points.map((p: any, i: number) => (
          <Text key={i} style={[typography.caption2, { color: colors.labelTertiary, flex: 1, textAlign: "center" }]}>
            {`W${p.weekNumber || i + 1}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

function formatVolume(v: number): string {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v));
}

export default function ProgressScreen() {
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();

  const profile = useQuery(api.userProfile.getByUser, userId ? { userId } : "skip");
  const weeklyCount = useQuery(api.userProfile.getWeeklyWorkouts, userId ? { userId } : "skip");
  const dashboard = useQuery(api.progress.getDashboard, userId ? { userId } : "skip");

  const isLoading = profile === undefined || dashboard === undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 8, marginBottom: 24 }}>
          <Text style={[typography.largeTitle, { color: colors.label }]}>Progress</Text>
        </View>

        {isLoading && (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {!isLoading && (
          <>
            {/* ── Goal Campaign Card ── */}
            {profile && (
              <Animated.View
                entering={FadeInDown.springify()}
                style={[styles.card, { backgroundColor: colors.backgroundSecondary, marginBottom: 12 }]}
              >
                <Text style={[typography.footnote, { color: colors.labelSecondary, marginBottom: 16, letterSpacing: 0.5 }]}>
                  BODY FAT JOURNEY
                </Text>
                <BfZoneBar
                  sex={profile.sex}
                  current={profile.currentBf}
                  target={profile.targetBf}
                  colors={colors}
                  typography={typography}
                />
                <View style={[styles.timeRow, { borderTopColor: colors.separator }]}>
                  <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>Estimated time</Text>
                  <Text style={[typography.headline, { color: colors.accent, fontWeight: "700" }]}>
                    {estimateMonths(profile.currentBf, profile.targetBf, profile.weeklyGoal)}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* ── Weekly Pace ── */}
            {profile && weeklyCount !== undefined && (
              <Animated.View
                entering={FadeInDown.delay(60).springify()}
                style={[styles.card, { backgroundColor: colors.backgroundSecondary, marginBottom: 12 }]}
              >
                <Text style={[typography.headline, { color: colors.label, marginBottom: 14 }]}>This Week</Text>
                <WeeklyPace
                  done={weeklyCount}
                  goal={profile.weeklyGoal}
                  colors={colors}
                  typography={typography}
                />
              </Animated.View>
            )}

            {/* ── Strength chart ── */}
            {dashboard && (
              <Animated.View
                entering={FadeInDown.delay(120).springify()}
                style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                    {dashboard.chart.exerciseName}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.labelSecondary }]}>est. 1RM (kg)</Text>
                </View>

                {dashboard.chart.points.length > 1 ? (
                  <>
                    <E1RMChart points={dashboard.chart.points} colors={colors} typography={typography} />
                    {(() => {
                      const pts = dashboard.chart.points;
                      const first = pts[0];
                      const last = pts[pts.length - 1];
                      const gain = last.e1rm - first.e1rm;
                      return (
                        <View style={[styles.statRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: colors.separator }]}>
                          <View style={styles.stat}>
                            <Text style={[typography.numericMedium, { color: gain >= 0 ? colors.accentGreen : "#FF3B30" }]}>
                              {gain >= 0 ? "+" : ""}{gain}
                            </Text>
                            <Text style={[typography.caption2, { color: colors.labelSecondary }]}>kg 1RM gain</Text>
                          </View>
                          <View style={styles.stat}>
                            <Text style={[typography.numericMedium, { color: colors.label }]}>{last.e1rm}</Text>
                            <Text style={[typography.caption2, { color: colors.labelSecondary }]}>est. 1RM</Text>
                          </View>
                          <View style={styles.stat}>
                            <Text style={[typography.numericMedium, { color: colors.accent }]}>{last.weight}</Text>
                            <Text style={[typography.caption2, { color: colors.labelSecondary }]}>top set kg</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  <Text style={[typography.body, { color: colors.labelSecondary }]}>
                    Complete more sessions to see your strength chart.
                  </Text>
                )}
              </Animated.View>
            )}

            {/* ── PRs ── */}
            {dashboard && dashboard.prs.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).springify()}>
                <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 28, marginBottom: 12 }]}>
                  PERSONAL RECORDS
                </Text>
                {dashboard.prs.map((pr) => (
                  <View key={pr.exerciseId} style={[prStyles.card, { backgroundColor: colors.backgroundSecondary }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>{pr.name}</Text>
                      <Text style={[typography.caption1, { color: colors.labelSecondary, marginTop: 2 }]}>
                        {pr.weight} kg × {pr.reps} reps
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[typography.numericMedium, { color: colors.accent }]}>{pr.e1rm}</Text>
                      <Text style={[typography.caption2, { color: colors.labelTertiary }]}>est. 1RM</Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            )}

            {/* ── Summary Stats ── */}
            {dashboard && (
              <>
                <Animated.View
                  entering={FadeInDown.delay(240).springify()}
                  style={[styles.card, { backgroundColor: colors.backgroundSecondary, marginTop: 16 }]}
                >
                  <Text style={[typography.headline, { color: colors.label, marginBottom: 16 }]}>All Time</Text>
                  <View style={styles.statRow}>
                    <View style={styles.stat}>
                      <Text style={[typography.numericMedium, { color: colors.label }]}>{dashboard.summary.totalWorkouts}</Text>
                      <Text style={[typography.caption2, { color: colors.labelSecondary }]}>workouts</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={[typography.numericMedium, { color: colors.label }]}>{dashboard.summary.totalSets}</Text>
                      <Text style={[typography.caption2, { color: colors.labelSecondary }]}>sets</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={[typography.numericMedium, { color: colors.label }]}>{formatVolume(dashboard.summary.totalVolume)}</Text>
                      <Text style={[typography.caption2, { color: colors.labelSecondary }]}>kg volume</Text>
                    </View>
                  </View>
                </Animated.View>

                {dashboard.summary.mesoWorkouts > 0 && (
                  <Animated.View
                    entering={FadeInDown.delay(280).springify()}
                    style={[styles.card, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                  >
                    <Text style={[typography.headline, { color: colors.label, marginBottom: 16 }]}>This Mesocycle</Text>
                    <View style={styles.statRow}>
                      <View style={styles.stat}>
                        <Text style={[typography.numericMedium, { color: colors.label }]}>{dashboard.summary.mesoWorkouts}</Text>
                        <Text style={[typography.caption2, { color: colors.labelSecondary }]}>workouts</Text>
                      </View>
                      <View style={styles.stat}>
                        <Text style={[typography.numericMedium, { color: colors.label }]}>{dashboard.summary.mesoSets}</Text>
                        <Text style={[typography.caption2, { color: colors.labelSecondary }]}>sets</Text>
                      </View>
                      <View style={styles.stat}>
                        <Text style={[typography.numericMedium, { color: colors.accent }]}>{formatVolume(dashboard.summary.mesoVolume)}</Text>
                        <Text style={[typography.caption2, { color: colors.labelSecondary }]}>kg volume</Text>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {/* Empty state */}
            {!dashboard && !profile && (
              <Animated.View
                entering={FadeInDown.springify()}
                style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
              >
                <Text style={[typography.title3, { color: colors.label, marginBottom: 8 }]}>No data yet</Text>
                <Text style={[typography.body, { color: colors.labelSecondary }]}>
                  Complete your first workout to see strength progress and personal records here.
                </Text>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const prStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
});

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 20 },
  statRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 4 },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
  },
});
