import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateRoadmap, inferObjective, type Objective } from "../utils/goalRoadmap";
import type { TargetProfile } from "../utils/nutritionTargets";

// The active roadmap for a user (or null). Read by the Stats + Fuel screens.
export const getActivePlan = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("goalPlans")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
  },
});

// Generate a roadmap from the user's current profile + a target BF / deadline,
// archive any existing active plan, and store the new one. Server-side
// generation keeps utils/goalRoadmap the single source of truth.
export const saveGeneratedPlan = mutation({
  args: {
    userId: v.id("users"),
    targetBf: v.number(),
    deadlineMs: v.number(),
    startMs: v.number(),
    objective: v.optional(v.union(
      v.literal("lose_fat"), v.literal("build_muscle"),
      v.literal("recomp"), v.literal("peak"), v.literal("maintain"),
    )),
    aggressiveness: v.optional(v.union(
      v.literal("conservative"), v.literal("standard"), v.literal("aggressive"),
    )),
  },
  handler: async (ctx, { userId, targetBf, deadlineMs, startMs, objective, aggressiveness }) => {
    const profile = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("No profile — complete onboarding first.");

    // Experience lives on the user doc; thread it into the model so gain rates
    // and p-ratio scale with training age.
    const user = await ctx.db.get(userId);

    const targetProfile: TargetProfile = {
      weightKg: profile.weightKg,
      currentBf: profile.currentBf,
      targetBf,
      weeklyGoal: profile.weeklyGoal,
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.heightCm,
      experienceLevel: user?.experienceLevel,
    };

    // Objective precedence: explicit arg → stored on profile → inferred from gap.
    const resolvedObjective: Objective =
      objective ?? profile.objective ?? inferObjective(profile.currentBf, targetBf);

    const roadmap = generateRoadmap(
      targetProfile,
      {
        objective: resolvedObjective,
        targetBf,
        deadlineMs,
        aggressiveness: aggressiveness ?? profile.aggressiveness,
      },
      startMs,
    );

    // Archive any currently-active plan before inserting the new one.
    const existing = await ctx.db
      .query("goalPlans")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    for (const plan of existing) {
      await ctx.db.patch(plan._id, { status: "archived" });
    }

    const now = Date.now();
    const id = await ctx.db.insert("goalPlans", {
      userId,
      objective: roadmap.objective,
      targetBf: roadmap.targetBf,
      requestedDeadlineMs: roadmap.requestedDeadlineMs,
      deadlineMs: roadmap.deadlineMs,
      startMs: roadmap.startMs,
      status: "active",
      feasible: roadmap.feasible,
      adjusted: roadmap.adjusted,
      note: roadmap.note,
      basisWeightKg: profile.weightKg,
      basisBf: profile.currentBf,
      phases: roadmap.phases,
      createdAt: now,
      updatedAt: now,
    });

    // Anchor the quarterly check-in clock — generating a plan (onboarding or a
    // check-in) resets the 90-day timer.
    await ctx.db.patch(profile._id, { lastCheckInAt: now });
    return id;
  },
});

// How overdue the user is for a quarterly (90-day) re-onboarding / check-in.
// Falls back to the profile's last update / creation time when no check-in has
// been recorded yet (existing users predating this feature).
export const CHECK_IN_DAYS = 90;
export const getCheckInStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return { due: false, daysSince: null as number | null, lastCheckInAt: null as number | null };
    const anchor = profile.lastCheckInAt ?? profile.updatedAt ?? profile._creationTime;
    const daysSince = Math.floor((Date.now() - anchor) / 86_400_000);
    return { due: daysSince >= CHECK_IN_DAYS, daysSince, lastCheckInAt: anchor };
  },
});

// Archive the active plan (e.g. a future "restart goal" flow).
export const archivePlan = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const active = await ctx.db
      .query("goalPlans")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    for (const plan of active) {
      await ctx.db.patch(plan._id, { status: "archived" });
    }
  },
});

// PHASE B: a `getCheckInStatus` query would live here — compare Date.now() to
// userProfile.lastCheckInAt (>90 days) to surface the quarterly re-onboarding
// nudge, and regenerate the roadmap from the user's fresh weight/BF.
