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
          exercise: { _id: ex!._id, name: ex!.name, muscleGroup: ex!.muscleGroup, equipment: ex!.equipment },
        }));
    }

    sessionExs.sort((a, b) => a.order - b.order);

    const result = await Promise.all(
      sessionExs.map(async (se) => {
        const exercise = await ctx.db.get(se.exerciseId);
        return {
          ...se,
          exercise: exercise
            ? { _id: exercise._id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment }
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

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekNumber = Math.max(1, Math.ceil((Date.now() - meso.startDate) / msPerWeek));

    return { ...meso, sessions: sessionsWithDetails, weekNumber };
  },
});
