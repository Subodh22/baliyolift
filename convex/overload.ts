import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  PER_EXERCISE_SET_CAP,
  e1rm,
  isDeloadWeek,
  nextWeight,
  roundToStep,
  setDelta,
  stepForEquipment,
  targetRirForWeek,
} from "./overloadMath";

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getSuggestionV2 = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    mesocycleId: v.id("mesocycles"),
    sessionId: v.optional(v.id("sessions")),
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

    // --- Volume: RP per-exercise set progression ---
    // Like the RP app: each exercise keeps its OWN set count, seeded from its
    // programmed targetSets. Feedback is judged per MUSCLE, and the sets the
    // muscle earns each week are added to individual exercises (fewest-first,
    // so they stay balanced but a compound can carry more than an isolation).
    // The session's muscle total is ceilinged at MRV / weekly-frequency and
    // each exercise at a hard cap, so volume climbs toward MRV only when
    // recovery feedback allows — never dumping a week's MRV into one session.
    const exercise = await ctx.db.get(args.exerciseId);
    let suggestedSets = baseSets;
    if (exercise && meso) {
      const muscle = exercise.muscleGroup;
      const volTarget = meso.volumeTargets.find((t) => t.muscleGroup === muscle);

      // Muscle → session-day map for the whole meso (for weekly frequency).
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
      const trainsMuscle = (s: { exerciseIds: unknown[] }) =>
        s.exerciseIds.some((id) => mgById.get(id as string) === muscle);
      const freq = Math.max(1, sessions.filter(trainsMuscle).length);

      // This session's exercises for the muscle, ordered, each seeded from its
      // programmed targetSets. Falls back to a single virtual slot when we have
      // no sessionId (e.g. an exercise added ad hoc outside the session plan).
      const sessionExs = args.sessionId
        ? await ctx.db
            .query("sessionExercises")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId!))
            .collect()
        : [];
      let muscleSlots = sessionExs
        .filter((se) => mgById.get(se.exerciseId as string) === muscle)
        .sort((a, b) => a.order - b.order)
        .map((se) => ({ exerciseId: se.exerciseId as string, seed: Math.max(1, se.targetSets) }));
      let thisIdx = muscleSlots.findIndex((s) => s.exerciseId === (args.exerciseId as string));
      if (thisIdx < 0) {
        // Not in the stored plan — treat this exercise as its own slot.
        muscleSlots = [{ exerciseId: args.exerciseId as string, seed: Math.max(1, baseSets) }];
        thisIdx = 0;
      }

      // Session-total ceiling from the muscle's MRV, shared across the days that
      // train it. Falls back to seed-sum + headroom when there's no landmark.
      const seedSum = muscleSlots.reduce((a, s) => a + s.seed, 0);
      const mrvSession = volTarget
        ? Math.max(seedSum, Math.ceil(volTarget.mrv / freq))
        : seedSum + 3;

      const counts = muscleSlots.map((s) => s.seed);
      if (deloadWeek) {
        // Recovery: roughly half each exercise's programmed sets.
        for (let i = 0; i < counts.length; i++) counts[i] = Math.max(1, Math.round(muscleSlots[i].seed / 2));
      } else {
        // Per-week muscle feedback, keyed to this session-day's workouts.
        const workoutByWeek = new Map<number, string>();
        for (const w of mesoWorkouts) {
          if ((w.sessionId as string) === (args.sessionId as string)) workoutByWeek.set(w.weekNumber, w._id as string);
        }
        const fbByWorkout = new Map<string, { soreness: number; pump: number; workload: number }>();
        const muscleFeedback = await ctx.db
          .query("sessionFeedback")
          .withIndex("by_user_muscle", (q) => q.eq("userId", args.userId).eq("muscleGroup", muscle))
          .order("desc")
          .take(50);
        for (const f of muscleFeedback) {
          if (mesoWorkoutIds.has(f.workoutId as string)) {
            fbByWorkout.set(f.workoutId as string, { soreness: f.soreness, pump: f.pump, workload: f.workload });
          }
        }
        const sum = () => counts.reduce((a, c) => a + c, 0);
        for (let wk = 1; wk < args.weekNumber; wk++) {
          const wid = workoutByWeek.get(wk);
          if (!wid) continue; // session not trained that week — no progression
          const fb = fbByWorkout.get(wid);
          // Session done but not rated → neutral +1 ("recovered on time").
          let delta = fb ? setDelta(fb.soreness, fb.pump, fb.workload) : 1;
          while (delta > 0 && sum() < mrvSession) {
            // Add to the exercise with the fewest sets that's under its cap.
            let target = -1;
            for (let i = 0; i < counts.length; i++) {
              if (counts[i] >= PER_EXERCISE_SET_CAP) continue;
              if (target < 0 || counts[i] < counts[target]) target = i;
            }
            if (target < 0) break; // all exercises capped
            counts[target]++;
            delta--;
          }
          while (delta < 0) {
            // Remove from the exercise with the most sets (never below 1).
            let target = -1;
            for (let i = 0; i < counts.length; i++) {
              if (counts[i] <= 1) continue;
              if (target < 0 || counts[i] > counts[target]) target = i;
            }
            if (target < 0) break;
            counts[target]--;
            delta++;
          }
        }
      }

      suggestedSets = Math.max(1, Math.min(PER_EXERCISE_SET_CAP, counts[thisIdx]));
    }

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
    // Recovery week: ~60% load, half the sets, well shy of failure. This
    // replaces the old reactive "2 sessions at 0 RIR" detector, which could
    // never fire while RIR was hardcoded.
    if (deloadWeek) {
      const deloadWeight = lastWeight > 0 ? roundToStep(lastWeight * 0.6, step) : lastWeight;
      return {
        suggestedWeight: deloadWeight > 0 ? deloadWeight : null,
        suggestedReps: args.repRangeMin,
        suggestedSets,
        targetRir,
        overloadIndicator: "decrease" as const,
        reason: `Deload week — ~60% load, half the sets, keep ${targetRir}+ RIR to recover.`,
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
