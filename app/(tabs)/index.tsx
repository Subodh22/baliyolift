import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formattedDate() {
  return new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

function StatTile({ value, label, accent = false, colors }: { value: string; label: string; accent?: boolean; colors: any }) {
  return (
    <View style={[s.statTile, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
      <Text style={[s.statNum, { color: accent ? colors.accent : colors.label }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.labelTertiary }]}>{label}</Text>
    </View>
  );
}

function VolumeBar({ muscle, sets, mav, mrv, colors }: { muscle: string; sets: number; mav: number; mrv: number; colors: any }) {
  const pct = Math.min(sets / mrv, 1);
  const color = sets < mav * 0.7 ? colors.volumeLow : sets >= mrv ? colors.volumeHigh : colors.accent;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelSecondary, width: 80 }}>
        {MUSCLE_DISPLAY_NAMES[muscle as keyof typeof MUSCLE_DISPLAY_NAMES] ?? muscle}
      </Text>
      <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.fillSecondary }}>
        <View style={{ width: `${pct * 100}%`, height: 2, borderRadius: 1, backgroundColor: color }} />
      </View>
      <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelTertiary, width: 20, textAlign: "right" }}>{sets}</Text>
    </View>
  );
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const { userId, loading: userLoading } = useCurrentUser();
  const createPPL = useMutation(api.templates.createPPLTemplate);
  const createUL  = useMutation(api.templates.createUpperLowerTemplate);
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);

  const todayDate  = todayDateString();
  const todayPhoto = useQuery(api.progressPhotos.getTodayPhoto, userId ? { userId, date: todayDate } : "skip");
  const meso       = useQuery(api.mesocycles.getActiveWithDetails, userId ? { userId } : "skip");
  const volume     = useQuery(api.workouts.getWeeklyVolume, meso && userId ? { userId, mesocycleId: meso._id, weekNumber: meso.weekNumber } : "skip");
  const next       = useQuery(api.workouts.getNextSession, userId ? { userId } : "skip");

  const isLoading     = userLoading || meso === undefined || next === undefined;
  const nextSession   = next?.session ?? null;
  const isRestDay     = meso != null && next != null && (next.status === "week_complete" || next.status === "meso_complete");
  const isMesoComplete= next?.status === "meso_complete";

  const handleTemplate = async (type: "ppl" | "ul") => {
    if (!userId || templateLoading) return;
    setTemplateLoading(type);
    try {
      if (type === "ppl") await createPPL({ userId, weeks: 5 });
      else await createUL({ userId, weeks: 5 });
    } finally { setTemplateLoading(null); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(500)} style={s.header}>
          <Text style={[s.dateText, { color: colors.labelSecondary }]}>{formattedDate()}</Text>
          {/* Playfair italic hero — once per screen */}
          <Text style={[s.heroItalic, { color: colors.label }]}>
            {nextSession ? nextSession.name : meso ? (isMesoComplete ? "All done." : "Rest well.") : "Train with intention."}
          </Text>
          {meso && next && (
            <Text style={[s.heroSub, { color: colors.labelSecondary }]}>
              {meso.name} · Week {next.weekNumber}
            </Text>
          )}
        </Animated.View>

        {isLoading && (
          <View style={{ alignItems: "center", paddingTop: 48 }}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        )}

        {/* ── No meso ────────────────────────────────────────────────── */}
        {!isLoading && !meso && (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 12 }}>
            <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Choose a program</Text>

            {/* Dark card — PPL */}
            <TouchableOpacity
              style={[s.darkCard, { backgroundColor: colors.headerBg }]}
              onPress={() => handleTemplate("ppl")} activeOpacity={0.88} disabled={!!templateLoading}
            >
              <View style={[s.pill, { backgroundColor: colors.accent }]}>
                <Text style={s.pillText}>Recommended</Text>
              </View>
              <Text style={s.darkTitle}>Push / Pull / Legs</Text>
              <Text style={s.darkSub}>6 days · 5 weeks · Intermediate</Text>
              <Text style={s.darkBody}>Chest, back, shoulders, arms, quads, hamstrings — 24 exercises with RP rep ranges</Text>
              {templateLoading === "ppl" && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
            </TouchableOpacity>

            {/* Light card — UL */}
            <TouchableOpacity
              style={[s.lightCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
              onPress={() => handleTemplate("ul")} activeOpacity={0.88} disabled={!!templateLoading}
            >
              <Text style={[s.lightTitle, { color: colors.label }]}>Upper / Lower</Text>
              <Text style={[s.lightSub, { color: colors.labelSecondary }]}>4 days · 5 weeks · Beginner–Intermediate</Text>
              <Text style={[s.lightBody, { color: colors.labelTertiary }]}>Full coverage, less frequency — great for a busy schedule</Text>
              {templateLoading === "ul" && <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/meso/new")} style={s.ghostBtn} activeOpacity={0.7}>
              <Text style={{ fontFamily: "Inter_300Light", fontSize: 14, color: colors.labelSecondary }}>
                Build custom mesocycle →
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Rest / Complete ─────────────────────────────────────────── */}
        {!isLoading && meso && isRestDay && (
          <>
            <Animated.View entering={FadeInDown.springify()} style={[s.lightCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
              <Text style={[s.lightTitle, { color: colors.label }]}>
                {isMesoComplete ? "Mesocycle complete" : "Week complete"}
              </Text>
              <Text style={[s.lightBody, { color: colors.labelSecondary, marginTop: 8 }]}>
                {isMesoComplete
                  ? "You finished all weeks. Start a new mesocycle when ready."
                  : `Week ${next!.weekNumber + 1} of ${next!.mesoWeeks} starts next.`}
              </Text>
            </Animated.View>

            {!isMesoComplete && (next as any)?.upcomingSessions?.length > 0 && (() => {
              const upcoming = (next as any).upcomingSessions as { _id: string; name: string; order: number; muscleGroups: string[] }[];
              const nextWeek = next!.weekNumber + 1;
              return (
                <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginTop: 28 }}>
                  <View style={s.rowBetween}>
                    <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Week {nextWeek}</Text>
                    <TouchableOpacity
                      onPress={() => router.push(`/workout/new?sessionId=${upcoming[0]._id}&week=${nextWeek}`)}
                      style={[s.pill, { backgroundColor: colors.accent }]} activeOpacity={0.8}
                    >
                      <Text style={s.pillText}>Start now</Text>
                    </TouchableOpacity>
                  </View>
                  {upcoming.map((sess, i) => (
                    <Animated.View key={sess._id} entering={FadeInDown.delay(100 + i * 40).springify()}
                      style={[s.upcomingRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
                    >
                      <View style={[s.upcomingNum, { backgroundColor: colors.fillSecondary }]}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.labelSecondary }}>{sess.order + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.label }}>{sess.name}</Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelSecondary, marginTop: 2 }}>
                          {sess.muscleGroups.map(mg => MUSCLE_DISPLAY_NAMES[mg as keyof typeof MUSCLE_DISPLAY_NAMES] ?? mg).join(" · ")}
                        </Text>
                      </View>
                    </Animated.View>
                  ))}
                </Animated.View>
              );
            })()}
          </>
        )}

        {/* ── Today's session ─────────────────────────────────────────── */}
        {!isLoading && meso && nextSession && (
          <>
            {/* Dark hero card */}
            <Animated.View entering={FadeInDown.delay(60).springify()} style={[s.darkCard, { backgroundColor: colors.headerBg }]}>
              <Text style={s.darkLabel}>Today's session</Text>
              <Text style={s.darkTitle}>{nextSession.name}</Text>
              <Text style={s.darkSub}>
                {nextSession.muscleGroups.map(mg => MUSCLE_DISPLAY_NAMES[mg as keyof typeof MUSCLE_DISPLAY_NAMES] ?? mg).join(" · ")}
              </Text>

              {/* Meta + CTA row */}
              <View style={s.metaRow}>
                <View style={s.metaItem}>
                  <Text style={s.metaNum}>{nextSession.muscleGroups.length}</Text>
                  <Text style={s.metaUnit}>Muscles</Text>
                </View>
                <View style={s.metaDivider} />
                <View style={s.metaItem}>
                  <Text style={s.metaNum}>{next?.weekNumber ?? 1}</Text>
                  <Text style={s.metaUnit}>Week</Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (next?.status === "in_progress" && next.workoutId) router.push(`/workout/${next.workoutId}`);
                    else router.push(`/workout/new?sessionId=${nextSession._id}`);
                  }}
                  style={s.startBtn} activeOpacity={0.88}
                >
                  <Text style={s.startBtnText}>{next?.status === "in_progress" ? "Resume" : "Start"}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(160)} style={{ alignItems: "center", marginTop: 12 }}>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.labelTertiary }}>Skip this session</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Stat tiles */}
            {next && (
              <Animated.View entering={FadeInDown.delay(100).springify()} style={[s.statRow, { marginTop: 24 }]}>
                <StatTile value={`${next.weekNumber}`} label="Week" colors={colors} />
                <StatTile value={`${nextSession.muscleGroups.length}`} label="Muscles" colors={colors} />
                <StatTile value={next.status === "in_progress" ? "On" : "Up"} label={next.status === "in_progress" ? "going" : "next"} accent colors={colors} />
              </Animated.View>
            )}

            {/* Volume */}
            {volume && volume.length > 0 && (
              <Animated.View entering={FadeInDown.delay(140).springify()}
                style={[s.lightCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator, marginTop: 24 }]}
              >
                <View style={s.rowBetween}>
                  <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Weekly volume</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {[{ c: colors.volumeLow, l: "< MAV" }, { c: colors.accent, l: "MAV" }, { c: colors.volumeHigh, l: "MRV" }].map(({ c, l }) => (
                      <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 6, height: 2, borderRadius: 1, backgroundColor: c }} />
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 10, color: colors.labelTertiary }}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ marginTop: 16 }}>
                  {volume.map(v => (
                    <VolumeBar key={v.muscleGroup} muscle={v.muscleGroup} sets={v.sets} mav={v.target} mrv={v.mrv} colors={colors} />
                  ))}
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* ── Progress photo ──────────────────────────────────────────── */}
        {!isLoading && userId && (
          <Animated.View entering={FadeInDown.delay(180).springify()}
            style={[s.lightCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator, marginTop: 24 }]}
          >
            <View style={s.rowBetween}>
              <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Progress photo</Text>
              {todayPhoto && <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.accentGreen }}>Done today</Text>}
            </View>
            {todayPhoto?.imageUrl ? (
              <Image source={{ uri: todayPhoto.imageUrl }}
                style={{ width: "100%", height: 220, borderRadius: 16, marginTop: 14 }} resizeMode="cover" />
            ) : (
              <TouchableOpacity onPress={() => router.push("/camera")} activeOpacity={0.85}
                style={[s.photoPlaceholder, { borderColor: colors.separator }]}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: colors.label }}>Take today's photo</Text>
                <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.labelSecondary, marginTop: 4 }}>
                  Timer · one per day · saved to cloud
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:     { paddingHorizontal: 20, paddingBottom: 100 },
  header:     { marginTop: 16, marginBottom: 32 },
  dateText:   { fontFamily: "Inter_300Light", fontSize: 13, letterSpacing: 0.1 },
  heroItalic: { fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 34, fontWeight: "400", letterSpacing: -0.3, lineHeight: 42, marginTop: 8 },
  heroSub:    { fontFamily: "Inter_300Light", fontSize: 14, marginTop: 6 },

  sectionLabel: { fontFamily: "Inter_400Regular", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  rowBetween:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  // Dark card
  darkCard:  { borderRadius: 20, padding: 24, marginBottom: 0 },
  darkLabel: { fontFamily: "Inter_300Light", fontSize: 11, color: "#777", letterSpacing: 1.4, textTransform: "uppercase" },
  darkTitle: { fontFamily: "Inter_500Medium", fontSize: 24, color: "#FFFFFF", letterSpacing: -0.3, marginTop: 10, lineHeight: 30 },
  darkSub:   { fontFamily: "Inter_300Light", fontSize: 13, color: "#888", marginTop: 6, lineHeight: 20 },
  darkBody:  { fontFamily: "Inter_300Light", fontSize: 13, color: "#888", marginTop: 8, lineHeight: 20 },
  metaRow:   { flexDirection: "row", alignItems: "center", marginTop: 24, gap: 0 },
  metaItem:  { alignItems: "center", paddingHorizontal: 16 },
  metaNum:   { fontFamily: "Inter_600SemiBold", fontSize: 22, color: "#FFFFFF", letterSpacing: -0.5 },
  metaUnit:  { fontFamily: "Inter_300Light", fontSize: 11, color: "#666", marginTop: 2 },
  metaDivider:{ width: 1, height: 28, backgroundColor: "#3A3A3A" },
  startBtn:  { marginLeft: "auto", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, backgroundColor: "#FFFFFF" },
  startBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#2C2C2A" },

  // Light card
  lightCard:  { borderRadius: 20, padding: 20, borderWidth: 1 },
  lightTitle: { fontFamily: "Inter_500Medium", fontSize: 17, letterSpacing: -0.2 },
  lightSub:   { fontFamily: "Inter_300Light", fontSize: 13, marginTop: 4 },
  lightBody:  { fontFamily: "Inter_300Light", fontSize: 13, marginTop: 6, lineHeight: 20 },

  // Pill
  pill:     { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  pillText: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#FFFFFF", letterSpacing: 0.2 },

  ghostBtn: { alignItems: "center", paddingVertical: 20 },

  // Stat tiles
  statRow:   { flexDirection: "row", gap: 8 },
  statTile:  { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1, alignItems: "center" },
  statNum:   { fontFamily: "Inter_600SemiBold", fontSize: 22, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_300Light", fontSize: 11, marginTop: 4, letterSpacing: 0.3, textTransform: "uppercase" },

  // Upcoming
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1 },
  upcomingNum: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  // Photo
  photoPlaceholder: { height: 140, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginTop: 14 },
});
