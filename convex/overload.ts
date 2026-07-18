import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Round to nearest step. */
function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Smallest sensible load increment for a given equipment type (kg). */
function stepForEquipment(equipment?: string | null): number {
  switch (equipment) {
    case "dumbbell": return 1;   // small dumbbells / micro-loading
    case "bodyweight": return 1; // added load, when any
    default: return 2.5;         // barbell (1.25/side), cable, machine, other
  }
}

/**
 * Next working weight — ~2.5% progression, snapped up to at least one equipment
 * step. Percent-based so light isolation work and heavy compounds both advance
 * sensibly, and rounded to the equipment step so sub-20 kg loads actually move
 * (the old `+1 then round-to-2.5` snapped straight back).
 */
function nextWeight(current: number, equipment?: string | null): number {
  const step = stepForEquipment(equipment);
  const inc = Math.max(step, roundToStep(current * 0.025, step));
  return roundToStep(current + inc, step);
}

/** Estimated 1RM (Epley) — used only to pick the best working set as reference. */
function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

const START_RIR = 3;

/**
 * The final week of a multi-week mesocycle is a programmed deload.
 * (A 1-week meso has no deload.)
 */
function isDeloadWeek(weekNumber: number, totalWeeks: number): boolean {
  return totalWeeks > 1 && weekNumber >= totalWeeks;
}

/**
 * Week-based target RIR — RP mesocycle progression scaled to the meso length.
 * RIR ramps from START_RIR (most reserve) down to 0 (near failure) across the
 * training weeks, then the final week deloads at a high RIR. Interpolating on
 * `totalWeeks` means a 5- or 6-week meso no longer grinds at failure for its
 * last weeks the way a hardcoded 4-week ramp did.
 */
function targetRirForWeek(weekNumber: number, totalWeeks: number): number {
  if (isDeloadWeek(weekNumber, totalWeeks)) return 4; // deload — stay well shy of failure
  const trainingWeeks = totalWeeks > 1 ? totalWeeks - 1 : totalWeeks;
  if (trainingWeeks <= 1) return START_RIR;
  const w = Math.min(Math.max(weekNumber, 1), trainingWeeks);
  return Math.round(START_RIR * (1 - (w - 1) / (trainingWeeks - 1)));
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Per-exercise set ramp used when the mesocycle has no volume landmark for the
 * muscle (fallback only): week 1 = targetSets, +1 per training week capped at
 * +3, deload week ≈ half.
 */
function rampSetsForWeek(weekNumber: number, totalWeeks: number, targetSets: number): number {
  if (isDeloadWeek(weekNumber, totalWeeks)) {
    return Math.max(1, Math.ceil(targetSets / 2));
  }
  const trainingWeeks = totalWeeks > 1 ? totalWeeks - 1 : totalWeeks;
  const maxAdded = Math.min(3, Math.max(trainingWeeks - 1, 0));
  return targetSets + Math.min(Math.max(weekNumber - 1, 0), maxAdded);
}

/**
 * Weekly per-muscle set budget from the mesocycle's RP landmarks: ramps
 * MEV (week 1) → MRV (last training week) so the volume reference line is
 * week-dependent, and deloads to ~half MEV on the final week. This is the
 * whole-week target for the muscle; it gets split across the muscle's
 * exercises by the caller so per-muscle weekly sets stay ≤ MRV.
 */
function muscleWeeklyBudget(
  target: { mev: number; mrv: number },
  weekNumber: number,
  totalWeeks: number
): number {
  if (isDeloadWeek(weekNumber, totalWeeks)) return Math.max(1, Math.round(target.mev / 2));
  const trainingWeeks = totalWeeks > 1 ? totalWeeks - 1 : totalWeeks;
  const frac = trainingWeeks <= 1 ? 1 : Math.min(1, Math.max(0, (weekNumber - 1) / (trainingWeeks - 1)));
  return Math.round(target.mev + (target.mrv - target.mev) * frac);
}

/**
 * Feedback adjusts volume only (never load), applied exactly once:
 * too much workload or still-sore → pull a set; everything easy → add one.
 */
function applyFeedbackToSets(sets: number, feedbackWorkload?: number, feedbackSoreness?: number): number {
  let s = sets;
  if (feedbackWorkload === 3) s -= 1;
  if (feedbackSoreness === 3) s -= 1;
  if (feedbackWorkload === 0 && feedbackSoreness === 0) s += 1;
  return Math.max(1, s);
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
    const meso = await ctx.db.get(args.mesocycleId);
    const totalWeeks = meso?.weeks ?? 4;
    const targetRir = targetRirForWeek(args.weekNumber, totalWeeks);
    const deloadWeek = isDeloadWeek(args.weekNumber, totalWeeks);
    const baseSets = args.targetSets ?? 3;

    // Workouts belonging to the current mesocycle — used to scope both history
    // and feedback so a stale session from a previous meso (different rep range,
    // months old) can't silently drive today's suggestion.
    const mesoWorkouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("mesocycleId"), args.mesocycleId))
      .collect();
    const mesoWorkoutIds = new Set(mesoWorkouts.map((w) => w._id as string));

    // Bounded recent history for this exercise (most recent first).
    const recentSets = await ctx.db
      .query("sets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isWarmup"), false))
      .order("desc")
      .take(50);

    // Prefer this meso's sets; fall back to all-time only when the meso has no
    // data for this exercise yet (week 1 / first time performing it).
    const scoped = recentSets.filter((s) => mesoWorkoutIds.has(s.workoutId as string));
    const usableSets = scoped.length > 0 ? scoped : recentSets;

    // --- Feedback for this muscle group, scoped to the current meso ---
    const exercise = await ctx.db.get(args.exerciseId);
    let feedbackWorkload: number | undefined;
    let feedbackSoreness: number | undefined;
    if (exercise) {
      const recentFeedback = await ctx.db
        .query("sessionFeedback")
        .withIndex("by_user_muscle", (q) =>
          q.eq("userId", args.userId).eq("muscleGroup", exercise.muscleGroup)
        )
        .order("desc")
        .take(10);
      // Most recent feedback for this muscle from within this mesocycle.
      const feedback = recentFeedback.find((f) => mesoWorkoutIds.has(f.workoutId as string));
      if (feedback) {
        feedbackWorkload = feedback.workload;
        feedbackSoreness = feedback.soreness;
      }
    }

    // --- Volume: budget per muscle group from the meso's RP landmarks ---
    // Ramp the muscle's weekly set target MEV→MRV, then split it across the
    // muscle's exercise slots in this meso so total weekly sets stay ≤ MRV.
    // Falls back to a per-exercise ramp when the meso has no landmark for the
    // muscle. Feedback is then applied to volume exactly once.
    let rampedSets = rampSetsForWeek(args.weekNumber, totalWeeks, baseSets);
    const volTarget = exercise
      ? meso?.volumeTargets.find((t) => t.muscleGroup === exercise.muscleGroup)
      : undefined;
    if (exercise && meso && volTarget) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_mesocycle", (q) => q.eq("mesocycleId", meso._id))
        .collect();
      const uniqueIds = [...new Set(sessions.flatMap((s) => s.exerciseIds.map((id) => id as string)))];
      const mgById = new Map<string, string>();
      await Promise.all(
        uniqueIds.map(async (id) => {
          const ex = await ctx.db.get(id as typeof args.exerciseId);
          if (ex) mgById.set(id, ex.muscleGroup);
        })
      );
      // Count occurrences (not distinct) so a muscle trained across multiple
      // sessions splits its weekly budget across every slot.
      let muscleSlots = 0;
      for (const s of sessions) {
        for (const id of s.exerciseIds) {
          if (mgById.get(id as string) === exercise.muscleGroup) muscleSlots++;
        }
      }
      const weekly = muscleWeeklyBudget(volTarget, args.weekNumber, totalWeeks);
      rampedSets = Math.max(1, Math.round(weekly / Math.max(1, muscleSlots)));
    }
    const suggestedSets = applyFeedbackToSets(rampedSets, feedbackWorkload, feedbackSoreness);

    if (usableSets.length === 0) {
      return {
        suggestedWeight: null,
        suggestedReps: args.repRangeMin,
        suggestedSets,
        targetRir,
        overloadIndicator: "maintain" as const,
        reason: "No history — start with a comfortable weight.",
        lastSession: null,
        deloadFlag: deloadWeek,
      };
    }

    // Group by workoutId → distinct sessions (most recent first).
    const workoutMap = new Map<string, typeof usableSets>();
    for (const set of usableSets) {
      const key = set.workoutId as string;
      if (!workoutMap.has(key)) workoutMap.set(key, []);
      workoutMap.get(key)!.push(set);
    }

    const sessions = Array.from(workoutMap.values());
    const lastSession = sessions[0];

    // Reference = the best working set of the session (highest e1RM), not the
    // last set. The last set is the most fatigued, so keying progression off it
    // systematically under-progresses.
    const topSet = lastSession.reduce((best, s) =>
      e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps) ? s : best
    );

    const lastWeight = topSet.weight;
    const lastReps = topSet.reps;
    const lastRir = topSet.rir;
    const step = stepForEquipment(exercise?.equipment);

    const lastSessionSummary = { weight: lastWeight, reps: lastReps, rir: lastRir };

    // --- Programmed deload week ---
    // Recovery week: ~90% load, half the sets, well shy of failure. This
    // replaces the old reactive "2 sessions at 0 RIR" detector, which could
    // never fire while RIR was hardcoded.
    if (deloadWeek) {
      const deloadWeight = lastWeight > 0 ? roundToStep(lastWeight * 0.9, step) : lastWeight;
      return {
        suggestedWeight: deloadWeight > 0 ? deloadWeight : null,
        suggestedReps: args.repRangeMin,
        suggestedSets,
        targetRir,
        overloadIndicator: "decrease" as const,
        reason: `Deload week — ~90% load, half the sets, keep ${targetRir}+ RIR to recover.`,
        lastSession: lastSessionSummary,
        deloadFlag: true,
      };
    }

    // --- Double Progression Algorithm ---
    // Feedback never touches load here — it only adjusts volume (suggestedSets),
    // applied exactly once above.
    if (lastReps < args.repRangeMin) {
      return {
        suggestedWeight: lastWeight > 0 ? Math.max(step, roundToStep(lastWeight * 0.95, step)) : null,
        suggestedReps: args.repRangeMin,
        suggestedSets,
        targetRir,
        overloadIndicator: "decrease" as const,
        reason: `${lastReps} reps below range (${args.repRangeMin}–${args.repRangeMax}). Reduce weight to hit target reps.`,
        lastSession: lastSessionSummary,
        deloadFlag: false,
      };
    }

    if (lastReps >= args.repRangeMax && lastRir <= targetRir) {
      return {
        suggestedWeight: lastWeight > 0 ? nextWeight(lastWeight, exercise?.equipment) : null,
        suggestedReps: args.repRangeMin,
        suggestedSets,
        targetRir,
        overloadIndicator: "increase" as const,
        reason: `Hit ${lastReps} reps at RIR ${lastRir} — top of range. Add weight, reset to ${args.repRangeMin} reps.`,
        lastSession: lastSessionSummary,
        deloadFlag: false,
      };
    }

    if (lastReps < args.repRangeMax && lastRir > targetRir) {
      return {
        suggestedWeight: lastWeight > 0 ? roundToStep(lastWeight, step) : null,
        suggestedReps: Math.min(lastReps + 1, args.repRangeMax),
        suggestedSets,
        targetRir,
        overloadIndicator: "add_rep" as const,
        reason: `RIR ${lastRir} > target ${targetRir}. Same weight, push for +1 rep.`,
        lastSession: lastSessionSummary,
        deloadFlag: false,
      };
    }

    return {
      suggestedWeight: lastWeight > 0 ? roundToStep(lastWeight, step) : null,
      suggestedReps: lastReps,
      suggestedSets,
      targetRir,
      overloadIndicator: "maintain" as const,
      reason: `${lastReps} reps at RIR ${lastRir} — on track. Match this session.`,
      lastSession: lastSessionSummary,
      deloadFlag: false,
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
    totalWeeks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const deloadWeek = args.totalWeeks != null && args.totalWeeks > 1 && args.weekNumber >= args.totalWeeks;
    const targetRpe = deloadWeek ? 5 : args.weekNumber <= 1 ? 6 : args.weekNumber === 2 ? 7 : 8;

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

    if (deloadWeek) {
      const deloadDuration = Math.max(10 * 60, Math.round(lastDuration * 0.5 / 60) * 60);
      return {
        suggestedDurationSec: deloadDuration,
        suggestedDistanceM: lastDistance != null ? Math.round(lastDistance * 0.5) : null,
        suggestedIntervalCount: last.intervalCount != null ? Math.max(1, Math.ceil(last.intervalCount / 2)) : null,
        suggestedIntervalWorkSec: last.intervalWorkSec ?? null,
        suggestedIntervalRestSec: last.intervalRestSec ?? null,
        targetRpe,
        overloadIndicator: "decrease" as const,
        reason: "Deload week — cut cardio volume about in half and keep effort easy.",
        lastSession: { durationSec: lastDuration, distanceM: lastDistance, intervalCount: last.intervalCount ?? null, rpe: lastRpe },
      };
    }

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
