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
import { AddExSheet, type PickedExercise } from "@/components/AddExSheet";
import { ExMenuSheet } from "@/components/ExMenuSheet";
import { getVideoId } from "@/data/exerciseVideos";

// ─── Types ────────────────────────────────────────────────────────────────────

type SetType = "regular" | "myorep" | "myorep_match";
type OverloadIndicator = "increase" | "decrease" | "maintain" | "add_rep";
type CardioMode = "duration_pace" | "duration_only" | "intervals";

interface LocalCardioState {
  durationMin: number;
  distanceKm: number | null;  // null for duration_only
  rpe: number;
  intervalCount: number | null;
  intervalWorkSec: number;
  intervalRestSec: number;
  isLogged: boolean;
  convexSetId: Id<"cardioSets"> | null;
}

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

interface ExtraExercise {
  _id: Id<"exercises">;
  seId: Id<"sessionExercises"> | null; // set after addExerciseToSession resolves
  name: string;
  muscleGroup: string;
  equipment: string;
  sfr: string;
  category?: string;
  cardioMode?: string;
}

interface WState {
  workoutId: Id<"workouts"> | null;
  exStates: Record<string, LocalExState>;
  cardioStates: Record<string, LocalCardioState>;
  hiddenExIds: string[];       // exercises removed "just today"
  extraExercises: ExtraExercise[]; // exercises added during this workout
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
  | { type: "INIT_CARDIO"; exId: string; state: LocalCardioState }
  | { type: "FOCUS"; exId: string; setIdx: number; field: "weight" | "reps"; val: string }
  | { type: "KEY"; key: string }
  | { type: "BLUR" }
  | { type: "LOG"; exId: string; setIdx: number; sid: Id<"sets">; ind: OverloadIndicator }
  | { type: "UNLOG"; exId: string; setIdx: number }
  | { type: "ADD_SET"; exId: string }
  | { type: "DEL_SET"; exId: string; setIdx: number }
  | { type: "SET_TYPE"; exId: string; st: SetType }
  | { type: "SET_CARDIO"; exId: string; patch: Partial<LocalCardioState> }
  | { type: "LOG_CARDIO"; exId: string; sid: Id<"cardioSets"> }
  | { type: "UNLOG_CARDIO"; exId: string }
  | { type: "SHOW_REST" }
  | { type: "HIDE_REST" }
  | { type: "SHOW_FB" }
  | { type: "HIDE_FB" }
  | { type: "SWAP_LOCAL"; oldExId: string; exerciseId: Id<"exercises">; exercise: any }
  | { type: "HIDE_EX"; exId: string }
  | { type: "ADD_EXTRA_EX"; exercise: ExtraExercise }
  | { type: "SET_EXTRA_SEID"; exId: string; seId: Id<"sessionExercises"> };

function mkSet(w: string, r: string, exId: string, i: number): LocalSet {
  return { localId: `${exId}_${i}_${Date.now()}`, convexSetId: null, weight: w, reps: r, rir: 2, isLogged: false, overloadIndicator: null };
}

function reducer(s: WState, a: Action): WState {
  switch (a.type) {
    case "SET_WID": return { ...s, workoutId: a.wid };
    case "INIT_EX":
      if (s.exStates[a.exId]) return s;
      return { ...s, exStates: { ...s.exStates, [a.exId]: { sets: a.sets, setType: a.setType } } };
    case "INIT_CARDIO":
      if (s.cardioStates[a.exId]) return s;
      return { ...s, cardioStates: { ...s.cardioStates, [a.exId]: a.state } };
    case "SET_CARDIO": {
      const prev = s.cardioStates[a.exId];
      if (!prev) return s;
      return { ...s, cardioStates: { ...s.cardioStates, [a.exId]: { ...prev, ...a.patch } } };
    }
    case "LOG_CARDIO": {
      const prev = s.cardioStates[a.exId];
      if (!prev) return s;
      return { ...s, restVisible: true, cardioStates: { ...s.cardioStates, [a.exId]: { ...prev, isLogged: true, convexSetId: a.sid } } };
    }
    case "UNLOG_CARDIO": {
      const prev = s.cardioStates[a.exId];
      if (!prev) return s;
      return { ...s, cardioStates: { ...s.cardioStates, [a.exId]: { ...prev, isLogged: false, convexSetId: null } } };
    }
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
    case "HIDE_EX":
      return { ...s, hiddenExIds: [...s.hiddenExIds, a.exId] };
    case "ADD_EXTRA_EX":
      if (s.extraExercises.some((e) => (e._id as string) === (a.exercise._id as string))) return s;
      return { ...s, extraExercises: [...s.extraExercises, a.exercise] };
    case "SET_EXTRA_SEID":
      return { ...s, extraExercises: s.extraExercises.map((e) => (e._id as string) === a.exId ? { ...e, seId: a.seId } : e) };
    default: return s;
  }
}

// ─── Overload arrow ───────────────────────────────────────────────────────────

function Arrow({ ind, colors }: { ind: OverloadIndicator | null; colors: any }) {
  if (!ind) return <View style={{ width: 26 }} />;
  const cfg: Record<OverloadIndicator, [string, string]> = {
    increase: ["↗", colors.accentRed], decrease: ["↘", colors.labelTertiary], maintain: ["→", colors.labelTertiary], add_rep: ["+1", colors.accentGreen],
  };
  return <View style={styles.arrowCell}><Text style={{ fontSize: 13, fontFamily: "Outfit_400Regular", color: cfg[ind][1] }}>{cfg[ind][0]}</Text></View>;
}

// ─── Muscle badge ─────────────────────────────────────────────────────────────

function MuscleBadge({ muscle }: { muscle: string }) {
  const { colors } = useTheme();
  const c = MUSCLE_BADGE_COLORS[muscle] ?? colors.accentRed;
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
          ? <Text style={{ fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.loggedCheckBg }}>✓</Text>
          : <Text style={{ fontSize: 11, fontFamily: "Outfit_400Regular", color: colors.labelTertiary }}>{setIdx + 1}/{totalSets}</Text>
        }
      </TouchableOpacity>
      <Pressable style={[styles.cell, { backgroundColor: wActive ? colors.repRangeBg : "transparent" }]} onPress={() => onFocus("weight")}>
        <Text style={[styles.cellNum, { color: set.isLogged ? colors.labelSecondary : colors.label }]}>{set.weight}</Text>
      </Pressable>
      <Pressable style={[styles.cell, { backgroundColor: rActive ? colors.repRangeBg : "transparent" }]} onPress={() => onFocus("reps")}>
        <Text style={[styles.cellNum, { color: set.isLogged ? colors.labelSecondary : colors.label }]}>{set.reps}</Text>
      </Pressable>
      <Arrow ind={set.isLogged ? set.overloadIndicator : null} colors={colors} />
      <Pressable style={[styles.checkbox, { backgroundColor: set.isLogged ? colors.loggedCheckBg : colors.separator }]} onPress={onLog}>
        {set.isLogged && <Text style={{ color: "#FFF", fontFamily: "Outfit_400Regular", fontSize: 14 }}>✓</Text>}
      </Pressable>
    </View>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExCard({ se, originalExId, exState, suggestion, activeCell, dispatch, workoutId, userId, onOpenSwap, onOpenVideo, onDelete }: {
  se: any; originalExId: string; exState: LocalExState | undefined; suggestion: any;
  activeCell: WState["activeCell"]; dispatch: React.Dispatch<Action>;
  workoutId: Id<"workouts"> | null; userId: Id<"users"> | null; onOpenSwap: () => void; onOpenVideo: () => void; onDelete: (scope: "today" | "meso") => void;
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Animated.View entering={FadeInDown.springify().damping(20)} style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
      <ExMenuSheet
        visible={menuOpen}
        title={ex.name}
        onClose={() => setMenuOpen(false)}
        options={[
          { label: "Replace exercise", onPress: onOpenSwap },
          { label: "Delete exercise", destructive: true, onPress: () => setDeleteOpen(true) },
        ]}
      />
      <ExMenuSheet
        visible={deleteOpen}
        title="Remove from…"
        onClose={() => setDeleteOpen(false)}
        options={[
          { label: "Just today", onPress: () => onDelete("today") },
          { label: "All workouts in mesocycle", destructive: true, onPress: () => onDelete("meso") },
        ]}
      />
      {/* Top row */}
      <View style={styles.cardTop}>
        <MuscleBadge muscle={ex.muscleGroup} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={onOpenVideo}>
            <Text style={{ color: colors.labelTertiary, fontSize: 18 }}>▷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: colors.labelTertiary, fontSize: 20 }}>⋯</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name + equipment */}
      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 17, letterSpacing: -0.2, color: colors.label, marginBottom: 2 }}>{ex.name}</Text>
      <Text style={{ fontFamily: "Outfit_300Light", color: colors.labelTertiary, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>{ex.equipment}</Text>

      {/* Rep range + last session */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <View style={[styles.repPill, { backgroundColor: colors.repRangeBg }]}>
          <Text style={{ color: colors.repRangeFg, fontSize: 13, marginRight: 4 }}>✎</Text>
          <Text style={{ color: colors.repRangeFg, fontSize: 15, fontFamily: "Outfit_400Regular" }}>{se.repRangeMin}–{se.repRangeMax}</Text>
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
          increase:  { label: "↗ Add weight",   color: colors.accentRed,   bg: colors.accentRed + "18" },
          add_rep:   { label: "+1 Rep",          color: colors.accentGreen, bg: colors.accentGreen + "18" },
          maintain:  { label: "→ Match last",    color: colors.labelTertiary, bg: colors.fillSecondary },
          decrease:  { label: "↘ Reduce weight", color: colors.labelTertiary, bg: colors.fillSecondary },
        };
        const c = cfg[suggestion.overloadIndicator] ?? cfg.maintain;
        const hasWeight = suggestion.suggestedWeight != null;
        return (
          <View style={[styles.targetBanner, { backgroundColor: c.bg, borderColor: c.color + "40" }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.color, fontFamily: "Outfit_400Regular", fontSize: 12, letterSpacing: 0.5 }}>
                {c.label.toUpperCase()}
              </Text>
              <Text style={{ color: colors.label, fontFamily: "Outfit_400Regular", fontSize: 15, marginTop: 2 }}>
                {hasWeight ? `${suggestion.suggestedWeight}kg × ${suggestion.suggestedReps} reps` : `${suggestion.suggestedReps} reps`}
                <Text style={{ color: colors.labelSecondary, fontFamily: "Outfit_400Regular", fontSize: 13 }}>
                  {`  ·  ${sets.length} sets  ·  RIR ${suggestion.targetRir}`}
                </Text>
              </Text>
            </View>
            {suggestion.deloadFlag && (
              <View style={{ backgroundColor: colors.accentOrange + "25", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: colors.accentOrange, fontSize: 10, fontFamily: "Outfit_400Regular" }}>DELOAD{"\n"}SOON</Text>
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
        <Text style={{ width: 34, textAlign: "center", fontSize: 11, fontFamily: "Outfit_400Regular", letterSpacing: 0.5, color: colors.labelTertiary }}>LOG</Text>
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
        <Text style={{ color: colors.labelTertiary, fontSize: 11, fontFamily: "Outfit_400Regular", letterSpacing: 0.8, marginRight: 8 }}>SET TYPE</Text>
        {(["regular", "myorep", "myorep_match"] as SetType[]).map((t) => (
          <Pressable key={t} onPress={() => { selectionAsync(); dispatch({ type: "SET_TYPE", exId: originalExId, st: t }); }}
            style={[styles.typePill, { backgroundColor: setType === t ? colors.accent : colors.fillSecondary }]}>
            <Text style={{ color: setType === t ? "#FFF" : colors.labelSecondary, fontSize: 11, fontFamily: "Outfit_400Regular" }}>
              {t === "regular" ? "Regular" : t === "myorep" ? "Myorep" : "Myorep match"}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Card wrapper fetching per-exercise suggestion ────────────────────────────

function ExCardWithSuggestion({ se, originalExId, exState, activeCell, dispatch, workoutId, userId, weekNumber, mesoId, onOpenSwap, onOpenVideo, onDelete }: {
  se: any; originalExId: string; exState: LocalExState | undefined; activeCell: WState["activeCell"];
  dispatch: React.Dispatch<Action>; workoutId: Id<"workouts"> | null; userId: Id<"users"> | null;
  weekNumber: number; mesoId: Id<"mesocycles"> | null; onOpenSwap: () => void; onOpenVideo: () => void; onDelete: (scope: "today" | "meso") => void;
}) {
  const suggestion = useQuery(
    api.overload.getSuggestionV2,
    userId && mesoId ? { userId, exerciseId: se.exerciseId, mesocycleId: mesoId, weekNumber, repRangeMin: se.repRangeMin, repRangeMax: se.repRangeMax, targetSets: se.targetSets } : "skip"
  );
  return <ExCard se={se} originalExId={originalExId} exState={exState} suggestion={suggestion} activeCell={activeCell} dispatch={dispatch} workoutId={workoutId} userId={userId} onOpenSwap={onOpenSwap} onOpenVideo={onOpenVideo} onDelete={onDelete} />;
}

// ─── Cardio Exercise Card ─────────────────────────────────────────────────────

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function fmtDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}

function CardioExCard({ se, exId, cardioState, suggestion, dispatch, workoutId, userId, onDelete }: {
  se: any; exId: string; cardioState: LocalCardioState | undefined;
  suggestion: any; dispatch: React.Dispatch<Action>;
  workoutId: Id<"workouts"> | null; userId: Id<"users"> | null; onDelete: (scope: "today" | "meso") => void;
}) {
  const { colors } = useTheme();
  const logMut = useMutation(api.cardioSets.logCardioSet);
  const deleteMut = useMutation(api.cardioSets.deleteCardioSet);
  const ex = se.exercise;
  const mode: CardioMode = ex.cardioMode ?? "duration_only";

  // Initialize cardio state from suggestion on first render
  useEffect(() => {
    if (!cardioState && suggestion !== undefined) {
      const sugDurMin = suggestion?.suggestedDurationSec
        ? Math.round(suggestion.suggestedDurationSec / 60)
        : 20;
      const sugDistKm = suggestion?.suggestedDistanceM != null
        ? Math.round(suggestion.suggestedDistanceM / 100) / 10
        : mode === "duration_pace" ? 3.0 : null;
      dispatch({
        type: "INIT_CARDIO", exId,
        state: {
          durationMin: sugDurMin,
          distanceKm: sugDistKm,
          rpe: suggestion?.targetRpe ?? 6,
          intervalCount: suggestion?.suggestedIntervalCount ?? (mode === "intervals" ? 8 : null),
          intervalWorkSec: suggestion?.suggestedIntervalWorkSec ?? 30,
          intervalRestSec: suggestion?.suggestedIntervalRestSec ?? 60,
          isLogged: false,
          convexSetId: null,
        },
      });
    }
  }, [suggestion, cardioState]);

  const handleLog = useCallback(async () => {
    if (!workoutId || !userId || !cardioState) return;
    if (cardioState.isLogged) {
      if (cardioState.convexSetId) await deleteMut({ setId: cardioState.convexSetId });
      dispatch({ type: "UNLOG_CARDIO", exId });
      return;
    }
    impactMedium();
    const sid = await logMut({
      workoutId,
      exerciseId: ex._id,
      userId,
      setNumber: 1,
      durationSec: cardioState.durationMin * 60,
      distanceM: cardioState.distanceKm != null ? Math.round(cardioState.distanceKm * 1000) : undefined,
      rpe: cardioState.rpe,
      targetRpe: suggestion?.targetRpe,
      intervalCount: cardioState.intervalCount ?? undefined,
      intervalWorkSec: mode === "intervals" ? cardioState.intervalWorkSec : undefined,
      intervalRestSec: mode === "intervals" ? cardioState.intervalRestSec : undefined,
    });
    dispatch({ type: "LOG_CARDIO", exId, sid });
  }, [workoutId, userId, cardioState, suggestion, ex]);

  if (!ex) return null;
  const cs = cardioState;

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const overloadColor = suggestion?.overloadIndicator === "increase" ? colors.accentGreen : colors.labelTertiary;
  const overloadBg = suggestion?.overloadIndicator === "increase" ? colors.accentGreen + "18" : colors.fillSecondary;

  return (
    <Animated.View entering={FadeInDown.springify().damping(20)} style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
      <ExMenuSheet
        visible={menuOpen}
        title={ex.name}
        onClose={() => setMenuOpen(false)}
        options={[
          { label: "Delete exercise", destructive: true, onPress: () => setDeleteOpen(true) },
        ]}
      />
      <ExMenuSheet
        visible={deleteOpen}
        title="Remove from…"
        onClose={() => setDeleteOpen(false)}
        options={[
          { label: "Just today", onPress: () => onDelete("today") },
          { label: "All workouts in mesocycle", destructive: true, onPress: () => onDelete("meso") },
        ]}
      />
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: "#1A3A2A" }]}>
          <Text style={styles.badgeText}>CARDIO</Text>
          <View style={[styles.badgeDot, { backgroundColor: "#4ADE80" }]} />
        </View>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.labelTertiary, fontSize: 20 }}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Name + equipment */}
      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 17, letterSpacing: -0.2, color: colors.label, marginBottom: 2 }}>{ex.name}</Text>
      <Text style={{ fontFamily: "Outfit_300Light", color: colors.labelTertiary, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
        {mode === "duration_pace" ? "duration · pace" : mode === "intervals" ? "intervals" : "duration"}
      </Text>

      {/* Suggestion banner */}
      {suggestion && (
        <View style={[styles.targetBanner, { backgroundColor: overloadBg, borderColor: overloadColor + "40" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: overloadColor, fontFamily: "Outfit_400Regular", fontSize: 12, letterSpacing: 0.5 }}>
              {suggestion.overloadIndicator === "increase" ? "↗ PROGRESS" : "→ MAINTAIN"}
            </Text>
            <Text style={{ color: colors.label, fontFamily: "Outfit_400Regular", fontSize: 14, marginTop: 2 }}>
              {suggestion.reason}
            </Text>
            <Text style={{ color: colors.labelSecondary, fontFamily: "Outfit_400Regular", fontSize: 12, marginTop: 1 }}>
              Target RPE {suggestion.targetRpe}
            </Text>
          </View>
        </View>
      )}

      {/* Interval mode UI */}
      {mode === "intervals" && cs && (
        <View style={{ gap: 10, marginBottom: 12 }}>
          <Text style={{ color: colors.labelTertiary, fontSize: 10, fontFamily: "Outfit_300Light", letterSpacing: 2 }}>ROUNDS</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { intervalCount: Math.max(1, (cs.intervalCount ?? 8) - 1) } }); }}>
              <Text style={{ color: colors.label, fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepVal}>{cs.intervalCount ?? 8}</Text>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { intervalCount: (cs.intervalCount ?? 8) + 1 } }); }}>
              <Text style={{ color: colors.label, fontSize: 20 }}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.labelTertiary, fontSize: 10, fontFamily: "Outfit_300Light", letterSpacing: 2, marginBottom: 6 }}>WORK</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { intervalWorkSec: Math.max(10, cs.intervalWorkSec - 10) } }); }}>
                  <Text style={{ color: colors.label, fontSize: 18 }}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepVal, { fontSize: 14 }]}>{cs.intervalWorkSec}s</Text>
                <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { intervalWorkSec: cs.intervalWorkSec + 10 } }); }}>
                  <Text style={{ color: colors.label, fontSize: 18 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.labelTertiary, fontSize: 10, fontFamily: "Outfit_300Light", letterSpacing: 2, marginBottom: 6 }}>REST</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { intervalRestSec: Math.max(10, cs.intervalRestSec - 10) } }); }}>
                  <Text style={{ color: colors.label, fontSize: 18 }}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepVal, { fontSize: 14 }]}>{cs.intervalRestSec}s</Text>
                <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { intervalRestSec: cs.intervalRestSec + 10 } }); }}>
                  <Text style={{ color: colors.label, fontSize: 18 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Duration stepper */}
      {cs && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.labelTertiary, fontSize: 10, fontFamily: "Outfit_300Light", letterSpacing: 2, marginBottom: 6 }}>
            {mode === "intervals" ? "TOTAL TIME" : "DURATION"}
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { durationMin: Math.max(5, cs.durationMin - 5) } }); }}>
              <Text style={{ color: colors.label, fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepVal}>{fmtDuration(cs.durationMin)}</Text>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { durationMin: cs.durationMin + 5 } }); }}>
              <Text style={{ color: colors.label, fontSize: 20 }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Distance stepper (duration_pace only) */}
      {cs && mode === "duration_pace" && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.labelTertiary, fontSize: 10, fontFamily: "Outfit_300Light", letterSpacing: 2, marginBottom: 6 }}>DISTANCE</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { distanceKm: Math.max(0.5, Math.round(((cs.distanceKm ?? 0) - 0.5) * 10) / 10) } }); }}>
              <Text style={{ color: colors.label, fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepVal}>{fmtDistance(cs.distanceKm ?? 0)}</Text>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { distanceKm: Math.round(((cs.distanceKm ?? 0) + 0.5) * 10) / 10 } }); }}>
              <Text style={{ color: colors.label, fontSize: 20 }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* RPE selector */}
      {cs && (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.labelTertiary, fontSize: 10, fontFamily: "Outfit_300Light", letterSpacing: 2, marginBottom: 8 }}>RPE</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {[1,2,3,4,5,6,7,8,9,10].map((v) => (
              <Pressable key={v} onPress={() => { selectionAsync(); dispatch({ type: "SET_CARDIO", exId, patch: { rpe: v } }); }}
                style={{ flex: 1, height: 34, borderRadius: 4, alignItems: "center", justifyContent: "center",
                  backgroundColor: cs.rpe === v ? colors.accent : colors.fillSecondary }}>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_400Regular", color: cs.rpe === v ? "#FFF" : colors.labelSecondary }}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Log button */}
      <TouchableOpacity onPress={handleLog}
        style={{ backgroundColor: cs?.isLogged ? colors.accentGreen : colors.accent, paddingVertical: 14, borderRadius: 4, alignItems: "center" }}>
        <Text style={{ color: "#FFF", fontFamily: "Outfit_400Regular", fontSize: 15 }}>
          {cs?.isLogged ? "✓ LOGGED" : "LOG SESSION"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function CardioExCardWithSuggestion({ se, exId, cardioState, dispatch, workoutId, userId, weekNumber, onDelete }: {
  se: any; exId: string; cardioState: LocalCardioState | undefined;
  dispatch: React.Dispatch<Action>; workoutId: Id<"workouts"> | null;
  userId: Id<"users"> | null; weekNumber: number; onDelete: (scope: "today" | "meso") => void;
}) {
  const suggestion = useQuery(
    api.overload.getCardioSuggestion,
    userId ? { userId, exerciseId: se.exerciseId, weekNumber } : "skip"
  );
  return (
    <CardioExCard se={se} exId={exId} cardioState={cardioState} suggestion={suggestion}
      dispatch={dispatch} workoutId={workoutId} userId={userId} onDelete={onDelete} />
  );
}

// ─── NumPad ───────────────────────────────────────────────────────────────────

function NumPad({ onKey, colors }: { onKey: (k: string) => void; colors: any }) {
  return (
    <View style={styles.numGrid}>
      {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((k) => (
        <TouchableOpacity key={k} style={[styles.numKey, { backgroundColor: colors.backgroundTertiary }]}
          onPress={() => { impactLight(); onKey(k); }} activeOpacity={0.55}>
          <Text style={{ fontSize: 20, fontFamily: "Outfit_400Regular", color: colors.label }}>{k}</Text>
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
  const removeExMut = useMutation(api.mesocycles.removeExerciseFromSession);
  const removeExByIdsMut = useMutation(api.mesocycles.removeExerciseByIds);
  const addExToSessionMut = useMutation(api.mesocycles.addExerciseToSession);

  // id === "new" means fresh start via /workout/new?sessionId=xxx — treat as null
  const existingWorkoutId = id && id !== "new" ? (id as Id<"workouts">) : null;

  const [state, dispatch] = useReducer(reducer, {
    workoutId: existingWorkoutId,
    exStates: {}, cardioStates: {}, hiddenExIds: [], extraExercises: [],
    activeCell: null, numpadVal: "0",
    restVisible: false, feedbackVisible: false, startTime: Date.now(),
    swapOverrides: {},
  });

  const [addExSheetVisible, setAddExSheetVisible] = useState(false);

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
    if (!sessionExs || !(sessionExs as any[]).length) return false;
    return (sessionExs as any[]).every((se: any) => {
      const exId = se.exercise._id as string;
      if (se.exercise.category === "cardio") {
        return state.cardioStates[exId]?.isLogged ?? false;
      }
      const ex = state.exStates[exId];
      return ex && ex.sets.length > 0 && ex.sets.every((s) => s.isLogged);
    });
  }, [state.exStates, state.cardioStates, sessionExs]);

  const handleFinish = async () => {
    if (!wid) return;
    notificationSuccess();
    await completeMut({ workoutId: wid, durationMs: Date.now() - state.startTime });
    dispatch({ type: "SHOW_FB" });
  };

  const handleDeleteExercise = async (exId: string, seId: Id<"sessionExercises"> | null, scope: "today" | "meso") => {
    dispatch({ type: "HIDE_EX", exId });
    if (scope !== "meso") return;
    if (seId) {
      await removeExMut({ sessionExerciseId: seId });
    } else if (resolvedSessionId) {
      // Legacy session or extra exercise that was persisted — delete by sessionId + exerciseId
      await removeExByIdsMut({ sessionId: resolvedSessionId, exerciseId: exId as Id<"exercises"> });
    }
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
            <Text style={{ fontFamily: "Outfit_300Light", color: colors.labelSecondary, fontSize: 11, letterSpacing: 1 }}>{meso?.name?.toUpperCase() ?? "WORKOUT"}</Text>
            <Text style={{ fontFamily: "Outfit_400Regular", color: "#FFF", fontSize: 16, marginTop: 2, letterSpacing: -0.2 }}>WEEK {weekNumber}  DAY {dayNum}  {weekday}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {allLogged ? (
              <TouchableOpacity style={[styles.finishPill, { backgroundColor: colors.accentGreen }]} onPress={handleFinish}>
                <Text style={{ color: "#FFF", fontFamily: "Outfit_400Regular", fontSize: 13 }}>FINISH ✓</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: colors.labelTertiary, fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Scroll */}
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false} automaticallyAdjustsScrollIndicatorInsets={false}>
        {!sessionExs && <View style={{ alignItems: "center", paddingTop: 80 }}><Text style={{ color: colors.labelSecondary }}>Loading…</Text></View>}

        {/* Session exercises (planned) */}
        {(sessionExs as any[] | undefined)?.filter((se: any) => !state.hiddenExIds.includes(se.exercise._id as string)).map((se: any) => {
          const oldExId = se.exercise._id as string;
          const override = state.swapOverrides[oldExId];
          const effectiveSe = override
            ? { ...se, exerciseId: override.exerciseId, exercise: { ...se.exercise, ...override.exercise } }
            : se;
          const seId: Id<"sessionExercises"> | null = se.isLegacy ? null : se._id;

          if (effectiveSe.exercise?.category === "cardio") {
            return (
              <CardioExCardWithSuggestion
                key={se._id ?? se.exerciseId}
                se={effectiveSe}
                exId={oldExId}
                cardioState={state.cardioStates[oldExId]}
                dispatch={dispatch}
                workoutId={wid}
                userId={userId ?? null}
                weekNumber={weekNumber}
                onDelete={(scope) => handleDeleteExercise(oldExId, seId, scope)}
              />
            );
          }

          return (
            <ExCardWithSuggestion
              key={se._id ?? se.exerciseId}
              se={effectiveSe}
              originalExId={oldExId}
              exState={state.exStates[oldExId]}
              activeCell={state.activeCell}
              dispatch={dispatch}
              workoutId={wid}
              userId={userId ?? null}
              weekNumber={weekNumber}
              mesoId={meso?._id ?? null}
              onOpenSwap={() => setSwapTarget({ seId, exercise: se.exercise, oldExId })}
              onOpenVideo={() => {
                const vid = getVideoId(effectiveSe.exercise?.name ?? "");
                if (vid) setVideoTarget({ name: effectiveSe.exercise?.name ?? "", videoId: vid });
              }}
              onDelete={(scope) => handleDeleteExercise(oldExId, seId, scope)}
            />
          );
        })}

        {/* Extra exercises added during this workout — hide once sessionExs picks them up */}
        {state.extraExercises.filter((ex) => {
          if (state.hiddenExIds.includes(ex._id as string)) return false;
          // Already reflected in the live session query — don't double-render
          if ((sessionExs as any[] | undefined)?.some((se: any) => (se.exercise._id as string) === (ex._id as string))) return false;
          return true;
        }).map((ex) => {
          const exId = ex._id as string;
          const fakeSe = {
            exerciseId: ex._id,
            exercise: { _id: ex._id, name: ex.name, muscleGroup: ex.muscleGroup, equipment: ex.equipment, sfr: ex.sfr, category: ex.category, cardioMode: ex.cardioMode },
            repRangeMin: 8, repRangeMax: 12, targetSets: 3, setType: "regular" as const, isLegacy: true,
          };
          if (ex.category === "cardio") {
            return (
              <CardioExCardWithSuggestion
                key={`extra-${exId}`}
                se={fakeSe}
                exId={exId}
                cardioState={state.cardioStates[exId]}
                dispatch={dispatch}
                workoutId={wid}
                userId={userId ?? null}
                weekNumber={weekNumber}
                onDelete={(scope) => handleDeleteExercise(exId, ex.seId, scope)}
              />
            );
          }
          return (
            <ExCardWithSuggestion
              key={`extra-${exId}`}
              se={fakeSe}
              originalExId={exId}
              exState={state.exStates[exId]}
              activeCell={state.activeCell}
              dispatch={dispatch}
              workoutId={wid}
              userId={userId ?? null}
              weekNumber={weekNumber}
              mesoId={meso?._id ?? null}
              onOpenSwap={() => {}}
              onOpenVideo={() => {
                const vid = getVideoId(ex.name);
                if (vid) setVideoTarget({ name: ex.name, videoId: vid });
              }}
              onDelete={(scope) => handleDeleteExercise(exId, ex.seId, scope)}
            />
          );
        })}

        {/* Add Exercise button */}
        <TouchableOpacity
          onPress={() => { selectionAsync(); setAddExSheetVisible(true); }}
          style={[styles.addExBtn, { borderColor: colors.separator }]}
        >
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: colors.accent }}>+ Add Exercise</Text>
        </TouchableOpacity>

        {allLogged && (
          <TouchableOpacity style={[styles.finishBar, { backgroundColor: colors.accentGreen }]} onPress={handleFinish}>
            <Text style={{ color: "#FFF", fontSize: 17, fontFamily: "Outfit_400Regular" }}>Finish Workout ✓</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Numpad */}
      <Animated.View style={[styles.numWrap, { backgroundColor: colors.backgroundSecondary }, numStyle]}>
        <View style={[styles.numTop, { borderBottomColor: colors.separator }]}>
          <Text style={{ color: colors.labelSecondary, fontSize: 12, fontFamily: "Outfit_400Regular", letterSpacing: 0.8 }}>
            {state.activeCell?.field === "weight" ? "WEIGHT (kg)" : "REPS"}
          </Text>
          <Text style={{ color: colors.label, fontSize: 22, fontFamily: "Outfit_400Regular", marginLeft: 14, flex: 1 }}>{state.numpadVal}</Text>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.accent }]} onPress={() => dispatch({ type: "BLUR" })}>
            <Text style={{ color: "#FFF", fontFamily: "Outfit_400Regular" }}>Done</Text>
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
            <Text style={{ color: colors.labelTertiary, fontSize: 16 }}>✕</Text>
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

      {/* Add exercise sheet */}
      <AddExSheet
        visible={addExSheetVisible}
        onAdd={async (ex: PickedExercise) => {
          const exId = ex._id as string;
          // Show immediately
          dispatch({ type: "ADD_EXTRA_EX", exercise: { ...ex, seId: null } });
          // Persist to session so it appears on next visit
          if (resolvedSessionId) {
            const seId = await addExToSessionMut({
              sessionId: resolvedSessionId,
              exerciseId: ex._id,
              repRangeMin: 8,
              repRangeMax: 12,
              targetSets: 3,
            });
            dispatch({ type: "SET_EXTRA_SEID", exId, seId });
          }
        }}
        onClose={() => setAddExSheetVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerWrap: { paddingBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 4 },
  hSub: { fontSize: 11, letterSpacing: 1 },
  hTitle: { fontSize: 16, marginTop: 2 },
  finishPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 4 },
  card: { marginHorizontal: 12, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  badgeText: { color: "#FFF", fontSize: 11, fontFamily: "Outfit_400Regular", letterSpacing: 0.6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  repPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  targetBanner: { flexDirection: "row", alignItems: "center", borderRadius: 4, borderWidth: 1, padding: 12, marginBottom: 12 },
  tblHead: { flexDirection: "row", alignItems: "center", paddingBottom: 6, borderBottomWidth: 0.5, marginBottom: 2 },
  tblHdr: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Outfit_400Regular", letterSpacing: 0.6 },
  setRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 2, minHeight: 46, borderRadius: 6 },
  cell: { flex: 1, height: 40, borderRadius: 6, alignItems: "center", justifyContent: "center", marginHorizontal: 2 },
  cellNum: { fontSize: 17, fontFamily: "CormorantGaramond_300Light" },
  arrowCell: { width: 26, alignItems: "center", justifyContent: "center" },
  checkbox: { width: 34, height: 34, borderRadius: 4, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  setTypeRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 0.5, gap: 6, flexWrap: "wrap" },
  typePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  numWrap: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 10 },
  numTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  numGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  numKey: { width: "30%", height: 52, borderRadius: 4, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  restBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 28, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  finishBar: { marginHorizontal: 16, height: 56, borderRadius: 4, alignItems: "center", justifyContent: "center", marginTop: 8 },
  addExBtn: { marginHorizontal: 12, marginTop: 4, marginBottom: 8, paddingVertical: 14, borderRadius: 4, borderWidth: 1, borderStyle: "dashed", alignItems: "center" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  stepVal: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: "CormorantGaramond_300Light", color: "white" },
});
