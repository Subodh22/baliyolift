import React, { useReducer, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import { impactLight, impactMedium, selectionAsync, notificationSuccess } from "@/utils/haptics";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { MUSCLE_BADGE_COLORS } from "@/constants/colors";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { FeedbackModal } from "@/components/FeedbackModal";
import { RestTimer } from "@/components/RestTimer";
import { SwapSheet } from "@/components/SwapSheet";
import { VideoModal } from "@/components/VideoModal";
import { getVideoId } from "@/data/exerciseVideos";

// ─── Types ────────────────────────────────────────────────────────────────────

type SetType = "regular" | "myorep" | "myorep_match";
type OverloadIndicator = "increase" | "decrease" | "maintain" | "add_rep";

interface LocalSet {
  localId: string;
  convexSetId: Id<"sets"> | null;
  weight: string;
  reps: string;
  rir: number;
  isLogged: boolean;
  overloadIndicator: OverloadIndicator | null;
}

interface LocalExState {
  sets: LocalSet[];
  setType: SetType;
}

interface WState {
  workoutId: Id<"workouts"> | null;
  exStates: Record<string, LocalExState>;
  activeCell: { exId: string; setIdx: number; field: "weight" | "reps" } | null;
  numpadVal: string;
  restVisible: boolean;
  feedbackVisible: boolean;
  startTime: number;
  swapOverrides: Record<string, { exerciseId: Id<"exercises">; exercise: { _id: Id<"exercises">; name: string; muscleGroup: string; equipment: string; sfr: string } }>;
}

type Action =
  | { type: "SET_WID"; wid: Id<"workouts"> }
  | { type: "INIT_EX"; exId: string; sets: LocalSet[]; setType: SetType }
  | { type: "FOCUS"; exId: string; setIdx: number; field: "weight" | "reps"; val: string }
  | { type: "KEY"; key: string }
  | { type: "BLUR" }
  | { type: "LOG"; exId: string; setIdx: number; sid: Id<"sets">; ind: OverloadIndicator }
  | { type: "UNLOG"; exId: string; setIdx: number }
  | { type: "ADD_SET"; exId: string }
  | { type: "DEL_SET"; exId: string; setIdx: number }
  | { type: "SET_TYPE"; exId: string; st: SetType }
  | { type: "SHOW_REST" }
  | { type: "HIDE_REST" }
  | { type: "SHOW_FB" }
  | { type: "HIDE_FB" }
  | { type: "SWAP_LOCAL"; oldExId: string; exerciseId: Id<"exercises">; exercise: any };

function mkSet(w: string, r: string, exId: string, i: number): LocalSet {
  return { localId: `${exId}_${i}_${Date.now()}`, convexSetId: null, weight: w, reps: r, rir: 2, isLogged: false, overloadIndicator: null };
}

function reducer(s: WState, a: Action): WState {
  switch (a.type) {
    case "SET_WID": return { ...s, workoutId: a.wid };
    case "INIT_EX":
      if (s.exStates[a.exId]) return s;
      return { ...s, exStates: { ...s.exStates, [a.exId]: { sets: a.sets, setType: a.setType } } };
    case "FOCUS": return { ...s, activeCell: { exId: a.exId, setIdx: a.setIdx, field: a.field }, numpadVal: a.val };
    case "BLUR": return { ...s, activeCell: null };
    case "KEY": {
      if (!s.activeCell) return s;
      const { exId, setIdx, field } = s.activeCell;
      const cur = s.numpadVal;
      const next = a.key === "⌫" ? (cur.length > 1 ? cur.slice(0, -1) : "0")
        : a.key === "." && cur.includes(".") ? cur
        : cur === "0" ? a.key : cur + a.key;
      const ex = s.exStates[exId];
      if (!ex) return s;
      return {
        ...s, numpadVal: next,
        exStates: { ...s.exStates, [exId]: { ...ex, sets: ex.sets.map((set, i) => i === setIdx ? { ...set, [field]: next } : set) } },
      };
    }
    case "LOG": {
      const ex = s.exStates[a.exId];
      if (!ex) return s;
      return {
        ...s, activeCell: null, restVisible: true,
        exStates: { ...s.exStates, [a.exId]: { ...ex, sets: ex.sets.map((set, i) => i === a.setIdx ? { ...set, isLogged: true, convexSetId: a.sid, overloadIndicator: a.ind } : set) } },
      };
    }
    case "UNLOG": {
      const ex = s.exStates[a.exId];
      if (!ex) return s;
      return {
        ...s,
        exStates: { ...s.exStates, [a.exId]: { ...ex, sets: ex.sets.map((set, i) => i === a.setIdx ? { ...set, isLogged: false, convexSetId: null, overloadIndicator: null } : set) } },
      };
    }
    case "ADD_SET": {
      const ex = s.exStates[a.exId];
      if (!ex) return s;
      const last = ex.sets[ex.sets.length - 1];
      return { ...s, exStates: { ...s.exStates, [a.exId]: { ...ex, sets: [...ex.sets, mkSet(last?.weight ?? "0", last?.reps ?? "10", a.exId, ex.sets.length)] } } };
    }
    case "DEL_SET": {
      const ex = s.exStates[a.exId];
      if (!ex || ex.sets.length <= 1) return s;
      return { ...s, exStates: { ...s.exStates, [a.exId]: { ...ex, sets: ex.sets.filter((_, i) => i !== a.setIdx) } } };
    }
    case "SET_TYPE": {
      const ex = s.exStates[a.exId];
      if (!ex) return s;
      return { ...s, exStates: { ...s.exStates, [a.exId]: { ...ex, setType: a.st } } };
    }
    case "SHOW_REST": return { ...s, restVisible: true };
    case "HIDE_REST": return { ...s, restVisible: false };
    case "SHOW_FB": return { ...s, feedbackVisible: true };
    case "HIDE_FB": return { ...s, feedbackVisible: false };
    case "SWAP_LOCAL": {
      return {
        ...s,
        swapOverrides: {
          ...s.swapOverrides,
          [a.oldExId]: { exerciseId: a.exerciseId, exercise: a.exercise },
        },
      };
    }
    default: return s;
  }
}

// ─── Overload arrow ───────────────────────────────────────────────────────────

function Arrow({ ind }: { ind: OverloadIndicator | null }) {
  if (!ind) return <View style={{ width: 26 }} />;
  const cfg: Record<OverloadIndicator, [string, string]> = {
    increase: ["↗", "#CC2020"], decrease: ["↘", "#999"], maintain: ["→", "#AAA"], add_rep: ["+1", "#26A870"],
  };
  return <View style={styles.arrowCell}><Text style={{ fontSize: 13, fontWeight: "800", color: cfg[ind][1] }}>{cfg[ind][0]}</Text></View>;
}

// ─── Muscle badge ─────────────────────────────────────────────────────────────

function MuscleBadge({ muscle }: { muscle: string }) {
  const c = MUSCLE_BADGE_COLORS[muscle] ?? "#CC2020";
  const label = (MUSCLE_DISPLAY_NAMES as any)[muscle] ?? muscle;
  return (
    <View style={[styles.badge, { backgroundColor: c }]}>
      <Text style={styles.badgeText}>{label.toUpperCase()}</Text>
      <View style={styles.badgeDot} />
    </View>
  );
}

// ─── Set row ──────────────────────────────────────────────────────────────────

function SetRow({ set, setIdx, totalSets, exId, activeCell, onFocus, onLog, onMenu, colors }: {
  set: LocalSet; setIdx: number; totalSets: number; exId: string;
  activeCell: WState["activeCell"]; onFocus: (f: "weight" | "reps") => void;
  onLog: () => void; onMenu: () => void; colors: any;
}) {
  const wActive = activeCell?.exId === exId && activeCell.setIdx === setIdx && activeCell.field === "weight";
  const rActive = activeCell?.exId === exId && activeCell.setIdx === setIdx && activeCell.field === "reps";
  return (
    <View style={[styles.setRow, { backgroundColor: setIdx % 2 === 0 ? colors.setRowBg : colors.setRowAlt }]}>
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }} style={{ width: 32, alignItems: "center" }}>
        {set.isLogged
          ? <Text style={{ fontSize: 12, fontWeight: "800", color: colors.loggedCheckBg }}>✓</Text>
          : <Text style={{ fontSize: 11, fontWeight: "700", color: colors.labelTertiary }}>{setIdx + 1}/{totalSets}</Text>
        }
      </TouchableOpacity>
      <Pressable style={[styles.cell, { backgroundColor: wActive ? colors.repRangeBg : "transparent" }]} onPress={() => onFocus("weight")}>
        <Text style={[styles.cellNum, { color: set.isLogged ? colors.labelSecondary : colors.label }]}>{set.weight}</Text>
      </Pressable>
      <Pressable style={[styles.cell, { backgroundColor: rActive ? colors.repRangeBg : "transparent" }]} onPress={() => onFocus("reps")}>
        <Text style={[styles.cellNum, { color: set.isLogged ? colors.labelSecondary : colors.label }]}>{set.reps}</Text>
      </Pressable>
      <Arrow ind={set.isLogged ? set.overloadIndicator : null} />
      <Pressable style={[styles.checkbox, { backgroundColor: set.isLogged ? colors.loggedCheckBg : colors.separator }]} onPress={onLog}>
        {set.isLogged && <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>✓</Text>}
      </Pressable>
    </View>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExCard({ se, originalExId, exState, suggestion, activeCell, dispatch, workoutId, userId, onOpenSwap, onOpenVideo }: {
  se: any; originalExId: string; exState: LocalExState | undefined; suggestion: any;
  activeCell: WState["activeCell"]; dispatch: React.Dispatch<Action>;
  workoutId: Id<"workouts"> | null; userId: Id<"users"> | null; onOpenSwap: () => void; onOpenVideo: () => void;
}) {
  const { colors, typography } = useTheme();
  const logMut = useMutation(api.sets.logSet);
  const deleteMut = useMutation(api.sets.deleteSet);
  const ex = se.exercise;

  useEffect(() => {
    if (!exState && suggestion !== undefined) {
      const w = suggestion?.suggestedWeight?.toString() ?? "0";
      const r = suggestion?.suggestedReps?.toString() ?? se.repRangeMin.toString();
      const numSets = suggestion?.suggestedSets ?? se.targetSets;
      const sets = Array.from({ length: numSets }, (_, i) => mkSet(w, r, originalExId, i));
      dispatch({ type: "INIT_EX", exId: originalExId, sets, setType: se.setType ?? "regular" });
    }
  }, [suggestion, exState]);

  const handleUnlog = useCallback(async (setIdx: number) => {
    if (!exState) return;
    const set = exState.sets[setIdx];
    if (!set || !set.isLogged) return;
    if (set.convexSetId) await deleteMut({ setId: set.convexSetId });
    dispatch({ type: "UNLOG", exId: originalExId, setIdx });
  }, [exState]);

  const handleLog = useCallback(async (setIdx: number) => {
    if (!workoutId || !userId || !exState) return;
    const set = exState.sets[setIdx];
    if (!set || set.isLogged) return;
    const w = parseFloat(set.weight) || 0;
    const r = parseInt(set.reps) || 0;
    if (!w || !r) { Alert.alert("Enter weight and reps first"); return; }
    impactMedium();
    // Use se.exercise._id (may be overridden) for actual DB logging
    const sid = await logMut({ workoutId, exerciseId: se.exercise._id, userId, weight: w, reps: r, rir: set.rir, targetRir: suggestion?.targetRir ?? 2, setNumber: setIdx + 1, isWarmup: false });
    dispatch({ type: "LOG", exId: originalExId, setIdx, sid, ind: suggestion?.overloadIndicator ?? "maintain" });
  }, [workoutId, userId, exState, suggestion, se]);

  const showMenu = (setIdx: number) => {
    Alert.alert("Set options", undefined, [
      { text: "Add set below", onPress: () => dispatch({ type: "ADD_SET", exId: originalExId }) },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "DEL_SET", exId: originalExId, setIdx }) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (!ex) return null;
  const sets = exState?.sets ?? [];
  const setType = exState?.setType ?? "regular";

  return (
    <Animated.View entering={FadeInDown.springify().damping(20)} style={[styles.card, { backgroundColor: colors.background }]}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <MuscleBadge muscle={ex.muscleGroup} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={onOpenVideo}>
            <Text style={{ color: colors.labelTertiary, fontSize: 18 }}>▷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenSwap}>
            <Text style={{ color: colors.labelTertiary, fontSize: 18 }}>⋯</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name + equipment */}
      <Text style={[typography.title3, { color: colors.label, fontWeight: "700", marginBottom: 2 }]}>{ex.name}</Text>
      <Text style={{ color: colors.labelTertiary, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>{ex.equipment}</Text>

      {/* Rep range + last session */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <View style={[styles.repPill, { backgroundColor: colors.repRangeBg }]}>
          <Text style={{ color: colors.repRangeFg, fontSize: 13, marginRight: 4 }}>✎</Text>
          <Text style={{ color: colors.repRangeFg, fontSize: 15, fontWeight: "600" }}>{se.repRangeMin}–{se.repRangeMax}</Text>
        </View>
        {suggestion?.lastSession && (
          <Text style={{ color: colors.labelTertiary, fontSize: 11, marginLeft: "auto" as any }}>
            Last: {suggestion.lastSession.weight}kg × {suggestion.lastSession.reps} @ RIR {suggestion.lastSession.rir}
          </Text>
        )}
      </View>

      {/* Today's target banner */}
      {suggestion && (() => {
        const cfg: Record<string, { label: string; color: string; bg: string }> = {
          increase:  { label: "↗ Add weight",  color: "#CC2020", bg: "#CC202018" },
          add_rep:   { label: "+1 Rep",         color: "#26A870", bg: "#26A87018" },
          maintain:  { label: "→ Match last",   color: "#888",    bg: "#88888815" },
          decrease:  { label: "↘ Reduce weight",color: "#999",    bg: "#99999918" },
        };
        const c = cfg[suggestion.overloadIndicator] ?? cfg.maintain;
        const hasWeight = suggestion.suggestedWeight != null;
        return (
          <View style={[styles.targetBanner, { backgroundColor: c.bg, borderColor: c.color + "40" }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.color, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 }}>
                {c.label.toUpperCase()}
              </Text>
              <Text style={{ color: colors.label, fontWeight: "700", fontSize: 15, marginTop: 2 }}>
                {hasWeight ? `${suggestion.suggestedWeight}kg × ${suggestion.suggestedReps} reps` : `${suggestion.suggestedReps} reps`}
                <Text style={{ color: colors.labelSecondary, fontWeight: "500", fontSize: 13 }}>
                  {`  ·  ${sets.length} sets  ·  RIR ${suggestion.targetRir}`}
                </Text>
              </Text>
            </View>
            {suggestion.deloadFlag && (
              <View style={{ backgroundColor: "#E8A02025", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: "#E8A020", fontSize: 10, fontWeight: "700" }}>DELOAD{"\n"}SOON</Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* Table header */}
      <View style={[styles.tblHead, { borderBottomColor: colors.separator }]}>
        <View style={{ width: 32 }} />
        <Text style={[styles.tblHdr, { color: colors.labelTertiary }]}>WEIGHT</Text>
        <Text style={[styles.tblHdr, { color: colors.labelTertiary }]}>REPS</Text>
        <View style={{ width: 26 }} />
        <Text style={{ width: 34, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: colors.labelTertiary }}>LOG</Text>
      </View>

      {/* Sets */}
      {sets.map((set, idx) => (
        <SetRow key={set.localId} set={set} setIdx={idx} totalSets={sets.length} exId={originalExId} activeCell={activeCell}
          onFocus={(f) => dispatch({ type: "FOCUS", exId: originalExId, setIdx: idx, field: f, val: f === "weight" ? set.weight : set.reps })}
          onLog={() => set.isLogged ? handleUnlog(idx) : handleLog(idx)} onMenu={() => showMenu(idx)} colors={colors} />
      ))}

      {/* Add set */}
      <TouchableOpacity onPress={() => { selectionAsync(); dispatch({ type: "ADD_SET", exId: originalExId }); }} style={{ alignItems: "center", paddingVertical: 10 }}>
        <Text style={[typography.subheadline, { color: colors.accent }]}>+ Add set</Text>
      </TouchableOpacity>

      {/* Set type */}
      <View style={[styles.setTypeRow, { borderTopColor: colors.separator }]}>
        <Text style={{ color: colors.labelTertiary, fontSize: 11, fontWeight: "600", marginRight: 8 }}>SET TYPE</Text>
        {(["regular", "myorep", "myorep_match"] as SetType[]).map((t) => (
          <Pressable key={t} onPress={() => { selectionAsync(); dispatch({ type: "SET_TYPE", exId: originalExId, st: t }); }}
            style={[styles.typePill, { backgroundColor: setType === t ? colors.accent : colors.fillSecondary }]}>
            <Text style={{ color: setType === t ? "#FFF" : colors.labelSecondary, fontSize: 11, fontWeight: "600" }}>
              {t === "regular" ? "Regular" : t === "myorep" ? "Myorep" : "Myorep match"}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Card wrapper fetching per-exercise suggestion ────────────────────────────

function ExCardWithSuggestion({ se, originalExId, exState, activeCell, dispatch, workoutId, userId, weekNumber, mesoId, onOpenSwap, onOpenVideo }: {
  se: any; originalExId: string; exState: LocalExState | undefined; activeCell: WState["activeCell"];
  dispatch: React.Dispatch<Action>; workoutId: Id<"workouts"> | null; userId: Id<"users"> | null;
  weekNumber: number; mesoId: Id<"mesocycles"> | null; onOpenSwap: () => void; onOpenVideo: () => void;
}) {
  const suggestion = useQuery(
    api.overload.getSuggestionV2,
    userId && mesoId ? { userId, exerciseId: se.exerciseId, mesocycleId: mesoId, weekNumber, repRangeMin: se.repRangeMin, repRangeMax: se.repRangeMax, targetSets: se.targetSets } : "skip"
  );
  return <ExCard se={se} originalExId={originalExId} exState={exState} suggestion={suggestion} activeCell={activeCell} dispatch={dispatch} workoutId={workoutId} userId={userId} onOpenSwap={onOpenSwap} onOpenVideo={onOpenVideo} />;
}

// ─── NumPad ───────────────────────────────────────────────────────────────────

function NumPad({ onKey, colors }: { onKey: (k: string) => void; colors: any }) {
  return (
    <View style={styles.numGrid}>
      {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((k) => (
        <TouchableOpacity key={k} style={[styles.numKey, { backgroundColor: colors.backgroundTertiary }]}
          onPress={() => { impactLight(); onKey(k); }} activeOpacity={0.55}>
          <Text style={{ fontSize: 20, fontWeight: "500", color: colors.label }}>{k}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const { id, sessionId, week } = useLocalSearchParams<{ id?: string; sessionId?: string; week?: string }>();
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();
  const insets = useSafeAreaInsets();
  const startMut = useMutation(api.workouts.startWorkout);
  const completeMut = useMutation(api.workouts.completeWorkout);

  // id === "new" means fresh start via /workout/new?sessionId=xxx — treat as null
  const existingWorkoutId = id && id !== "new" ? (id as Id<"workouts">) : null;

  const [state, dispatch] = useReducer(reducer, {
    workoutId: existingWorkoutId,
    exStates: {}, activeCell: null, numpadVal: "0",
    restVisible: false, feedbackVisible: false, startTime: Date.now(),
    swapOverrides: {},
  });

  const [swapTarget, setSwapTarget] = useState<{
    seId: Id<"sessionExercises"> | null;
    exercise: { _id: Id<"exercises">; name: string; muscleGroup: string; equipment: string; sfr: string };
    oldExId: string;
  } | null>(null);

  const [videoTarget, setVideoTarget] = useState<{ name: string; videoId: string } | null>(null);

  const meso = useQuery(api.mesocycles.getActiveWithDetails, userId ? { userId } : "skip");

  // Resume flow: load workout to get its sessionId
  const existingWorkout = useQuery(
    api.workouts.getWorkoutWithSets,
    existingWorkoutId ? { workoutId: existingWorkoutId } : "skip"
  );

  // Resolve sessionId: from URL param (new workout) or from loaded workout (resume)
  const resolvedSessionId = sessionId
    ? (sessionId as Id<"sessions">)
    : existingWorkout?.sessionId ?? null;

  const sessionExs = useQuery(
    api.mesocycles.getSessionExercises,
    resolvedSessionId ? { sessionId: resolvedSessionId } : "skip"
  );

  // Resume: pre-populate exStates from existing logged sets
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !existingWorkoutId || !existingWorkout || !sessionExs) return;
    resumedRef.current = true;
    const setsByEx: Record<string, typeof existingWorkout.sets> = {};
    for (const s of existingWorkout.sets) {
      const key = s.exerciseId as string;
      if (!setsByEx[key]) setsByEx[key] = [];
      setsByEx[key].push(s);
    }
    for (const se of sessionExs as any[]) {
      const exId = se.exercise._id as string;
      const logged = (setsByEx[exId] ?? []).sort((a: any, b: any) => a.setNumber - b.setNumber);
      const loggedSets: LocalSet[] = logged.map((s: any, i: number) => ({
        localId: `resume_${exId}_${i}`,
        convexSetId: s._id,
        weight: s.weight.toString(),
        reps: s.reps.toString(),
        rir: s.rir,
        isLogged: true,
        overloadIndicator: null,
      }));
      const lastLogged = logged[logged.length - 1];
      const pendingCount = Math.max(0, se.targetSets - logged.length);
      const pendingW = lastLogged ? lastLogged.weight.toString() : "0";
      const pendingR = lastLogged ? lastLogged.reps.toString() : se.repRangeMin.toString();
      const pendingSets: LocalSet[] = Array.from({ length: pendingCount }, (_, i) =>
        mkSet(pendingW, pendingR, exId, logged.length + i)
      );
      const sets: LocalSet[] = [...loggedSets, ...pendingSets];
      if (sets.length === 0) sets.push(mkSet("0", se.repRangeMin.toString(), exId, 0));
      dispatch({ type: "INIT_EX", exId, sets, setType: se.setType ?? "regular" });
    }
  }, [existingWorkoutId, existingWorkout, sessionExs]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || state.workoutId || !sessionId || !userId || !meso) return;
    startedRef.current = true;
    const weekNumber = week ? parseInt(week, 10) : meso.weekNumber;
    startMut({
      userId,
      sessionId: sessionId as Id<"sessions">,
      mesocycleId: meso._id,
      weekNumber,
    }).then((wid) => dispatch({ type: "SET_WID", wid }));
  }, [sessionId, userId, meso?.weekNumber]);

  const wid = state.workoutId;
  // Use URL week param (early-start) if provided, otherwise fall back to meso's computed week
  const weekNumber = week ? parseInt(week, 10) : (meso?.weekNumber ?? 1);

  const trainedMuscles = useMemo((): string[] => {
    if (!sessionExs) return [];
    return [...new Set((sessionExs as any[]).map((se) => se.exercise?.muscleGroup).filter(Boolean))];
  }, [sessionExs]);

  const allLogged = useMemo(() => {
    const ids = Object.keys(state.exStates);
    if (!ids.length) return false;
    return ids.every((id) => { const ex = state.exStates[id]; return ex.sets.length > 0 && ex.sets.every((s) => s.isLogged); });
  }, [state.exStates]);

  const handleFinish = async () => {
    if (!wid) return;
    notificationSuccess();
    await completeMut({ workoutId: wid, durationMs: Date.now() - state.startTime });
    dispatch({ type: "SHOW_FB" });
  };

  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const session = meso?.sessions.find((s: any) => resolvedSessionId ? s._id === resolvedSessionId : s.dayOfWeek === new Date().getDay());
  const dayNum = session ? session.order + 1 : 1;

  const numH = useSharedValue(0);
  const numOp = useSharedValue(0);
  useEffect(() => {
    numH.value = state.activeCell ? 292 : 0;
    numOp.value = state.activeCell ? 1 : 0;
  }, [!!state.activeCell]);
  const numStyle = useAnimatedStyle(() => ({ height: numH.value, opacity: numOp.value, overflow: "hidden" }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Header — manually pad for safe area so modal top inset is always respected */}
      <View style={[styles.headerWrap, { backgroundColor: colors.headerBg, paddingTop: insets.top + 8 }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hSub}>{meso?.name?.toUpperCase() ?? "WORKOUT"}</Text>
            <Text style={styles.hTitle}>WEEK {weekNumber}  DAY {dayNum}  {weekday}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {allLogged ? (
              <TouchableOpacity style={[styles.finishPill, { backgroundColor: colors.accentGreen }]} onPress={handleFinish}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>FINISH ✓</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: "#888", fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Scroll */}
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false} automaticallyAdjustsScrollIndicatorInsets={false}>
        {!sessionExs && <View style={{ alignItems: "center", paddingTop: 80 }}><Text style={{ color: colors.labelSecondary }}>Loading…</Text></View>}
        {(sessionExs as any[] | undefined)?.map((se: any) => {
          const oldExId = se.exercise._id as string;
          const override = state.swapOverrides[oldExId];
          const effectiveSe = override
            ? { ...se, exerciseId: override.exerciseId, exercise: { ...se.exercise, ...override.exercise } }
            : se;
          return (
            <ExCardWithSuggestion
              key={se.exerciseId}
              se={effectiveSe}
              originalExId={oldExId}
              exState={state.exStates[oldExId]}
              activeCell={state.activeCell}
              dispatch={dispatch}
              workoutId={wid}
              userId={userId ?? null}
              weekNumber={weekNumber}
              mesoId={meso?._id ?? null}
              onOpenSwap={() =>
                setSwapTarget({
                  seId: se.isLegacy ? null : se._id,
                  exercise: se.exercise,
                  oldExId,
                })
              }
              onOpenVideo={() => {
                const vid = getVideoId(effectiveSe.exercise?.name ?? "");
                if (vid) setVideoTarget({ name: effectiveSe.exercise?.name ?? "", videoId: vid });
              }}
            />
          );
        })}
        {allLogged && (
          <TouchableOpacity style={[styles.finishBar, { backgroundColor: colors.accentGreen }]} onPress={handleFinish}>
            <Text style={{ color: "#FFF", fontSize: 17, fontWeight: "700" }}>Finish Workout ✓</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Numpad */}
      <Animated.View style={[styles.numWrap, { backgroundColor: colors.backgroundSecondary }, numStyle]}>
        <View style={[styles.numTop, { borderBottomColor: colors.separator }]}>
          <Text style={{ color: colors.labelSecondary, fontSize: 12, fontWeight: "600" }}>
            {state.activeCell?.field === "weight" ? "WEIGHT (kg)" : "REPS"}
          </Text>
          <Text style={{ color: colors.label, fontSize: 22, fontWeight: "700", marginLeft: 14, flex: 1 }}>{state.numpadVal}</Text>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.accent }]} onPress={() => dispatch({ type: "BLUR" })}>
            <Text style={{ color: "#FFF", fontWeight: "700" }}>Done</Text>
          </TouchableOpacity>
        </View>
        <NumPad onKey={(k) => dispatch({ type: "KEY", key: k })} colors={colors} />
      </Animated.View>

      {/* Rest timer */}
      {state.restVisible && !state.activeCell && (
        <View style={[styles.restBar, { backgroundColor: colors.headerBg }]}>
          <Text style={{ fontSize: 18 }}>⏱</Text>
          <RestTimer defaultSeconds={90} compact onComplete={() => dispatch({ type: "HIDE_REST" })} />
          <TouchableOpacity onPress={() => dispatch({ type: "HIDE_REST" })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: "#888", fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feedback modal */}
      {state.feedbackVisible && wid && userId && (
        <FeedbackModal visible muscleGroups={trainedMuscles} workoutId={wid} userId={userId}
          onSave={() => { dispatch({ type: "HIDE_FB" }); router.replace("/(tabs)"); }}
          onCancel={() => { dispatch({ type: "HIDE_FB" }); router.replace("/(tabs)"); }} />
      )}

      {/* Swap exercise sheet */}
      {swapTarget && (
        <SwapSheet
          visible={!!swapTarget}
          currentExercise={swapTarget.exercise}
          sessionExerciseId={swapTarget.seId}
          onSwapLocal={(newEx) => {
            dispatch({ type: "SWAP_LOCAL", oldExId: swapTarget.oldExId, exerciseId: newEx._id, exercise: newEx });
          }}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {/* Exercise video modal */}
      {videoTarget && (
        <VideoModal
          visible
          exerciseName={videoTarget.name}
          videoId={videoTarget.videoId}
          onClose={() => setVideoTarget(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerWrap: { paddingBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 4 },
  hSub: { color: "#777", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  hTitle: { color: "#FFF", fontSize: 16, fontWeight: "800", marginTop: 2 },
  finishPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  card: { marginHorizontal: 12, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  repPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  targetBanner: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12 },
  tblHead: { flexDirection: "row", alignItems: "center", paddingBottom: 6, borderBottomWidth: 0.5, marginBottom: 2 },
  tblHdr: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  setRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 2, minHeight: 46, borderRadius: 6 },
  cell: { flex: 1, height: 40, borderRadius: 6, alignItems: "center", justifyContent: "center", marginHorizontal: 2 },
  cellNum: { fontSize: 17, fontWeight: "600" },
  arrowCell: { width: 26, alignItems: "center", justifyContent: "center" },
  checkbox: { width: 34, height: 34, borderRadius: 7, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  setTypeRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 0.5, gap: 6, flexWrap: "wrap" },
  typePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  numWrap: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 10 },
  numTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  numGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  numKey: { width: "30%", height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  restBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 28, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  finishBar: { marginHorizontal: 16, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
