import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function bfCategory(sex: "male" | "female", bf: number): { label: string; color: string } {
  if (sex === "male") {
    if (bf < 6)  return { label: "Essential", color: "#5AC8FA" };
    if (bf < 14) return { label: "Athletic",  color: "#2D5A3D" };
    if (bf < 18) return { label: "Fitness",   color: "#C87820" };
    if (bf < 25) return { label: "Average",   color: "#C87820" };
    return { label: "Obese", color: "#B83030" };
  } else {
    if (bf < 14) return { label: "Essential", color: "#5AC8FA" };
    if (bf < 21) return { label: "Athletic",  color: "#2D5A3D" };
    if (bf < 25) return { label: "Fitness",   color: "#C87820" };
    if (bf < 32) return { label: "Average",   color: "#C87820" };
    return { label: "Obese", color: "#B83030" };
  }
}

function estimateMonths(current: number, target: number, weekly: number): string {
  if (current <= target) return "Goal reached";
  const weeks = (current - target) / (weekly * 0.125);
  const months = Math.ceil(weeks / 4.3);
  return months <= 1 ? "~1 month" : `~${months} months`;
}

function BfZoneBar({ sex, current, target, colors }: any) {
  const minBf = sex === "male" ? 3 : 10;
  const maxBf = 40;
  const range = maxBf - minBf;
  const currentPct = Math.min(Math.max((current - minBf) / range, 0), 1);
  const targetPct  = Math.min(Math.max((target  - minBf) / range, 0), 1);
  const zones = sex === "male"
    ? [{ end: 6, c: "#5AC8FA" }, { end: 14, c: "#2D5A3D" }, { end: 18, c: "#C8BE50" }, { end: 25, c: "#C87820" }, { end: 40, c: "#B83030" }]
    : [{ end: 14, c: "#5AC8FA" }, { end: 21, c: "#2D5A3D" }, { end: 25, c: "#C8BE50" }, { end: 32, c: "#C87820" }, { end: 40, c: "#B83030" }];
  const cat = bfCategory(sex, current);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 48, color: cat.color, letterSpacing: -2 }}>{current}%</Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: cat.color + "20" }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: cat.color, letterSpacing: 0.5 }}>{cat.label}</Text>
        </View>
      </View>

      {/* Zone bar — 2px */}
      <View style={{ height: 2, borderRadius: 1, flexDirection: "row", overflow: "hidden", marginBottom: 24 }}>
        {zones.map((z, i) => {
          const start = i === 0 ? minBf : zones[i - 1].end;
          return <View key={i} style={{ flex: (z.end - start) / range, backgroundColor: z.c, opacity: 0.7 }} />;
        })}
      </View>

      {/* Markers */}
      <View style={{ position: "relative", height: 24, marginBottom: 8 }}>
        <View style={{ position: "absolute", left: `${currentPct * 88}%` as any, alignItems: "center" }}>
          <View style={{ width: 1, height: 8, backgroundColor: colors.label }} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.label, marginTop: 2 }}>Now</Text>
        </View>
        <View style={{ position: "absolute", left: `${targetPct * 88}%` as any, alignItems: "center" }}>
          <View style={{ width: 1, height: 8, backgroundColor: colors.accent }} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.accent, marginTop: 2 }}>Goal</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <View>
          <Text style={{ fontFamily: "Inter_300Light", fontSize: 11, color: colors.labelSecondary }}>Now</Text>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.label }}>{current}%</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Inter_300Light", fontSize: 11, color: colors.labelSecondary }}>Goal</Text>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.accent }}>{target}%</Text>
        </View>
      </View>
    </View>
  );
}

function E1RMChart({ points, colors }: any) {
  const chartH = 72;
  const max = Math.max(...points.map((p: any) => p.e1rm));
  const min = Math.min(...points.map((p: any) => p.e1rm));
  const range = max - min || 1;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartH, gap: 4 }}>
        {points.map((p: any, i: number) => {
          const h = (0.2 + ((p.e1rm - min) / range) * 0.8) * chartH;
          const isLast = i === points.length - 1;
          return (
            <View key={i} style={{ flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
              <View style={{ width: "100%", height: h, backgroundColor: isLast ? colors.accent : colors.fillSecondary, borderRadius: 3 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 6, gap: 4 }}>
        {points.map((p: any, i: number) => (
          <Text key={i} style={{ fontFamily: "Inter_300Light", fontSize: 10, color: colors.labelTertiary, flex: 1, textAlign: "center" }}>
            W{p.weekNumber ?? i + 1}
          </Text>
        ))}
      </View>
    </View>
  );
}

function formatVol(v: number): string {
  if (v >= 1000) return `${(Math.round(v / 100) / 10)}k`;
  return String(Math.round(v));
}

function StatGroup({ stats }: { stats: { label: string; value: string; accent?: boolean }[]; colors: any }) { return null; }

export default function ProgressScreen() {
  const { colors } = useTheme();
  const { userId } = useCurrentUser();

  const profile     = useQuery(api.userProfile.getByUser, userId ? { userId } : "skip");
  const weeklyCount = useQuery(api.userProfile.getWeeklyWorkouts, userId ? { userId } : "skip");
  const dashboard   = useQuery(api.progress.getDashboard, userId ? { userId } : "skip");
  const isLoading   = profile === undefined || dashboard === undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={[s.screenLabel, { color: colors.labelSecondary }]}>Your journey</Text>
          <Text style={[s.heroItalic, { color: colors.label }]}>Progress over time.</Text>
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {!isLoading && (
          <>
            {/* Body fat */}
            {profile && (
              <Animated.View entering={FadeInDown.springify()}
                style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
              >
                <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Body fat journey</Text>
                <View style={{ marginTop: 20 }}>
                  <BfZoneBar sex={profile.sex} current={profile.currentBf} target={profile.targetBf} colors={colors} />
                </View>
                <View style={[s.divRow, { borderTopColor: colors.separator }]}>
                  <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.labelSecondary }}>Estimated time to goal</Text>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.accent }}>
                    {estimateMonths(profile.currentBf, profile.targetBf, profile.weeklyGoal)}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Weekly pace */}
            {profile && weeklyCount !== undefined && (
              <Animated.View entering={FadeInDown.delay(60).springify()}
                style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>This week</Text>
                  <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelSecondary }}>
                    {weeklyCount}/{profile.weeklyGoal} sessions
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
                  {Array.from({ length: profile.weeklyGoal }).map((_, i) => (
                    <View key={i} style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: i < weeklyCount ? colors.accent : colors.fillSecondary }} />
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Strength chart */}
            {dashboard && (
              <Animated.View entering={FadeInDown.delay(120).springify()}
                style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: colors.label }} numberOfLines={1}>
                    {dashboard.chart.exerciseName}
                  </Text>
                  <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelSecondary }}>est. 1RM (kg)</Text>
                </View>

                {dashboard.chart.points.length > 1 ? (
                  <>
                    <View style={{ marginTop: 16 }}>
                      <E1RMChart points={dashboard.chart.points} colors={colors} />
                    </View>
                    {(() => {
                      const pts = dashboard.chart.points;
                      const gain = pts[pts.length - 1].e1rm - pts[0].e1rm;
                      const last = pts[pts.length - 1];
                      return (
                        <View style={[s.statRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: colors.separator }]}>
                          {[
                            { v: `${gain >= 0 ? "+" : ""}${gain}`, l: "kg 1RM gain", color: gain >= 0 ? colors.accentGreen : colors.accentRed },
                            { v: String(last.e1rm), l: "est. 1RM", color: colors.label },
                            { v: String(last.weight), l: "top set kg", color: colors.accent },
                          ].map(({ v, l, color }) => (
                            <View key={l} style={s.statItem}>
                              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 22, color, letterSpacing: -0.5 }}>{v}</Text>
                              <Text style={{ fontFamily: "Inter_300Light", fontSize: 11, color: colors.labelSecondary, marginTop: 3 }}>{l}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  <Text style={{ fontFamily: "Inter_300Light", fontSize: 14, color: colors.labelSecondary, marginTop: 12 }}>
                    Complete more sessions to see your strength chart.
                  </Text>
                )}
              </Animated.View>
            )}

            {/* PRs */}
            {dashboard && dashboard.prs.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginTop: 28 }}>
                <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Personal records</Text>
                <View style={{ gap: 8, marginTop: 12 }}>
                  {dashboard.prs.map((pr) => (
                    <View key={pr.exerciseId}
                      style={[s.prCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.label }} numberOfLines={1}>{pr.name}</Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelSecondary, marginTop: 2 }}>
                          {pr.weight} kg × {pr.reps} reps
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 20, color: colors.accent, letterSpacing: -0.5 }}>{pr.e1rm}</Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 10, color: colors.labelTertiary, marginTop: 2 }}>est. 1RM</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Summary stats */}
            {dashboard && (
              <>
                <Animated.View entering={FadeInDown.delay(240).springify()}
                  style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator, marginTop: 28 }]}
                >
                  <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>All time</Text>
                  <View style={[s.statRow, { marginTop: 16 }]}>
                    {[
                      { v: String(dashboard.summary.totalWorkouts), l: "workouts" },
                      { v: String(dashboard.summary.totalSets), l: "sets" },
                      { v: formatVol(dashboard.summary.totalVolume), l: "kg volume" },
                    ].map(({ v, l }) => (
                      <View key={l} style={s.statItem}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 22, color: colors.label, letterSpacing: -0.5 }}>{v}</Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 11, color: colors.labelSecondary, marginTop: 3 }}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>

                {dashboard.summary.mesoWorkouts > 0 && (
                  <Animated.View entering={FadeInDown.delay(280).springify()}
                    style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
                  >
                    <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>This mesocycle</Text>
                    <View style={[s.statRow, { marginTop: 16 }]}>
                      {[
                        { v: String(dashboard.summary.mesoWorkouts), l: "workouts" },
                        { v: String(dashboard.summary.mesoSets), l: "sets" },
                        { v: formatVol(dashboard.summary.mesoVolume), l: "kg volume" },
                      ].map(({ v, l }, i) => (
                        <View key={l} style={s.statItem}>
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 22, color: i === 2 ? colors.accent : colors.label, letterSpacing: -0.5 }}>{v}</Text>
                          <Text style={{ fontFamily: "Inter_300Light", fontSize: 11, color: colors.labelSecondary, marginTop: 3 }}>{l}</Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {!dashboard && !profile && (
              <Animated.View entering={FadeInDown.springify()}
                style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 17, color: colors.label }}>No data yet</Text>
                <Text style={{ fontFamily: "Inter_300Light", fontSize: 14, color: colors.labelSecondary, marginTop: 8, lineHeight: 22 }}>
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

const s = StyleSheet.create({
  scroll:      { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  header:      { marginTop: 16, marginBottom: 32 },
  screenLabel: { fontFamily: "Inter_300Light", fontSize: 13, letterSpacing: 0.1 },
  heroItalic:  { fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 34, fontWeight: "400", letterSpacing: -0.3, lineHeight: 42, marginTop: 6 },
  sectionLabel:{ fontFamily: "Inter_400Regular", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  card:        { borderRadius: 20, padding: 20, borderWidth: 1 },
  divRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTopWidth: 0.5 },
  statRow:     { flexDirection: "row", justifyContent: "space-around" },
  statItem:    { alignItems: "center" },
  prCard:      { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, borderWidth: 1 },
});
