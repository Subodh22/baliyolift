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
