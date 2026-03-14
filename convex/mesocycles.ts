import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const volumeTargetValidator = v.object({
  muscleGroup: v.string(),
  mev: v.number(),
  mav: v.number(),
  mrv: v.number(),
});

const sessionInputValidator = v.object({
  dayOfWeek: v.number(),
  name: v.string(),
  exerciseIds: v.array(v.id("exercises")),
  order: v.number(),
  muscleGroups: v.optional(v.array(v.string())),
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    weeks: v.number(),
    startDate: v.number(),
    volumeTargets: v.array(volumeTargetValidator),
    // Sessions to seed this mesocycle with (optional — caller may add later)
    sessions: v.optional(v.array(sessionInputValidator)),
  },
  handler: async (ctx, args) => {
    // Enforce one active meso at a time
    const existing = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (existing) await ctx.db.patch(existing._id, { status: "completed" });

    const mesocycleId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: args.name,
      startDate: args.startDate,
      weeks: args.weeks,
      status: "active",
      volumeTargets: args.volumeTargets,
    });

    // Create sessions if provided
    if (args.sessions && args.sessions.length > 0) {
      for (const session of args.sessions) {
        await ctx.db.insert("sessions", {
          mesocycleId,
          userId: args.userId,
          dayOfWeek: session.dayOfWeek,
          name: session.name,
          exerciseIds: session.exerciseIds,
          order: session.order,
          muscleGroups: session.muscleGroups,
        });
      }
    }

    return mesocycleId;
  },
});

export const getActive = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();
  },
});

export const list = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mesocycles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: {
    mesocycleId: v.id("mesocycles"),
  },
  handler: async (ctx, args) => {
    const mesocycle = await ctx.db.get(args.mesocycleId);
    if (!mesocycle) return null;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_mesocycle", (q) =>
        q.eq("mesocycleId", args.mesocycleId)
      )
      .collect();

    // Sort sessions by order
    sessions.sort((a, b) => a.order - b.order);

    return { ...mesocycle, sessions };
  },
});

export const complete = mutation({
  args: {
    mesocycleId: v.id("mesocycles"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mesocycleId, { status: "completed" });
  },
});

export const deleteMesocycle = mutation({
  args: { mesocycleId: v.id("mesocycles") },
  handler: async (ctx, { mesocycleId }) => {
    const meso = await ctx.db.get(mesocycleId);
    if (!meso) return;
    const sessions = await ctx.db.query("sessions").withIndex("by_mesocycle", (q) => q.eq("mesocycleId", mesocycleId)).collect();
    for (const session of sessions) {
      const seExs = await ctx.db.query("sessionExercises").withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect();
      for (const se of seExs) await ctx.db.delete(se._id);
      await ctx.db.delete(session._id);
    }
    const workouts = await ctx.db.query("workouts").withIndex("by_user", (q) => q.eq("userId", meso.userId))
      .filter((q) => q.eq(q.field("mesocycleId"), mesocycleId)).collect();
    for (const workout of workouts) {
      const sets = await ctx.db.query("sets").withIndex("by_workout", (q) => q.eq("workoutId", workout._id)).collect();
      for (const set of sets) await ctx.db.delete(set._id);
      await ctx.db.delete(workout._id);
    }
    await ctx.db.delete(mesocycleId);
  },
});

export const deleteAllForUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const mesos = await ctx.db.query("mesocycles").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    for (const meso of mesos) {
      const sessions = await ctx.db.query("sessions").withIndex("by_mesocycle", (q) => q.eq("mesocycleId", meso._id)).collect();
      for (const session of sessions) {
        const seExs = await ctx.db.query("sessionExercises").withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect();
        for (const se of seExs) await ctx.db.delete(se._id);
        await ctx.db.delete(session._id);
      }
      await ctx.db.delete(meso._id);
    }
  },
});

// Rep ranges by muscle group
const REP_RANGES: Record<string, { min: number; max: number }> = {
  chest: { min: 8, max: 12 }, back: { min: 8, max: 12 },
  shoulders: { min: 10, max: 15 }, biceps: { min: 10, max: 15 },
  triceps: { min: 8, max: 12 }, quads: { min: 8, max: 12 },
  hamstrings: { min: 8, max: 12 }, glutes: { min: 10, max: 15 },
  calves: { min: 12, max: 20 }, abs: { min: 10, max: 20 },
  forearms: { min: 12, max: 20 },
};

// Creates a custom meso and auto-assigns exercises per session from the library
export const createCustom = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    weeks: v.number(),
    volumeTargets: v.array(volumeTargetValidator),
    // Each session: day of week + ordered muscle groups
    sessions: v.array(v.object({
      dayOfWeek: v.number(),
      name: v.string(),
      muscleGroups: v.array(v.string()),
      order: v.number(),
      // When provided, use these exercise names instead of auto-filling
      exerciseNames: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    // Enforce one active meso at a time
    const existing = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (existing) await ctx.db.patch(existing._id, { status: "completed" });

    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: args.name,
      startDate: Date.now(),
      weeks: args.weeks,
      status: "active",
      volumeTargets: args.volumeTargets,
    });

    for (const sessionDef of args.sessions) {
      const allExIds: any[] = [];
      const seInputs: { exerciseId: any; repMin: number; repMax: number; mg: string }[] = [];

      if (sessionDef.exerciseNames && sessionDef.exerciseNames.length > 0) {
        // User-selected exercises: look up by name
        for (const exName of sessionDef.exerciseNames) {
          const ex = await ctx.db
            .query("exercises")
            .filter((q) => q.eq(q.field("name"), exName))
            .first();
          if (ex) {
            const range = REP_RANGES[ex.muscleGroup] ?? { min: 8, max: 12 };
            allExIds.push(ex._id);
            seInputs.push({ exerciseId: ex._id, repMin: range.min, repMax: range.max, mg: ex.muscleGroup });
          }
        }
      } else {
        // Auto-fill: pick top exercises per muscle group
        for (const mg of sessionDef.muscleGroups) {
          const exList = await ctx.db
            .query("exercises")
            .withIndex("by_muscle_group", (q) => q.eq("muscleGroup", mg as any))
            .collect();

          const sfrOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          exList.sort((a, b) => (sfrOrder[a.sfr] ?? 2) - (sfrOrder[b.sfr] ?? 2));

          const picked = exList.slice(0, 2);
          const range = REP_RANGES[mg] ?? { min: 8, max: 12 };
          for (const ex of picked) {
            allExIds.push(ex._id);
            seInputs.push({ exerciseId: ex._id, repMin: range.min, repMax: range.max, mg });
          }
        }
      }

      const sessionId = await ctx.db.insert("sessions", {
        mesocycleId: mesoId,
        userId: args.userId,
        dayOfWeek: sessionDef.dayOfWeek,
        name: sessionDef.name,
        exerciseIds: allExIds,
        order: sessionDef.order,
        muscleGroups: sessionDef.muscleGroups,
      });

      for (let i = 0; i < seInputs.length; i++) {
        const se = seInputs[i];
        await ctx.db.insert("sessionExercises", {
          sessionId,
          exerciseId: se.exerciseId,
          order: i,
          repRangeMin: se.repMin,
          repRangeMax: se.repMax,
          targetSets: 3,
          setType: "regular",
        });
      }
    }

    return mesoId;
  },
});

export const startDeload = mutation({
  args: {
    mesocycleId: v.id("mesocycles"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mesocycleId, { status: "deload" });
  },
});

// Returns session exercises with full exercise details and rep range config
export const getSessionExercises = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const sessionExs = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    if (sessionExs.length === 0) {
      // Fallback: read from sessions.exerciseIds for backward compat
      const session = await ctx.db.get(args.sessionId);
      if (!session) return [];
      const exercises = await Promise.all(session.exerciseIds.map((id) => ctx.db.get(id)));
      return exercises
        .filter(Boolean)
        .map((ex, i) => ({
          _id: `${args.sessionId}_${ex!._id}` as any,
          sessionId: args.sessionId,
          exerciseId: ex!._id,
          order: i,
          repRangeMin: 8,
          repRangeMax: 12,
          targetSets: 3,
          setType: "regular" as const,
          isLegacy: true,
          exercise: { _id: ex!._id, name: ex!.name, muscleGroup: ex!.muscleGroup, equipment: ex!.equipment, sfr: ex!.sfr, category: ex!.category ?? null, cardioMode: ex!.cardioMode ?? null },
        }));
    }

    sessionExs.sort((a, b) => a.order - b.order);

    const result = await Promise.all(
      sessionExs.map(async (se) => {
        const exercise = await ctx.db.get(se.exerciseId);
        return {
          ...se,
          isLegacy: false,
          exercise: exercise
            ? { _id: exercise._id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, sfr: exercise.sfr, category: exercise.category ?? null, cardioMode: exercise.cardioMode ?? null }
            : null,
        };
      })
    );

    return result.filter((r) => r.exercise !== null);
  },
});

// Returns active meso with sessions (exercises resolved to names + muscle groups)
// and a server-computed weekNumber.
export const getActiveWithDetails = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const meso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (!meso) return null;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_mesocycle", (q) => q.eq("mesocycleId", meso._id))
      .collect();

    // Resolve exercises for each session
    const sessionsWithDetails = await Promise.all(
      sessions.map(async (session) => {
        const exercises = await Promise.all(
          session.exerciseIds.map((id) => ctx.db.get(id))
        );
        const validExercises = exercises.filter(Boolean) as NonNullable<(typeof exercises)[number]>[];

        // Derive muscle groups from exercises if not stored on session
        const muscleGroups =
          session.muscleGroups && session.muscleGroups.length > 0
            ? session.muscleGroups
            : [...new Set(validExercises.map((ex) => ex.muscleGroup))];

        return {
          ...session,
          exercises: validExercises.map((ex) => ({ id: ex._id, name: ex.name, muscleGroup: ex.muscleGroup })),
          muscleGroups,
        };
      })
    );

    sessionsWithDetails.sort((a, b) => a.order - b.order);

    // Week number = max(calendar week, highest week of any logged workout)
    // This ensures starting a week early is reflected immediately
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const calendarWeek = Math.max(1, Math.ceil((Date.now() - meso.startDate) / msPerWeek));

    const allWorkouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("mesocycleId"), meso._id))
      .collect();

    const maxLoggedWeek = allWorkouts.length > 0
      ? Math.max(...allWorkouts.map((w) => w.weekNumber))
      : 1;

    const weekNumber = Math.min(Math.max(calendarWeek, maxLoggedWeek), meso.weeks);

    return { ...meso, sessions: sessionsWithDetails, weekNumber };
  },
});

export const swapExercise = mutation({
  args: {
    sessionExerciseId: v.id("sessionExercises"),
    newExerciseId: v.id("exercises"),
  },
  handler: async (ctx, { sessionExerciseId, newExerciseId }) => {
    const se = await ctx.db.get(sessionExerciseId);
    if (!se) return;
    const oldExerciseId = se.exerciseId;
    await ctx.db.patch(sessionExerciseId, { exerciseId: newExerciseId });
    // Also update sessions.exerciseIds
    const session = await ctx.db.get(se.sessionId);
    if (session) {
      const updated = session.exerciseIds.map((id) =>
        (id as string) === (oldExerciseId as string) ? newExerciseId : id
      );
      await ctx.db.patch(se.sessionId, { exerciseIds: updated });
    }
  },
});

export const removeExerciseFromSession = mutation({
  args: {
    sessionExerciseId: v.id("sessionExercises"),
  },
  handler: async (ctx, { sessionExerciseId }) => {
    const se = await ctx.db.get(sessionExerciseId);
    if (!se) return;
    // Remove the sessionExercise row
    await ctx.db.delete(sessionExerciseId);
    // Also remove from sessions.exerciseIds
    const session = await ctx.db.get(se.sessionId);
    if (session) {
      const updated = session.exerciseIds.filter(
        (id) => (id as string) !== (se.exerciseId as string)
      );
      await ctx.db.patch(se.sessionId, { exerciseIds: updated });
    }
  },
});

export const addExerciseToSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    exerciseId: v.id("exercises"),
    repRangeMin: v.number(),
    repRangeMax: v.number(),
    targetSets: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current exercises to determine order
    const existing = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const order = existing.length;

    const seId = await ctx.db.insert("sessionExercises", {
      sessionId: args.sessionId,
      exerciseId: args.exerciseId,
      order,
      repRangeMin: args.repRangeMin,
      repRangeMax: args.repRangeMax,
      targetSets: args.targetSets,
      setType: "regular",
    });

    // Also add to sessions.exerciseIds
    const session = await ctx.db.get(args.sessionId);
    if (session) {
      await ctx.db.patch(args.sessionId, {
        exerciseIds: [...session.exerciseIds, args.exerciseId],
      });
    }

    return seId;
  },
});

// Fallback for legacy sessions that have no sessionExercises rows
export const removeExerciseByIds = mutation({
  args: {
    sessionId: v.id("sessions"),
    exerciseId: v.id("exercises"),
  },
  handler: async (ctx, { sessionId, exerciseId }) => {
    // Delete any sessionExercises row that matches
    const rows = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of rows) {
      if ((row.exerciseId as string) === (exerciseId as string)) {
        await ctx.db.delete(row._id);
      }
    }
    // Remove from sessions.exerciseIds
    const session = await ctx.db.get(sessionId);
    if (session) {
      await ctx.db.patch(sessionId, {
        exerciseIds: session.exerciseIds.filter((id) => (id as string) !== (exerciseId as string)),
      });
    }
  },
});

export const updateTargetSets = mutation({
  args: {
    sessionExerciseId: v.id("sessionExercises"),
    targetSets: v.number(),
  },
  handler: async (ctx, { sessionExerciseId, targetSets }) => {
    const se = await ctx.db.get(sessionExerciseId);
    if (!se) return;
    await ctx.db.patch(sessionExerciseId, { targetSets });
  },
});

export const updateSetType = mutation({
  args: {
    sessionExerciseId: v.id("sessionExercises"),
    setType: v.union(v.literal("regular"), v.literal("myorep"), v.literal("myorep_match")),
  },
  handler: async (ctx, { sessionExerciseId, setType }) => {
    const se = await ctx.db.get(sessionExerciseId);
    if (!se) return;
    await ctx.db.patch(sessionExerciseId, { setType });
  },
});

// Returns all mesocycles for a user (desc) with sessions + exercises resolved
export const listAllWithSessions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const mesos = await ctx.db
      .query("mesocycles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return await Promise.all(
      mesos.map(async (meso) => {
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_mesocycle", (q) => q.eq("mesocycleId", meso._id))
          .collect();

        sessions.sort((a, b) => a.order - b.order);

        const sessionsWithDetails = await Promise.all(
          sessions.map(async (session) => {
            const exercises = await Promise.all(session.exerciseIds.map((id) => ctx.db.get(id)));
            const valid = exercises.filter(Boolean) as NonNullable<(typeof exercises)[number]>[];
            const muscleGroups =
              session.muscleGroups?.length
                ? session.muscleGroups
                : [...new Set(valid.map((ex) => ex.muscleGroup))];
            return {
              ...session,
              muscleGroups,
              exercises: valid.map((ex) => ({ id: ex._id, name: ex.name, muscleGroup: ex.muscleGroup })),
            };
          })
        );

        // Week number for active mesos
        let weekNumber = 1;
        if (meso.status === "active") {
          const msPerWeek = 7 * 24 * 60 * 60 * 1000;
          const calendarWeek = Math.max(1, Math.ceil((Date.now() - meso.startDate) / msPerWeek));
          const allWorkouts = await ctx.db
            .query("workouts")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) => q.eq(q.field("mesocycleId"), meso._id))
            .collect();
          const maxLoggedWeek = allWorkouts.length > 0 ? Math.max(...allWorkouts.map((w) => w.weekNumber)) : 1;
          weekNumber = Math.min(Math.max(calendarWeek, maxLoggedWeek), meso.weeks);
        }

        return { ...meso, sessions: sessionsWithDetails, weekNumber };
      })
    );
  },
});

// Pause any currently active meso and activate the given one
export const setActive = mutation({
  args: { userId: v.id("users"), mesocycleId: v.id("mesocycles") },
  handler: async (ctx, { userId, mesocycleId }) => {
    // Pause any currently active meso
    const current = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
    if (current && (current._id as string) !== (mesocycleId as string)) {
      await ctx.db.patch(current._id, { status: "paused" });
    }
    // Activate the target, reset startDate to now
    await ctx.db.patch(mesocycleId, { status: "active", startDate: Date.now() });
  },
});
