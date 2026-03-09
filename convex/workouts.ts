import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const startWorkout = mutation({
  args: {
    userId: v.id("users"),
    sessionId: v.id("sessions"),
    mesocycleId: v.id("mesocycles"),
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const workoutId = await ctx.db.insert("workouts", {
      userId: args.userId,
      sessionId: args.sessionId,
      mesocycleId: args.mesocycleId,
      date: Date.now(),
      weekNumber: args.weekNumber,
      status: "in_progress",
    });

    return workoutId;
  },
});

export const completeWorkout = mutation({
  args: {
    workoutId: v.id("workouts"),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workoutId, {
      status: "completed",
      durationMs: args.durationMs,
    });
  },
});

export const getTodaysWorkout = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Start of today in UTC (midnight)
    const now = Date.now();
    const startOfDay = now - (now % 86400000);
    const endOfDay = startOfDay + 86400000;

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("date", startOfDay)
      )
      .filter((q) => q.lt(q.field("date"), endOfDay))
      .order("desc")
      .first();

    return workouts;
  },
});

export const getWorkoutWithSets = query({
  args: {
    workoutId: v.id("workouts"),
  },
  handler: async (ctx, args) => {
    const workout = await ctx.db.get(args.workoutId);
    if (!workout) return null;

    const sets = await ctx.db
      .query("sets")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.workoutId))
      .collect();

    // Fetch exercise names
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
    const exerciseMap: Record<string, string> = {};

    for (const exId of exerciseIds) {
      const exercise = await ctx.db.get(exId);
      if (exercise) {
        exerciseMap[exId] = exercise.name;
      }
    }

    const setsWithNames = sets.map((s) => ({
      ...s,
      exerciseName: exerciseMap[s.exerciseId] ?? "Unknown",
    }));

    // Sort sets by setNumber
    setsWithNames.sort((a, b) => a.setNumber - b.setNumber);

    return { ...workout, sets: setsWithNames };
  },
});

export const getRecentByExercise = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get sets for this exercise by this user, most recent first
    const recentSets = await ctx.db
      .query("sets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("userId", args.userId)
      )
      .order("desc")
      .collect();

    // Group by workoutId to find distinct workouts
    const workoutIdsSeen = new Set<string>();
    const workoutIds: string[] = [];

    for (const s of recentSets) {
      if (!workoutIdsSeen.has(s.workoutId)) {
        workoutIdsSeen.add(s.workoutId);
        workoutIds.push(s.workoutId);
        if (workoutIds.length >= args.limit) break;
      }
    }

    // Fetch those workouts in insertion order (most recent first)
    const workouts = await Promise.all(
      workoutIds.map((id) => ctx.db.get(id as any))
    );

    return workouts.filter(Boolean);
  },
});

export const getWeeklyVolume = query({
  args: {
    userId: v.id("users"),
    mesocycleId: v.id("mesocycles"),
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Get volume targets from the mesocycle
    const mesocycle = await ctx.db.get(args.mesocycleId);
    if (!mesocycle) return [];

    // Get all workouts for this user in this mesocycle this week
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("mesocycleId"), args.mesocycleId),
          q.eq(q.field("weekNumber"), args.weekNumber),
          q.eq(q.field("status"), "completed")
        )
      )
      .collect();

    const workoutIds = workouts.map((w) => w._id);

    // Count working sets (non-warmup) per muscle group
    const muscleGroupSets: Record<string, number> = {};

    for (const workoutId of workoutIds) {
      const sets = await ctx.db
        .query("sets")
        .withIndex("by_workout", (q) => q.eq("workoutId", workoutId))
        .filter((q) => q.eq(q.field("isWarmup"), false))
        .collect();

      for (const set of sets) {
        const exercise = await ctx.db.get(set.exerciseId);
        if (exercise) {
          muscleGroupSets[exercise.muscleGroup] =
            (muscleGroupSets[exercise.muscleGroup] ?? 0) + 1;
        }
      }
    }

    // Build result with volume targets
    return mesocycle.volumeTargets.map((target) => ({
      muscleGroup: target.muscleGroup,
      sets: muscleGroupSets[target.muscleGroup] ?? 0,
      target: target.mav, // use MAV as the reference target
      mev: target.mev,
      mrv: target.mrv,
    }));
  },
});

export const getHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .order("desc")
      .take(limit);

    return await Promise.all(
      workouts.map(async (workout) => {
        const session = await ctx.db.get(workout.sessionId);

        const sets = await ctx.db
          .query("sets")
          .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
          .filter((q) => q.eq(q.field("isWarmup"), false))
          .collect();

        sets.sort((a, b) => a.setNumber - b.setNumber);

        // Group by exercise
        const exMap = new Map<string, { name: string; muscleGroup: string; sets: typeof sets }>();
        for (const s of sets) {
          const ex = await ctx.db.get(s.exerciseId);
          if (!ex) continue;
          const key = s.exerciseId as string;
          if (!exMap.has(key)) exMap.set(key, { name: ex.name, muscleGroup: ex.muscleGroup, sets: [] });
          exMap.get(key)!.sets.push(s);
        }

        const exercises = Array.from(exMap.values());

        return {
          ...workout,
          sessionName: session?.name ?? "Workout",
          exercises,
          durationMin: workout.durationMs ? Math.round(workout.durationMs / 60000) : null,
        };
      })
    );
  },
});
