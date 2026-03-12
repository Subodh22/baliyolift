import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Round to nearest increment (default 2.5 kg) */
function roundToIncrement(value: number, increment = 2.5): number {
  return Math.round(value / increment) * increment;
}

/**
 * Week-based target RIR — Dr. Mike Israetel's RP mesocycle progression:
 * Week 1 = highest RIR (most reserve), final week = 0 RIR (near failure).
 * This creates a gradual fatigue accumulation across the meso.
 */
function targetRirForWeek(weekNumber: number, totalWeeks = 4): number {
  if (weekNumber <= 1) return 3;
  if (weekNumber === 2) return 2;
  if (weekNumber === 3) return 1;
  return 0; // week 4+
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Core progressive overload suggestion using RP double-progression + feedback.
 *
 * Algorithm (Dr. Mike Israetel / RP Hypertrophy methodology):
 * 1. Determine target RIR from week number (3/2/1/0)
 * 2. Fetch last working session's top set for this exercise
 * 3. Apply double-progression rules:
 *    - Rep range not full + RIR okay → add 1 rep (add_rep)
 *    - Rep range full AND RIR ≤ target → increase weight (increase)
 *    - Reps below range → decrease weight (decrease)
 *    - Within range at target RIR → maintain
 * 4. Apply feedback adjustments from last session's soreness/pump/workload
 * 5. Deload detection: week ≥ 4 AND 2 consecutive sessions at 0 RIR at low reps
 */
/**
 * RP set volume progression:
 * Week 1 = targetSets (MEV baseline)
 * Each subsequent week adds 1 set, capped at targetSets+3.
 * Feedback can suppress the addition (workload/soreness too high) or add an extra (everything easy).
 */
function suggestedSetsForWeek(
  weekNumber: number,
  targetSets: number,
  feedbackWorkload?: number,
  feedbackSoreness?: number
): number {
  const maxAdded = 3;
  let addedSets = Math.min(weekNumber - 1, maxAdded);
  // Too much workload → don't add this week
  if (feedbackWorkload === 3) addedSets = Math.max(addedSets - 1, 0);
  // Still sore → pull back one set
  if (feedbackSoreness === 3) addedSets = Math.max(addedSets - 1, 0);
  // Too easy → bonus set
  if (feedbackWorkload === 0 && feedbackSoreness === 0 && addedSets < maxAdded) addedSets += 1;
  return targetSets + addedSets;
}

export const getSuggestionV2 = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    mesocycleId: v.id("mesocycles"),
    weekNumber: v.number(),
    repRangeMin: v.number(),
    repRangeMax: v.number(),
    targetSets: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const targetRir = targetRirForWeek(args.weekNumber);
    const baseSets = args.targetSets ?? 3;

    // --- Fetch last 2 sessions' sets for this exercise ---
    const allSets = await ctx.db
      .query("sets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isWarmup"), false))
      .order("desc")
      .collect();

    if (allSets.length === 0) {
      return {
        suggestedWeight: null,
        suggestedReps: args.repRangeMin,
        suggestedSets: suggestedSetsForWeek(args.weekNumber, baseSets),
        targetRir,
        overloadIndicator: "maintain" as const,
        reason: "No history — start with a comfortable weight.",
        lastSession: null,
        deloadFlag: false,
      };
    }

    // Group by workoutId → distinct sessions (most recent first)
    const workoutMap = new Map<string, typeof allSets>();
    for (const set of allSets) {
      const key = set.workoutId as string;
      if (!workoutMap.has(key)) workoutMap.set(key, []);
      workoutMap.get(key)!.push(set);
    }

    const sessions = Array.from(workoutMap.values());
    const lastSession = sessions[0];
    const prevSession = sessions[1] ?? null;

    // Top set = highest setNumber (last working set) in that session
    const topSet = lastSession.reduce((best, s) =>
      s.setNumber > best.setNumber ? s : best
    );

    const lastWeight = topSet.weight;
    const lastReps = topSet.reps;
    const lastRir = topSet.rir;

    const lastSessionSummary = { weight: lastWeight, reps: lastReps, rir: lastRir };

    // --- Fetch feedback adjustment for this muscle group ---
    const exercise = await ctx.db.get(args.exerciseId);
    let weightMultiplier = 1.0;
    let volumeDelta = 0;
    let feedbackWorkload: number | undefined;
    let feedbackSoreness: number | undefined;

    if (exercise) {
      const feedback = await ctx.db
        .query("sessionFeedback")
        .withIndex("by_user_muscle", (q) =>
          q.eq("userId", args.userId).eq("muscleGroup", exercise.muscleGroup)
        )
        .order("desc")
        .first();

      if (feedback) {
        feedbackWorkload = feedback.workload;
        feedbackSoreness = feedback.soreness;
        if (feedback.soreness === 3) { weightMultiplier *= 0.95; volumeDelta = -1; }
        if (feedback.workload === 3) { weightMultiplier *= 0.95; volumeDelta = Math.min(volumeDelta, -1); }
        if (feedback.workload === 0 && feedback.soreness === 0) { weightMultiplier *= 1.05; volumeDelta = 1; }
      }
    }

    const suggestedSets = suggestedSetsForWeek(args.weekNumber, baseSets, feedbackWorkload, feedbackSoreness);

    // --- Deload detection ---
    let deloadFlag = false;
    if (args.weekNumber >= 4 && prevSession) {
      const prevTop = prevSession.reduce((best, s) =>
        s.setNumber > best.setNumber ? s : best
      );
      if (
        topSet.rir === 0 && topSet.reps <= args.repRangeMin &&
        prevTop.rir === 0 && prevTop.reps <= args.repRangeMin
      ) {
        deloadFlag = true;
      }
    }

    // --- Double Progression Algorithm ---
    if (lastReps < args.repRangeMin) {
      return {
        suggestedWeight: Math.max(roundToIncrement(lastWeight * 0.95 * weightMultiplier), 2.5),
        suggestedReps: args.repRangeMin,
        suggestedSets,
        targetRir,
        overloadIndicator: "decrease" as const,
        reason: `${lastReps} reps below range (${args.repRangeMin}–${args.repRangeMax}). Reduce weight to hit target reps.`,
        lastSession: lastSessionSummary,
        deloadFlag,
        volumeDelta,
      };
    }

    if (lastReps >= args.repRangeMax && lastRir <= targetRir) {
      const increase = lastWeight < 20 ? 1 : 2.5;
      return {
        suggestedWeight: roundToIncrement(lastWeight * weightMultiplier + increase),
        suggestedReps: args.repRangeMin,
        suggestedSets,
        targetRir,
        overloadIndicator: "increase" as const,
        reason: `Hit ${lastReps} reps at RIR ${lastRir} — top of range. Add weight, reset to ${args.repRangeMin} reps.`,
        lastSession: lastSessionSummary,
        deloadFlag,
        volumeDelta,
      };
    }

    if (lastReps < args.repRangeMax && lastRir > targetRir) {
      return {
        suggestedWeight: roundToIncrement(lastWeight * weightMultiplier),
        suggestedReps: Math.min(lastReps + 1, args.repRangeMax),
        suggestedSets,
        targetRir,
        overloadIndicator: "add_rep" as const,
        reason: `RIR ${lastRir} > target ${targetRir}. Same weight, push for +1 rep.`,
        lastSession: lastSessionSummary,
        deloadFlag,
        volumeDelta,
      };
    }

    return {
      suggestedWeight: roundToIncrement(lastWeight * weightMultiplier),
      suggestedReps: lastReps,
      suggestedSets,
      targetRir,
      overloadIndicator: "maintain" as const,
      reason: `${lastReps} reps at RIR ${lastRir} — on track. Match this session.`,
      lastSession: lastSessionSummary,
      deloadFlag,
      volumeDelta,
    };
  },
});

// ─── Cardio Suggestion ────────────────────────────────────────────────────────

/**
 * Progressive overload for cardio — duration-first, then pace/distance.
 *
 * Algorithm:
 * 1. Duration-first: if current duration < target duration → suggest +5 min
 * 2. Once target duration hit: suggest more distance (same time = faster pace)
 *    or maintain and reduce RPE target
 * 3. RPE target increases each week: 6 → 7 → 7 → 8
 * 4. Intervals: increase rounds each week (1 per week), then tighten rest
 */
export const getCardioSuggestion = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const targetRpe = args.weekNumber <= 1 ? 6 : args.weekNumber === 2 ? 7 : 8;

    const history = await ctx.db
      .query("cardioSets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("userId", args.userId)
      )
      .order("desc")
      .take(10);

    if (history.length === 0) {
      return {
        suggestedDurationSec: 20 * 60, // 20 min starting point
        suggestedDistanceM: null,
        suggestedIntervalCount: null,
        suggestedIntervalWorkSec: 30,
        suggestedIntervalRestSec: 60,
        targetRpe,
        overloadIndicator: "maintain" as const,
        reason: "No history — start with a comfortable duration.",
        lastSession: null,
      };
    }

    const last = history[0];
    const lastDuration = last.durationSec;
    const lastDistance = last.distanceM ?? null;
    const lastRpe = last.rpe;

    // Interval mode
    if (last.intervalCount != null) {
      const lastCount = last.intervalCount;
      const suggestedCount = lastRpe <= targetRpe ? lastCount + 1 : lastCount;
      return {
        suggestedDurationSec: lastDuration,
        suggestedDistanceM: null,
        suggestedIntervalCount: suggestedCount,
        suggestedIntervalWorkSec: last.intervalWorkSec ?? 30,
        suggestedIntervalRestSec: last.intervalRestSec ?? 60,
        targetRpe,
        overloadIndicator: suggestedCount > lastCount ? "increase" as const : "maintain" as const,
        reason: suggestedCount > lastCount
          ? `Hit RPE ${lastRpe} last session. Add 1 round.`
          : `RPE ${lastRpe} — maintain ${lastCount} rounds.`,
        lastSession: { durationSec: lastDuration, intervalCount: lastCount, rpe: lastRpe },
      };
    }

    // Duration-pace mode: progress by adding 5 min, then increase distance
    const TARGET_DURATION_MIN = 45;
    const targetDurationSec = TARGET_DURATION_MIN * 60;

    if (lastDuration < targetDurationSec) {
      const addSec = lastRpe <= targetRpe + 1 ? 5 * 60 : 0;
      return {
        suggestedDurationSec: lastDuration + addSec,
        suggestedDistanceM: lastDistance,
        suggestedIntervalCount: null,
        suggestedIntervalWorkSec: null,
        suggestedIntervalRestSec: null,
        targetRpe,
        overloadIndicator: addSec > 0 ? "increase" as const : "maintain" as const,
        reason: addSec > 0
          ? `Add 5 min — building toward ${TARGET_DURATION_MIN} min.`
          : `RPE ${lastRpe} too high. Hold duration, reduce effort.`,
        lastSession: { durationSec: lastDuration, distanceM: lastDistance, rpe: lastRpe },
      };
    }

    // At target duration — progress by increasing distance (faster pace)
    const distanceIncrease = lastDistance != null ? Math.round(lastDistance * 0.05) : null;
    const suggestedDistance = lastDistance != null && lastRpe <= targetRpe
      ? lastDistance + (distanceIncrease ?? 0)
      : lastDistance;
    const didIncrease = suggestedDistance != null && lastDistance != null && suggestedDistance > lastDistance;

    return {
      suggestedDurationSec: lastDuration,
      suggestedDistanceM: suggestedDistance,
      suggestedIntervalCount: null,
      suggestedIntervalWorkSec: null,
      suggestedIntervalRestSec: null,
      targetRpe,
      overloadIndicator: didIncrease ? "increase" as const : "maintain" as const,
      reason: didIncrease
        ? `Duration target met. Cover more ground in ${TARGET_DURATION_MIN} min.`
        : `Maintain pace — aim for RPE ${targetRpe}.`,
      lastSession: { durationSec: lastDuration, distanceM: lastDistance, rpe: lastRpe },
    };
  },
});

/**
 * Legacy query — kept for backward compat with any existing consumers.
 */
export const getSuggestion = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    mesocycleId: v.id("mesocycles"),
  },
  handler: async (ctx, args) => {
    const allSets = await ctx.db
      .query("sets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isWarmup"), false))
      .order("desc")
      .collect();

    if (allSets.length === 0) {
      return { suggestedWeight: null, suggestedReps: null, hasData: false };
    }

    const recent = allSets.slice(0, 5);
    const avgWeight = recent.reduce((s, x) => s + x.weight, 0) / recent.length;
    const avgRir = recent.reduce((s, x) => s + x.rir, 0) / recent.length;
    const avgReps = recent.reduce((s, x) => s + x.reps, 0) / recent.length;

    return {
      suggestedWeight: avgRir > 2 ? avgWeight + 2.5 : avgWeight,
      suggestedReps: Math.round(avgReps),
      hasData: true,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Save post-workout feedback for all muscle groups trained.
 * One row per muscle group per workout.
 */
export const saveFeedback = mutation({
  args: {
    workoutId: v.id("workouts"),
    userId: v.id("users"),
    feedback: v.array(
      v.object({
        muscleGroup: v.string(),
        soreness: v.number(),
        pump: v.number(),
        workload: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.feedback) {
      await ctx.db.insert("sessionFeedback", {
        workoutId: args.workoutId,
        userId: args.userId,
        muscleGroup: item.muscleGroup,
        soreness: item.soreness,
        pump: item.pump,
        workload: item.workload,
      });
    }
  },
});

/**
 * Get the feedback adjustment multipliers for a muscle group.
 * Used to adjust weight/volume suggestions based on last session's feedback.
 */
export const getFeedbackAdjustments = query({
  args: {
    userId: v.id("users"),
    muscleGroup: v.string(),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db
      .query("sessionFeedback")
      .withIndex("by_user_muscle", (q) =>
        q.eq("userId", args.userId).eq("muscleGroup", args.muscleGroup)
      )
      .order("desc")
      .first();

    if (!feedback) return { weightMultiplier: 1.0, volumeDelta: 0 };

    let weightMultiplier = 1.0;
    let volumeDelta = 0;

    if (feedback.soreness === 3) { weightMultiplier *= 0.95; volumeDelta = -1; }
    if (feedback.workload === 3) { weightMultiplier *= 0.95; volumeDelta = Math.min(volumeDelta, -1); }
    if (feedback.workload === 0 && feedback.soreness === 0) { weightMultiplier = 1.05; volumeDelta = 1; }

    return { weightMultiplier, volumeDelta };
  },
});
