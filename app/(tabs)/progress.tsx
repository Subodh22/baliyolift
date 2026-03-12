import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import { router } from "expo-router";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// BF zone colors — biological zones, not design system tokens
const BF_ESSENTIAL = "#5AC8FA";
const BF_ATHLETIC  = P.green;
const BF_FITNESS   = "#C8A840";
const BF_AVERAGE   = "#C87820";
const BF_OBESE     = P.red;

function bfCategory(sex: "male" | "female", bf: number): { label: string; color: string } {
  if (sex === "male") {
    if (bf < 6)  return { label: "Essential", color: BF_ESSENTIAL };
    if (bf < 14) return { label: "Athletic",  color: BF_ATHLETIC };
    if (bf < 18) return { label: "Fitness",   color: BF_FITNESS };
    if (bf < 25) return { label: "Average",   color: BF_AVERAGE };
    return { label: "Obese", color: BF_OBESE };
  } else {
    if (bf < 14) return { label: "Essential", color: BF_ESSENTIAL };
    if (bf < 21) return { label: "Athletic",  color: BF_ATHLETIC };
    if (bf < 25) return { label: "Fitness",   color: BF_FITNESS };
    if (bf < 32) return { label: "Average",   color: BF_AVERAGE };
    return { label: "Obese", color: BF_OBESE };
  }
}

function estimateMonths(current: number, target: number, weekly: number): string {
  if (current <= target) return "Goal reached";
  const weeks = (current - target) / (weekly * 0.125);
  const months = Math.ceil(weeks / 4.3);
  return months <= 1 ? "~1 month" : `~${months} months`;
}

function BfZoneBar({ sex, current, target }: { sex: "male" | "female"; current: number; target: number }) {
  const minBf = sex === "male" ? 3 : 10;
  const maxBf = 40;
  const range = maxBf - minBf;
  const currentPct = Math.min(Math.max((current - minBf) / range, 0), 1);
  const targetPct  = Math.min(Math.max((target  - minBf) / range, 0), 1);
  const zones = sex === "male"
    ? [{ end: 6, c: BF_ESSENTIAL }, { end: 14, c: BF_ATHLETIC }, { end: 18, c: BF_FITNESS }, { end: 25, c: BF_AVERAGE }, { end: 40, c: BF_OBESE }]
    : [{ end: 14, c: BF_ESSENTIAL }, { end: 21, c: BF_ATHLETIC }, { end: 25, c: BF_FITNESS }, { end: 32, c: BF_AVERAGE }, { end: 40, c: BF_OBESE }];
  const cat = bfCategory(sex, current);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <Text style={{ fontFamily: CG, fontSize: 52, color: cat.color, letterSpacing: -1 }}>{current}%</Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: cat.color + "40" }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 11, color: cat.color, letterSpacing: 2, textTransform: "uppercase" }}>{cat.label}</Text>
        </View>
      </View>
      <View style={{ height: 1, flexDirection: "row", overflow: "hidden", marginBottom: 24 }}>
        {zones.map((z, i) => {
          const start = i === 0 ? minBf : zones[i - 1].end;
          return <View key={i} style={{ flex: (z.end - start) / range, backgroundColor: z.c, opacity: 0.7 }} />;
        })}
      </View>
      <View style={{ position: "relative", height: 24, marginBottom: 8 }}>
        <View style={{ position: "absolute", left: `${currentPct * 88}%` as any, alignItems: "center" }}>
          <View style={{ width: 1, height: 8, backgroundColor: P.ink }} />
          <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.ink, marginTop: 2 }}>Now</Text>
        </View>
        <View style={{ position: "absolute", left: `${targetPct * 88}%` as any, alignItems: "center" }}>
          <View style={{ width: 1, height: 8, backgroundColor: P.gold }} />
          <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.gold, marginTop: 2 }}>Goal</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <View>
          <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid }}>Now</Text>
          <Text style={{ fontFamily: CG, fontSize: 18, color: P.ink }}>{current}%</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid }}>Goal</Text>
          <Text style={{ fontFamily: CG, fontSize: 18, color: P.gold }}>{target}%</Text>
        </View>
      </View>
    </View>
  );
}

function E1RMChart({ points }: { points: any[] }) {
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
              <View style={{ width: "100%", height: h, backgroundColor: isLast ? P.gold : P.s2 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 6, gap: 4 }}>
        {points.map((p: any, i: number) => (
          <Text key={i} style={{ fontFamily: OUT_L, fontSize: 10, color: P.dim, flex: 1, textAlign: "center" }}>
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

export default function ProgressScreen() {
  const { userId } = useCurrentUser();
  const profile     = useQuery(api.userProfile.getByUser, userId ? { userId } : "skip");
  const weeklyCount = useQuery(api.userProfile.getWeeklyWorkouts, userId ? { userId } : "skip");
  const dashboard   = useQuery(api.progress.getDashboard, userId ? { userId } : "skip");
  const todayPhoto  = useQuery(api.progressPhotos.getTodayPhoto, userId ? { userId, date: todayStr() } : "skip");
  const isLoading   = profile === undefined || dashboard === undefined;
  const hasPhotoToday = !!todayPhoto;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={s.eyebrow}>YOUR JOURNEY</Text>
              <Text style={s.heroItalic}>Progress.</Text>
            </View>
            <TouchableOpacity
              onPress={() => !hasPhotoToday && router.push("/camera")}
              hitSlop={12}
              style={{ paddingTop: 4, alignItems: "flex-end", opacity: hasPhotoToday ? 0.35 : 1 }}
              disabled={hasPhotoToday}
            >
              <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: hasPhotoToday ? P.mid : P.gold }}>
                {hasPhotoToday ? "✓ LOGGED" : "⊕ CHECK IN"}
              </Text>
              <Text style={{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 1, color: P.mid, marginTop: 3 }}>
                {hasPhotoToday ? "come back tomorrow" : "log today's pic"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && <ActivityIndicator color={P.gold} style={{ marginTop: 40 }} />}

        {!isLoading && (
          <>
            {profile && (
              <Animated.View entering={FadeInDown.springify()} style={s.card}>
                <Text style={s.sectionLabel}>BODY FAT JOURNEY</Text>
                <View style={{ marginTop: 20 }}>
                  <BfZoneBar sex={profile.sex} current={profile.currentBf} target={profile.targetBf} />
                </View>
                <View style={[s.divRow, { borderTopColor: P.border }]}>
                  <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid }}>Estimated time to goal</Text>
                  <Text style={{ fontFamily: OUT_L, fontSize: 14, color: P.gold }}>
                    {estimateMonths(profile.currentBf, profile.targetBf, profile.weeklyGoal)}
                  </Text>
                </View>
              </Animated.View>
            )}

            {profile && weeklyCount !== undefined && (
              <Animated.View entering={FadeInDown.delay(60).springify()} style={s.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={s.sectionLabel}>THIS WEEK</Text>
                  <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid }}>
                    {weeklyCount}/{profile.weeklyGoal} sessions
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
                  {Array.from({ length: profile.weeklyGoal }).map((_, i) => (
                    <View key={i} style={{ flex: 1, height: 1, backgroundColor: i < weeklyCount ? P.gold : P.border }} />
                  ))}
                </View>
              </Animated.View>
            )}

            {dashboard && (
              <Animated.View entering={FadeInDown.delay(120).springify()} style={s.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: OUT, fontSize: 15, color: P.ink }} numberOfLines={1}>
                    {dashboard.chart.exerciseName}
                  </Text>
                  <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid }}>est. 1RM (kg)</Text>
                </View>
                {dashboard.chart.points.length > 1 ? (
                  <>
                    <View style={{ marginTop: 16 }}>
                      <E1RMChart points={dashboard.chart.points} />
                    </View>
                    {(() => {
                      const pts = dashboard.chart.points;
                      const gain = pts[pts.length - 1].e1rm - pts[0].e1rm;
                      const last = pts[pts.length - 1];
                      return (
                        <View style={[s.statRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: P.border }]}>
                          {[
                            { v: `${gain >= 0 ? "+" : ""}${gain}`, l: "kg 1RM gain", color: gain >= 0 ? P.green : P.red },
                            { v: String(last.e1rm), l: "est. 1RM", color: P.ink },
                            { v: String(last.weight), l: "top set kg", color: P.gold },
                          ].map(({ v, l, color }) => (
                            <View key={l} style={s.statItem}>
                              <Text style={{ fontFamily: CG, fontSize: 22, color, letterSpacing: -0.5 }}>{v}</Text>
                              <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid, marginTop: 3 }}>{l}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  <Text style={{ fontFamily: OUT_L, fontSize: 14, color: P.mid, marginTop: 12 }}>
                    Complete more sessions to see your strength chart.
                  </Text>
                )}
              </Animated.View>
            )}

            {dashboard && dashboard.prs.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginTop: 28 }}>
                <Text style={s.sectionLabel}>PERSONAL RECORDS</Text>
                <View style={{ gap: 8, marginTop: 12 }}>
                  {dashboard.prs.map((pr) => (
                    <View key={pr.exerciseId} style={s.prCard}>
                      <View style={s.prStripe} />
                      <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 14 }}>
                        <Text style={{ fontFamily: CG_ITALIC, fontSize: 20, color: P.ink }} numberOfLines={1}>{pr.name}</Text>
                        <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid, marginTop: 2 }}>
                          {pr.weight} kg × {pr.reps} reps
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", paddingRight: 16, paddingVertical: 14 }}>
                        <Text style={{ fontFamily: CG, fontSize: 24, color: P.gold, letterSpacing: -0.5 }}>{pr.e1rm}</Text>
                        <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid, marginTop: 2 }}>EST 1RM</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {dashboard && (
              <>
                <Animated.View entering={FadeInDown.delay(240).springify()} style={[s.card, { marginTop: 28 }]}>
                  <Text style={s.sectionLabel}>ALL TIME</Text>
                  <View style={[s.statRow, { marginTop: 16 }]}>
                    {[
                      { v: String(dashboard.summary.totalWorkouts), l: "workouts" },
                      { v: String(dashboard.summary.totalSets), l: "sets" },
                      { v: formatVol(dashboard.summary.totalVolume), l: "kg volume" },
                    ].map(({ v, l }) => (
                      <View key={l} style={s.statItem}>
                        <Text style={{ fontFamily: CG, fontSize: 22, color: P.ink, letterSpacing: -0.5 }}>{v}</Text>
                        <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid, marginTop: 3 }}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>

                {dashboard.summary.mesoWorkouts > 0 && (
                  <Animated.View entering={FadeInDown.delay(280).springify()} style={s.card}>
                    <Text style={s.sectionLabel}>THIS MESOCYCLE</Text>
                    <View style={[s.statRow, { marginTop: 16 }]}>
                      {[
                        { v: String(dashboard.summary.mesoWorkouts), l: "workouts" },
                        { v: String(dashboard.summary.mesoSets), l: "sets" },
                        { v: formatVol(dashboard.summary.mesoVolume), l: "kg volume" },
                      ].map(({ v, l }, i) => (
                        <View key={l} style={s.statItem}>
                          <Text style={{ fontFamily: CG, fontSize: 22, color: i === 2 ? P.gold : P.ink, letterSpacing: -0.5 }}>{v}</Text>
                          <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid, marginTop: 3 }}>{l}</Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {!dashboard && !profile && (
              <Animated.View entering={FadeInDown.springify()} style={s.card}>
                <Text style={{ fontFamily: CG_ITALIC, fontSize: 28, color: P.ink }}>No data yet.</Text>
                <Text style={{ fontFamily: OUT_L, fontSize: 14, color: P.mid, marginTop: 8, lineHeight: 22 }}>
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
  scroll:      { paddingHorizontal: 24, paddingBottom: 100, gap: 12 },
  header:      { marginTop: 16, marginBottom: 32 },
  eyebrow:     { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:  { fontFamily: CG_ITALIC, fontSize: 52, letterSpacing: -0.5, lineHeight: 58, marginTop: 10, color: P.ink },
  sectionLabel:{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, textTransform: "uppercase" },
  card:        { backgroundColor: P.s1, padding: 20, borderWidth: 1, borderColor: P.border },
  divRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  statRow:     { flexDirection: "row", justifyContent: "space-around" },
  statItem:    { alignItems: "center" },
  prCard:      { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: P.border, backgroundColor: P.s1 },
  prStripe:    { width: 3, alignSelf: "stretch", backgroundColor: P.gold },
});
