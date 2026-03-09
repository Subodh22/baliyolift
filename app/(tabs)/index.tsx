import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function VolumeBar({
  muscle,
  sets,
  mav,
  mrv,
  colors,
  typography,
}: {
  muscle: string;
  sets: number;
  mav: number;
  mrv: number;
  colors: any;
  typography: any;
}) {
  const pct = Math.min(sets / mrv, 1);
  const color =
    sets < mav * 0.7
      ? colors.volumeLow
      : sets >= mrv
      ? colors.volumeHigh
      : colors.accent;

  return (
    <View style={volumeStyles.row}>
      <Text style={[typography.caption1, { color: colors.labelSecondary, width: 80 }]}>
        {MUSCLE_DISPLAY_NAMES[muscle as keyof typeof MUSCLE_DISPLAY_NAMES] ?? muscle}
      </Text>
      <View style={[volumeStyles.track, { backgroundColor: colors.fillSecondary }]}>
        <View
          style={[volumeStyles.fill, { width: `${pct * 100}%`, backgroundColor: color }]}
        />
        <View
          style={[
            volumeStyles.marker,
            { left: `${(mav / mrv) * 100}%`, backgroundColor: colors.labelTertiary },
          ]}
        />
      </View>
      <Text style={[typography.caption1, { color: colors.labelSecondary, width: 28, textAlign: "right" }]}>
        {sets}
      </Text>
    </View>
  );
}

const volumeStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  marker: { position: "absolute", top: -2, width: 2, height: 10, borderRadius: 1 },
});

export default function TodayScreen() {
  const { colors, typography } = useTheme();
  const { userId, loading: userLoading } = useCurrentUser();
  const createPPL = useMutation(api.templates.createPPLTemplate);
  const createUL = useMutation(api.templates.createUpperLowerTemplate);
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);

  const handleTemplate = async (type: "ppl" | "ul") => {
    if (!userId || templateLoading) return;
    setTemplateLoading(type);
    try {
      if (type === "ppl") await createPPL({ userId, weeks: 5 });
      else await createUL({ userId, weeks: 5 });
    } finally {
      setTemplateLoading(null);
    }
  };

  const meso = useQuery(
    api.mesocycles.getActiveWithDetails,
    userId ? { userId } : "skip"
  );

  const volume = useQuery(
    api.workouts.getWeeklyVolume,
    meso && userId
      ? { userId, mesocycleId: meso._id, weekNumber: meso.weekNumber }
      : "skip"
  );

  // Single source of truth: what's next in the meso cycle
  const next = useQuery(
    api.workouts.getNextSession,
    userId ? { userId } : "skip"
  );

  const isLoading = userLoading || meso === undefined || next === undefined;

  const nextSession = next?.session ?? null;
  const isRestDay = meso != null && next != null && (next.status === "week_complete" || next.status === "meso_complete");
  const isMesoComplete = next?.status === "meso_complete";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* RP-style header */}
        <Animated.View entering={FadeIn.duration(400)} style={{ marginTop: 8, marginBottom: 24 }}>
          {meso && next ? (
            <>
              <Text style={[typography.caption2, { color: colors.labelTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }]}>
                {meso.name}
              </Text>
              <Text style={[typography.largeTitle, { color: colors.label, fontWeight: "800" }]}>
                WEEK {next.weekNumber} · {nextSession ? `DAY ${nextSession.order + 1}` : isMesoComplete ? "COMPLETE" : "REST"}
              </Text>
            </>
          ) : (
            <>
              <Text style={[typography.footnote, { color: colors.labelSecondary, letterSpacing: 0.5, textTransform: "uppercase" }]}>
                {getDayGreeting()}
              </Text>
              <Text style={[typography.largeTitle, { color: colors.label, fontWeight: "800", marginTop: 4 }]}>
                Today
              </Text>
            </>
          )}
        </Animated.View>

        {/* Loading */}
        {isLoading && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {/* No active mesocycle — template picker */}
        {!isLoading && !meso && (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 12 }}>
            <Text style={[typography.title3, { color: colors.label, marginBottom: 4 }]}>
              Start with a template
            </Text>
            <Text style={[typography.body, { color: colors.labelSecondary, marginBottom: 8 }]}>
              Pick a proven RP-style program. Exercises, rep ranges and volume targets are all pre-loaded.
            </Text>

            {/* PPL Template */}
            <TouchableOpacity
              style={[styles.templateCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.accent, borderWidth: 1.5 }]}
              onPress={() => handleTemplate("ppl")}
              activeOpacity={0.85}
              disabled={!!templateLoading}
            >
              <View style={[styles.templateBadge, { backgroundColor: colors.accent }]}>
                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>RECOMMENDED</Text>
              </View>
              <Text style={[typography.headline, { color: colors.label, marginTop: 8 }]}>
                Push / Pull / Legs
              </Text>
              <Text style={[typography.subheadline, { color: colors.labelSecondary, marginTop: 2 }]}>
                6 days/week · 5 weeks · Intermediate
              </Text>
              <Text style={[typography.caption1, { color: colors.labelTertiary, marginTop: 6, lineHeight: 18 }]}>
                Chest, back, shoulders, arms, quads, hamstrings, glutes, calves — 24 exercises with RP rep ranges
              </Text>
              {templateLoading === "ppl" && (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
              )}
            </TouchableOpacity>

            {/* Upper/Lower Template */}
            <TouchableOpacity
              style={[styles.templateCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator, borderWidth: 1 }]}
              onPress={() => handleTemplate("ul")}
              activeOpacity={0.85}
              disabled={!!templateLoading}
            >
              <Text style={[typography.headline, { color: colors.label }]}>
                Upper / Lower
              </Text>
              <Text style={[typography.subheadline, { color: colors.labelSecondary, marginTop: 2 }]}>
                4 days/week · 5 weeks · Beginner–Intermediate
              </Text>
              <Text style={[typography.caption1, { color: colors.labelTertiary, marginTop: 6, lineHeight: 18 }]}>
                Full body coverage, less frequency — great if you have a busy schedule
              </Text>
              {templateLoading === "ul" && (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
              )}
            </TouchableOpacity>

            {/* Custom */}
            <TouchableOpacity
              onPress={() => router.push("/meso/new")}
              style={{ alignItems: "center", paddingVertical: 16 }}
              activeOpacity={0.7}
            >
              <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>
                Build custom mesocycle →
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Rest / week complete / meso complete */}
        {!isLoading && meso && isRestDay && (
          <>
            <Animated.View
              entering={FadeInDown.springify()}
              style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
            >
              <Text style={[typography.title3, { color: colors.label, marginBottom: 6 }]}>
                {isMesoComplete ? "Mesocycle Complete 🎉" : "Week Complete"}
              </Text>
              <Text style={[typography.body, { color: colors.labelSecondary }]}>
                {isMesoComplete
                  ? "You finished all weeks. Start a new mesocycle when ready."
                  : `Week ${next!.weekNumber + 1} of ${next!.mesoWeeks} starts next.`}
              </Text>
            </Animated.View>

            {/* Next week session preview */}
            {!isMesoComplete && (next as any)?.upcomingSessions?.length > 0 && (() => {
              const upcoming = (next as any).upcomingSessions as { _id: string; name: string; order: number; muscleGroups: string[] }[];
              const nextWeek = next!.weekNumber + 1;
              return (
                <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginTop: 20 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Text style={[typography.footnote, { color: colors.labelSecondary, letterSpacing: 0.8, textTransform: "uppercase" }]}>
                      Week {nextWeek} — Coming Up
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push(`/workout/new?sessionId=${upcoming[0]._id}&week=${nextWeek}`)}
                      activeOpacity={0.7}
                      style={[styles.startWeekBtn, { backgroundColor: colors.accent }]}
                    >
                      <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>
                        Start Week {nextWeek} Now
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {upcoming.map((s, i) => (
                    <Animated.View
                      key={s._id}
                      entering={FadeInDown.delay(100 + i * 40).springify()}
                      style={[styles.upcomingRow, { backgroundColor: colors.backgroundSecondary }]}
                    >
                      <View style={[styles.upcomingNum, { backgroundColor: colors.fillSecondary }]}>
                        <Text style={[typography.caption1, { color: colors.labelSecondary, fontWeight: "700" }]}>
                          {s.order + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.body, { color: colors.label, fontWeight: "600" }]}>{s.name}</Text>
                        <Text style={[typography.caption1, { color: colors.labelSecondary, marginTop: 2 }]}>
                          {s.muscleGroups.map((mg) => MUSCLE_DISPLAY_NAMES[mg as keyof typeof MUSCLE_DISPLAY_NAMES] ?? mg).join(" · ")}
                        </Text>
                      </View>
                      {i === 0 && (
                        <TouchableOpacity
                          onPress={() => router.push(`/workout/new?sessionId=${s._id}&week=${nextWeek}`)}
                          activeOpacity={0.7}
                        >
                          <Text style={[typography.caption1, { color: colors.accent, fontWeight: "700" }]}>START →</Text>
                        </TouchableOpacity>
                      )}
                    </Animated.View>
                  ))}
                </Animated.View>
              );
            })()}
          </>
        )}

        {/* Next session card */}
        {!isLoading && meso && nextSession && (
          <>
            <Animated.View
              entering={FadeInDown.delay(80).springify()}
              style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
            >
              <View style={styles.cardHeader}>
                <Text style={[typography.title3, { color: colors.label }]}>
                  {nextSession.name}
                </Text>
                {next?.status === "in_progress" ? (
                  <View style={[styles.badge, { backgroundColor: colors.accent + "22" }]}>
                    <Text style={[typography.caption2, { color: colors.accent, fontWeight: "700" }]}>IN PROGRESS</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: colors.accentGreen + "22" }]}>
                    <Text style={[typography.caption2, { color: colors.accentGreen, fontWeight: "700" }]}>UP NEXT</Text>
                  </View>
                )}
              </View>

              {/* Muscle groups preview */}
              <View style={{ gap: 10, marginBottom: 20 }}>
                {nextSession.muscleGroups.map((mg) => (
                  <View key={mg} style={styles.exerciseRow}>
                    <View style={[styles.exDot, { backgroundColor: colors.accent }]} />
                    <Text style={[typography.body, { color: colors.labelSecondary, flex: 1 }]}>
                      {MUSCLE_DISPLAY_NAMES[mg as keyof typeof MUSCLE_DISPLAY_NAMES] ?? mg}
                    </Text>
                  </View>
                ))}
              </View>

              <Button
                label={next?.status === "in_progress" ? "Resume Workout" : "Start Workout"}
                onPress={() => {
                  if (next?.status === "in_progress" && next.workoutId) {
                    router.push(`/workout/${next.workoutId}`);
                  } else {
                    router.push(`/workout/new?sessionId=${nextSession._id}`);
                  }
                }}
              />
            </Animated.View>

            {/* Skip option */}
            <Animated.View entering={FadeIn.delay(200)} style={{ alignItems: "center", marginTop: 16 }}>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>
                  Skip this session
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Weekly volume */}
            {volume && volume.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(160).springify()}
                style={[styles.card, { backgroundColor: colors.backgroundSecondary, marginTop: 24 }]}
              >
                <Text style={[typography.headline, { color: colors.label, marginBottom: 16 }]}>
                  Weekly Volume
                </Text>
                {volume.map((v) => (
                  <VolumeBar
                    key={v.muscleGroup}
                    muscle={v.muscleGroup}
                    sets={v.sets}
                    mav={v.target}
                    mrv={v.mrv}
                    colors={colors}
                    typography={typography}
                  />
                ))}
                <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                  {[
                    { color: colors.volumeLow, label: "< MAV" },
                    { color: colors.accent, label: "In MAV" },
                    { color: colors.volumeHigh, label: "≥ MRV" },
                  ].map(({ color, label }) => (
                    <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                      <Text style={[typography.caption2, { color: colors.labelSecondary }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
  },
  templateCard: {
    borderRadius: 16,
    padding: 16,
  },
  templateBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  upcomingNum: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  startWeekBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
