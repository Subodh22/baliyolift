import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Estimated 1RM from a working set. Uses effective reps (reps + RIR) so sets
// left further from failure aren't undervalued, caps the rep count Epley sees
// (it grows wildly inaccurate past ~12 reps, and half this app's ranges reach
// 15–20), and returns 0 for weightless bodyweight sets, which have no
// meaningful 1RM.
function estimated1RM(weight: number, reps: number, rir = 0): number {
  if (weight <= 0) return 0;
  const effectiveReps = Math.min(reps + rir, 12);
  return weight * (1 + effectiveReps / 30);
}

export const logSet = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.id("exercises"),
    userId: v.id("users"),
    weight: v.number(),
    reps: v.number(),
    rir: v.number(),
    targetRir: v.optional(v.number()),
    setNumber: v.number(),
    isWarmup: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const setId = await ctx.db.insert("sets", {
      workoutId: args.workoutId,
      exerciseId: args.exerciseId,
      userId: args.userId,
      weight: args.weight,
      reps: args.reps,
      rir: args.rir,
      targetRir: args.targetRir,
      setNumber: args.setNumber,
      timestamp: Date.now(),
      isWarmup: args.isWarmup,
      notes: args.notes,
    });

    return setId;
  },
});

export const deleteSet = mutation({
  args: {
    setId: v.id("sets"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.setId);
  },
});

export const getByWorkout = query({
  args: {
    workoutId: v.id("workouts"),
  },
  handler: async (ctx, args) => {
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.workoutId))
      .collect();

    return sets.sort((a, b) => a.setNumber - b.setNumber);
  },
});

export const getPersonalBest = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
  },
  handler: async (ctx, args) => {
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isWarmup"), false))
      .collect();

    if (sets.length === 0) return null;

    // Find set with highest estimated 1RM
    let best = sets[0];
    let bestE1RM = estimated1RM(best.weight, best.reps, best.rir);

    for (const set of sets) {
      const e1rm = estimated1RM(set.weight, set.reps, set.rir);
      if (e1rm > bestE1RM) {
        best = set;
        bestE1RM = e1rm;
      }
    }

    return {
      ...best,
      estimated1RM: bestE1RM,
    };
  },
});

export const getProgressionHistory = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all working sets for this user + exercise, most recent first
    const allSets = await ctx.db
      .query("sets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isWarmup"), false))
      .order("desc")
      .collect();

    // Group by workoutId
    const workoutMap = new Map<
      string,
      { sets: typeof allSets; workoutId: string }
    >();

    for (const set of allSets) {
      const key = set.workoutId as string;
      if (!workoutMap.has(key)) {
        workoutMap.set(key, { sets: [], workoutId: key });
      }
      workoutMap.get(key)!.sets.push(set);
    }

    // Take only the last N distinct workouts
    const workoutEntries = Array.from(workoutMap.values()).slice(0, args.limit);

    // Build result
    const results = await Promise.all(
      workoutEntries.map(async ({ workoutId, sets }) => {
        const workout = await ctx.db.get(workoutId as Id<"workouts">);
        const totalVolume = sets.reduce(
          (sum, s) => sum + s.weight * s.reps,
          0
        );
        const avgWeight =
          sets.reduce((sum, s) => sum + s.weight, 0) / sets.length;
        const avgReps =
          sets.reduce((sum, s) => sum + s.reps, 0) / sets.length;
        const avgRIR =
          sets.reduce((sum, s) => sum + s.rir, 0) / sets.length;

        return {
          workoutId,
          date: workout?.date ?? 0,
          weekNumber: workout?.weekNumber ?? 0,
          setCount: sets.length,
          avgWeight: Math.round(avgWeight * 10) / 10,
          avgReps: Math.round(avgReps * 10) / 10,
          avgRIR: Math.round(avgRIR * 10) / 10,
          totalVolume: Math.round(totalVolume),
          bestE1RM: Math.max(
            ...sets.map((s) => estimated1RM(s.weight, s.reps, s.rir))
          ),
        };
      })
    );

    // Sort by date descending (most recent first)
    results.sort((a, b) => b.date - a.date);

    return results;
  },
});
