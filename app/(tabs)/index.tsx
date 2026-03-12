import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, Dimensions, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import Svg, { Path, Line, Text as SvgText, Circle } from "react-native-svg";
import Animated, {
  useSharedValue, withTiming, Easing, useAnimatedProps, FadeIn,
} from "react-native-reanimated";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";

const { width: W } = Dimensions.get("window");
const AnimatedPath = Animated.createAnimatedComponent(Path);

const DAY_SHORT = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const DAY_WORDS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function greetLabel() {
  const h = new Date().getHours();
  return h < 12 ? "GOOD MORNING" : h < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
}

// ── Hairline divider ──────────────────────────────────────────────────────────
function Line1() {
  return <View style={{ height: 1, backgroundColor: P.border }} />;
}

// ── Volume arc (semicircle, gold fill animates on load) ───────────────────────
function VolumeArc({ progress }: { progress: number }) {
  const PAD = 24;
  const arcW = W - PAD * 2;
  const R = arcW / 2 - 8;
  const cx = arcW / 2;
  const cy = R + 20;
  const arcLen = Math.PI * R;

  // Semicircle path: M left A ... right (top half, clockwise)
  const trackPath = `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy}`;
  const filled = useSharedValue(0);

  useEffect(() => {
    filled.value = withTiming(progress, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${filled.value * arcLen} ${arcLen}`,
  }));

  // Tick positions: 0=left, 50=top, 100=right
  const tickAngle = (pct: number) => {
    // angle in degrees: 180 at left, 90 at top, 0 at right
    const deg = 180 - pct * 180;
    const rad = (deg * Math.PI) / 180;
    return {
      x1: cx + R * Math.cos(rad),
      y1: cy - R * Math.sin(rad),
      x2: cx + (R - 10) * Math.cos(rad),
      y2: cy - (R - 10) * Math.sin(rad),
      lx: cx + (R + 16) * Math.cos(rad),
      ly: cy - (R + 16) * Math.sin(rad),
    };
  };
  const top = tickAngle(0.5);

  const svgH = cy + 20;

  return (
    <View style={{ marginTop: 20 }}>
      <Svg width={arcW} height={svgH} style={{ overflow: "visible" }}>
        {/* Track */}
        <Path d={trackPath} stroke={P.border} strokeWidth={1} fill="none" />
        {/* Gold fill — animated */}
        <AnimatedPath
          animatedProps={animatedProps}
          d={trackPath}
          stroke={P.gold}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="butt"
        />
        {/* Tick at 50% — top */}
        <Line
          x1={top.x1} y1={top.y1} x2={top.x2} y2={top.y2}
          stroke={P.border} strokeWidth={1}
        />
        <SvgText
          x={top.lx} y={top.ly + 4} textAnchor="middle"
          fontSize={9} fontFamily={OUT_L} fill={P.dim} letterSpacing={1}
        >
          50
        </SvgText>
      </Svg>
    </View>
  );
}

// ── Week tile ─────────────────────────────────────────────────────────────────
function WeekTile({ label, value, state }: {
  label: string;
  value: string;
  state: "done" | "today" | "rest" | "future";
}) {
  const bg = state === "today" ? P.gold : state === "done" ? P.goldDim : "transparent";
  const borderColor = state === "today" ? P.gold : state === "done" ? P.gold : P.border;
  const textColor = state === "today" ? P.bg : state === "done" ? P.gold : P.dim;
  const labelColor = state === "today" ? P.bg : P.dim;
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <Text style={{ fontFamily: OUT_L, fontSize: 8, letterSpacing: 1.5, color: P.dim }}>
        {label}
      </Text>
      <View style={[s.weekTile, { backgroundColor: bg, borderColor }]}>
        <Text style={{ fontFamily: CG, fontSize: 18, color: textColor, lineHeight: 22 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ── Stat cell (in 2×2 grid) ───────────────────────────────────────────────────
function StatCell({ num, unit, label }: { num: string; unit: string; label: string }) {
  return (
    <View style={s.statCell}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 0 }}>
        <Text style={{ fontFamily: CG, fontSize: 40, color: P.ink, letterSpacing: -0.5, lineHeight: 46 }}>
          {num}
        </Text>
        <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.gold, marginBottom: 6 }}>
          {unit}
        </Text>
      </View>
      <Text style={{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.mid, textTransform: "uppercase", marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { userId, loading: userLoading } = useCurrentUser();
  const createPPL = useMutation(api.templates.createPPLTemplate);
  const createUL  = useMutation(api.templates.createUpperLowerTemplate);
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);

  const meso        = useQuery(api.mesocycles.getActiveWithDetails, userId ? { userId } : "skip");
  const volume      = useQuery(api.workouts.getWeeklyVolume, meso && userId ? { userId, mesocycleId: meso._id, weekNumber: meso.weekNumber } : "skip");
  const next        = useQuery(api.workouts.getNextSession, userId ? { userId } : "skip");
  const workoutDates = useQuery(api.workouts.getWorkoutDates, userId ? { userId } : "skip");

  const isLoading   = userLoading || meso === undefined || next === undefined;
  const nextSession = next?.session ?? null;
  const weekNum     = next?.weekNumber ?? meso?.weekNumber ?? 1;
  const dayWord     = DAY_WORDS[new Date().getDay()];
  const today       = new Date().getDay(); // 0=Sun, 1=Mon...
  const todayMon    = today === 0 ? 6 : today - 1; // Mon=0...Sun=6

  // Days this Mon–Sun that have a completed workout (Mon=0...Sun=6)
  const completedDays = useMemo(() => {
    if (!workoutDates) return new Set<number>();
    const now = new Date();
    const monOffset = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - monOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const set = new Set<number>();
    for (const w of workoutDates) {
      const d = new Date(w.date);
      if (d >= monday && d <= sunday) {
        const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
        set.add(dow);
      }
    }
    return set;
  }, [workoutDates]);

  const volumePct = useMemo(() => {
    if (!volume || volume.length === 0) return 0;
    const done   = volume.reduce((a, v) => a + v.sets, 0);
    const target = volume.reduce((a, v) => a + v.target, 0);
    return target > 0 ? done / target : 0;
  }, [volume]);

  const totalVolKg = useMemo(() => {
    if (!volume) return 0;
    return volume.reduce((a, v) => a + v.sets * 12 * 60, 0); // rough estimate
  }, [volume]);

  const sessionDays = useMemo(() => {
    if (!meso?.sessions) return new Set<number>();
    return new Set(meso.sessions.map((s: any) => {
      const dow = s.dayOfWeek; // 0=Sun
      return dow === 0 ? 6 : dow - 1; // convert to Mon=0
    }));
  }, [meso]);

  const handleTemplate = async (type: "ppl" | "ul") => {
    if (!userId || templateLoading) return;
    setTemplateLoading(type);
    try {
      if (type === "ppl") await createPPL({ userId, weeks: 5 });
      else await createUL({ userId, weeks: 5 });
    } finally { setTemplateLoading(null); }
  };

  const pctDisplay = Math.round(volumePct * 100);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Status bar ──────────────────────────────────────────────── */}
        <View style={s.statusBar}>
          <Text style={s.statusTime}>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
          <Text style={s.brandText}>B A L I Y O</Text>
          <Text style={s.statusIcon}>◎</Text>
        </View>
        <Line1 />

        {/* ── Greeting ────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.eyebrow}>{greetLabel()}</Text>
          <View style={{ marginTop: 10 }}>
            <Text style={s.heroRoman}>Week {weekNum},{"\n"}</Text>
            <Text style={s.heroItalic}>{dayWord}.</Text>
          </View>
          <Text style={s.heroSub}>
            {new Date().toLocaleDateString("en-AU", { weekday: "long" })}
            {next ? ` · ${next.weekNumber ?? 1} week in` : ""}
            {" · Body is ready"}
          </Text>
        </View>
        <Line1 />

        {/* ── Today's session ─────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>TODAY'S SESSION</Text>

          {!isLoading && !meso && (
            <View style={{ marginTop: 20, gap: 10 }}>
              <Pressable
                style={({ pressed }) => [s.ghostBtn, { opacity: pressed ? 0.7 : 1, borderColor: P.gold }]}
                onPress={() => handleTemplate("ppl")}
              >
                <Text style={[s.ghostBtnText, { color: P.gold }]}>START PUSH / PULL / LEGS →</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.ghostBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => handleTemplate("ul")}
              >
                <Text style={s.ghostBtnText}>START UPPER / LOWER →</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/meso/new")}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingTop: 4 })}
              >
                <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid, letterSpacing: 2 }}>
                  BUILD CUSTOM →
                </Text>
              </Pressable>
            </View>
          )}

          {!isLoading && nextSession && (
            <View style={[s.sessionCard]}>
              {/* 3px gold left stripe */}
              <View style={s.goldStripe} />
              <View style={{ flex: 1 }}>
                <Text style={s.sessionName}>{nextSession.name}</Text>
                <Text style={s.sessionMeta}>
                  {nextSession.muscleGroups.map((mg: string) =>
                    MUSCLE_DISPLAY_NAMES[mg as keyof typeof MUSCLE_DISPLAY_NAMES] ?? mg
                  ).join(" · ")}
                  {" · ~52 min"}
                </Text>
                {/* Stats + Begin row */}
                <View style={s.sessionFooter}>
                  <View style={{ flex: 1, flexDirection: "row", gap: 28 }}>
                    <View>
                      <Text style={s.sessionStat}>{nextSession.muscleGroups.length}</Text>
                      <Text style={s.sessionStatLabel}>MOVES</Text>
                    </View>
                    <View>
                      <Text style={s.sessionStat}>{nextSession.muscleGroups.length * 4}</Text>
                      <Text style={s.sessionStatLabel}>SETS</Text>
                    </View>
                    <View>
                      <Text style={s.sessionStat}>{weekNum}</Text>
                      <Text style={s.sessionStatLabel}>STREAK</Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [s.beginBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => {
                      if (next?.status === "in_progress" && next.workoutId) router.push(`/workout/${next.workoutId}`);
                      else router.push(`/workout/new?sessionId=${nextSession._id}`);
                    }}
                  >
                    <Text style={s.beginBtnText}>{next?.status === "in_progress" ? "RESUME" : "BEGIN"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {!isLoading && meso && !nextSession && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontFamily: CG_ITALIC, fontSize: 28, color: P.ink }}>Rest day.</Text>
              <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid, marginTop: 8 }}>
                Recovery is progress. Next session soon.
              </Text>
            </View>
          )}
        </View>
        <Line1 />

        {/* ── This week ────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>THIS WEEK</Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 16 }}>
            {DAY_SHORT.map((d, i) => {
              const isDone   = completedDays.has(i) && i < todayMon;
              const isToday  = i === todayMon;
              const isFuture = i > todayMon && sessionDays.has(i);
              const state = isDone ? "done" : isToday ? "today" : isFuture ? "future" : "rest";
              const val   = isDone ? "✓" : isToday ? String(new Date().getDate()) : isFuture ? String(new Date().getDate() + (i - todayMon)) : "—";
              return <WeekTile key={d} label={d} value={val} state={state} />;
            })}
          </View>
        </View>

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: P.bg },
  scroll:      { paddingBottom: 20 },

  // Status bar
  statusBar:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14 },
  statusTime:  { fontFamily: OUT_L, fontSize: 12, color: P.mid, letterSpacing: 0.5, width: 50 },
  brandText:   { fontFamily: CG, fontSize: 13, color: P.ink, letterSpacing: 8 },
  statusIcon:  { fontFamily: OUT_L, fontSize: 16, color: P.mid, width: 50, textAlign: "right" },

  // Sections
  section:     { paddingHorizontal: 24, paddingVertical: 28 },
  sectionLabel:{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, textTransform: "uppercase" },
  eyebrow:     { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },

  // Hero
  heroRoman:   { fontFamily: CG, fontSize: 52, color: P.ink, letterSpacing: -0.5, lineHeight: 58 },
  heroItalic:  { fontFamily: CG_ITALIC, fontSize: 52, color: P.ink, letterSpacing: -0.5, lineHeight: 58 },
  heroSub:     { fontFamily: OUT_L, fontSize: 13, color: P.mid, marginTop: 14, letterSpacing: 0.1 },

  // Big number
  bigNum:      { fontFamily: CG, fontSize: 88, color: P.ink, letterSpacing: -2, lineHeight: 88 },
  bigUnit:     { fontFamily: CG, fontSize: 40, color: P.gold, paddingBottom: 10, lineHeight: 44 },
  statLine:    { fontFamily: OUT_L, fontSize: 12, color: P.mid, textAlign: "right" },

  // Session card
  sessionCard:  { flexDirection: "row", backgroundColor: P.s1, marginTop: 20, borderWidth: 1, borderColor: P.border },
  goldStripe:   { width: 3, backgroundColor: P.gold },
  sessionName:  { fontFamily: CG_ITALIC, fontSize: 36, color: P.ink, letterSpacing: -0.3, lineHeight: 42, paddingHorizontal: 20, paddingTop: 20 },
  sessionMeta:  { fontFamily: OUT_L, fontSize: 13, color: P.mid, paddingHorizontal: 20, marginTop: 4 },
  sessionFooter:{ flexDirection: "row", alignItems: "flex-end", padding: 20, paddingTop: 16, marginTop: 4 },
  sessionStat:  { fontFamily: CG, fontSize: 32, color: P.ink, letterSpacing: -0.5 },
  sessionStatLabel: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.mid, textTransform: "uppercase", marginTop: 2 },

  // Buttons
  beginBtn:     { borderWidth: 1, borderColor: P.gold, paddingHorizontal: 18, paddingVertical: 12 },
  beginBtnText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.gold },
  ghostBtn:     { borderWidth: 1, borderColor: P.border, paddingVertical: 14, paddingHorizontal: 0, alignItems: "center", marginTop: 16 },
  ghostBtnText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: P.mid },

  // Week
  weekTile:    { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  // 2×2 grid — no outer border, internal hairlines only
  grid2x2:      { marginTop: 20, flexDirection: "row", flexWrap: "wrap", position: "relative" },
  statCell:     { width: "50%", paddingVertical: 24, paddingHorizontal: 20 },
  gridVDivider: { position: "absolute", left: "50%", top: 0, bottom: "50%", width: 1, backgroundColor: P.border },
  gridHDivider: { width: "100%", height: 1, backgroundColor: P.border },
  gridVDivider2:{ position: "absolute", left: "50%", top: "50%", bottom: 0, width: 1, backgroundColor: P.border },
});
