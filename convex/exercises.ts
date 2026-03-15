import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const muscleGroupValidator = v.union(
  v.literal("chest"),
  v.literal("back"),
  v.literal("shoulders"),
  v.literal("biceps"),
  v.literal("triceps"),
  v.literal("quads"),
  v.literal("hamstrings"),
  v.literal("glutes"),
  v.literal("calves"),
  v.literal("abs"),
  v.literal("forearms"),
  v.literal("cardio")
);

const equipmentValidator = v.union(
  v.literal("barbell"),
  v.literal("dumbbell"),
  v.literal("cable"),
  v.literal("machine"),
  v.literal("bodyweight"),
  v.literal("other")
);

const sfrValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
);

// SFR sort order: high > medium > low
const sfrOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const listByMuscleGroup = query({
  args: {
    muscleGroup: muscleGroupValidator,
  },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_muscle_group", (q) =>
        q.eq("muscleGroup", args.muscleGroup)
      )
      .collect();

    // Sort by sfr descending: high -> medium -> low
    return exercises.sort(
      (a, b) => sfrOrder[a.sfr] - sfrOrder[b.sfr]
    );
  },
});

export const search = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase().trim();
    if (!searchTerm) return [];

    const all = await ctx.db.query("exercises").collect();

    return all.filter((exercise) =>
      exercise.name.toLowerCase().includes(searchTerm)
    );
  },
});

export const getById = query({
  args: {
    exerciseId: v.id("exercises"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.exerciseId);
  },
});

export const listCustom = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exercises")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const exercises = await ctx.db.query("exercises").collect();
    return exercises.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const setVideoUrl = mutation({
  args: {
    exerciseId: v.id("exercises"),
    videoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exerciseId, { videoUrl: args.videoUrl });
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    muscleGroup: muscleGroupValidator,
    equipment: equipmentValidator,
    sfr: sfrValidator,
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const exerciseId = await ctx.db.insert("exercises", {
      name: args.name,
      muscleGroup: args.muscleGroup,
      equipment: args.equipment,
      sfr: args.sfr,
      isCustom: true,
      userId: args.userId,
      instructions: args.instructions,
    });

    return exerciseId;
  },
});
