import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createOrGetUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    experienceLevel: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
    unitSystem: v.union(v.literal("kg"), v.literal("lbs")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      experienceLevel: args.experienceLevel,
      unitSystem: args.unitSystem,
      createdAt: Date.now(),
    });

    return userId;
  },
});

export const getUser = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

/**
 * Wipes ALL training data for a user — mesocycles, sessions, sessionExercises,
 * workouts, sets, and sessionFeedback. Keeps the user account itself.
 */
export const deleteAllUserData = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const uid = args.userId;

    // 1. Sets
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", uid))
      .collect();
    for (const s of sets) await ctx.db.delete(s._id);

    // 2. Session feedback
    const allFeedback = await ctx.db
      .query("sessionFeedback")
      .filter((q) => q.eq(q.field("userId"), uid))
      .collect();
    for (const f of allFeedback) await ctx.db.delete(f._id);

    // 3. Workouts
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const w of workouts) await ctx.db.delete(w._id);

    // 4. Mesocycles → sessions → sessionExercises
    const mesos = await ctx.db
      .query("mesocycles")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const meso of mesos) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_mesocycle", (q) => q.eq("mesocycleId", meso._id))
        .collect();
      for (const session of sessions) {
        const seExs = await ctx.db
          .query("sessionExercises")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const se of seExs) await ctx.db.delete(se._id);
        await ctx.db.delete(session._id);
      }
      await ctx.db.delete(meso._id);
    }

    // 5. Progress photos
    const photos = await ctx.db
      .query("progressPhotos")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const p of photos) await ctx.db.delete(p._id);

    // 6. User profile (goals / onboarding data)
    const profiles = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const p of profiles) await ctx.db.delete(p._id);
  },
});

export const updateExperienceLevel = mutation({
  args: {
    userId: v.id("users"),
    level: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { experienceLevel: args.level });
  },
});
