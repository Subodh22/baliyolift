import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * RP-style Push/Pull/Legs template mesocycle.
 * Looks up seeded exercises by name, creates the meso + sessions + sessionExercises.
 */
export const createPPLTemplate = mutation({
  args: {
    userId: v.id("users"),
    weeks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const weeks = args.weeks ?? 5;

    // Helper: find exercise by name
    const findEx = async (name: string) => {
      const all = await ctx.db.query("exercises").collect();
      return all.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? null;
    };

    // ─── Session definitions ───────────────────────────────────────────────
    // PPL × 2 (6 days), Mon–Sat
    const sessionDefs = [
      {
        name: "Push A — Chest & Shoulders",
        dayOfWeek: 1, // Monday
        order: 0,
        muscleGroups: ["chest", "shoulders", "triceps"],
        exercises: [
          { name: "Incline Dumbbell Press",   repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Machine Chest Press",       repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Cable Lateral Raise",       repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Overhead Tricep Extension", repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
        ],
      },
      {
        name: "Pull A — Back & Biceps",
        dayOfWeek: 2, // Tuesday
        order: 1,
        muscleGroups: ["back", "biceps"],
        exercises: [
          { name: "Cable Row",               repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Lat Pulldown",            repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Incline Dumbbell Curl",   repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Hammer Curl",             repRangeMin: 10, repRangeMax: 15, targetSets: 2, setType: "myorep" as const },
        ],
      },
      {
        name: "Legs A — Quads & Glutes",
        dayOfWeek: 3, // Wednesday
        order: 2,
        muscleGroups: ["quads", "glutes", "calves"],
        exercises: [
          { name: "Leg Press",           repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Leg Extension",       repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Romanian Deadlift",   repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Standing Calf Raise", repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
        ],
      },
      {
        name: "Push B — Chest & Triceps",
        dayOfWeek: 4, // Thursday
        order: 3,
        muscleGroups: ["chest", "shoulders", "triceps"],
        exercises: [
          { name: "Flat Dumbbell Press",       repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Pec Dec",                   repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Machine Shoulder Press",    repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Cable Tricep Pushdown",     repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Pull B — Back & Biceps",
        dayOfWeek: 5, // Friday
        order: 4,
        muscleGroups: ["back", "biceps"],
        exercises: [
          { name: "Chest Supported Row",      repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Single Arm Cable Row",     repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "EZ Bar Curl",              repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Cable Curl",               repRangeMin: 12, repRangeMax: 20, targetSets: 2, setType: "myorep" as const },
        ],
      },
      {
        name: "Legs B — Hamstrings & Glutes",
        dayOfWeek: 6, // Saturday
        order: 5,
        muscleGroups: ["hamstrings", "glutes", "quads", "calves"],
        exercises: [
          { name: "Hack Squat",          repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Leg Curl",            repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Hip Thrust",          repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Seated Calf Raise",   repRangeMin: 10, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
        ],
      },
    ];

    // ─── Volume targets (RP intermediate defaults) ─────────────────────────
    const volumeTargets = [
      { muscleGroup: "chest",       mev: 8,  mav: 14, mrv: 20 },
      { muscleGroup: "back",        mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "shoulders",   mev: 8,  mav: 14, mrv: 20 },
      { muscleGroup: "biceps",      mev: 8,  mav: 14, mrv: 18 },
      { muscleGroup: "triceps",     mev: 6,  mav: 12, mrv: 18 },
      { muscleGroup: "quads",       mev: 8,  mav: 14, mrv: 20 },
      { muscleGroup: "hamstrings",  mev: 6,  mav: 10, mrv: 16 },
      { muscleGroup: "glutes",      mev: 6,  mav: 12, mrv: 16 },
      { muscleGroup: "calves",      mev: 8,  mav: 12, mrv: 16 },
    ];

    // ─── Create mesocycle ──────────────────────────────────────────────────
    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: "PPL Hypertrophy Block",
      startDate: Date.now(),
      weeks,
      status: "active",
      volumeTargets,
    });

    // ─── Create sessions + sessionExercises ───────────────────────────────
    for (const def of sessionDefs) {
      // Resolve exercise IDs
      const resolvedExIds: any[] = [];
      for (const exDef of def.exercises) {
        const ex = await findEx(exDef.name);
        if (ex) resolvedExIds.push({ id: ex._id, ...exDef });
      }

      // Create session
      const sessionId = await ctx.db.insert("sessions", {
        mesocycleId: mesoId,
        userId: args.userId,
        dayOfWeek: def.dayOfWeek,
        name: def.name,
        exerciseIds: resolvedExIds.map((e) => e.id),
        order: def.order,
        muscleGroups: def.muscleGroups,
      });

      // Create sessionExercises (the key table for rep ranges)
      for (let i = 0; i < resolvedExIds.length; i++) {
        const exDef = resolvedExIds[i];
        await ctx.db.insert("sessionExercises", {
          sessionId,
          exerciseId: exDef.id,
          order: i,
          repRangeMin: exDef.repRangeMin,
          repRangeMax: exDef.repRangeMax,
          targetSets: exDef.targetSets,
          setType: exDef.setType,
        });
      }
    }

    return mesoId;
  },
});

/**
 * Upper/Lower 4-day template — good for beginners/intermediate who want less frequency.
 */
export const createUpperLowerTemplate = mutation({
  args: {
    userId: v.id("users"),
    weeks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const weeks = args.weeks ?? 5;

    const findEx = async (name: string) => {
      const all = await ctx.db.query("exercises").collect();
      return all.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? null;
    };

    const sessionDefs = [
      {
        name: "Upper A — Chest Focus",
        dayOfWeek: 1,
        order: 0,
        muscleGroups: ["chest", "back", "shoulders", "biceps", "triceps"],
        exercises: [
          { name: "Incline Dumbbell Press",   repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Cable Row",                repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Cable Lateral Raise",      repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "EZ Bar Curl",              repRangeMin: 8,  repRangeMax: 12, targetSets: 2, setType: "regular" as const },
          { name: "Cable Tricep Pushdown",    repRangeMin: 12, repRangeMax: 20, targetSets: 2, setType: "myorep" as const },
        ],
      },
      {
        name: "Lower A — Quad Focus",
        dayOfWeek: 2,
        order: 1,
        muscleGroups: ["quads", "hamstrings", "glutes", "calves"],
        exercises: [
          { name: "Leg Press",           repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Leg Extension",       repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Romanian Deadlift",   repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Standing Calf Raise", repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
        ],
      },
      {
        name: "Upper B — Back Focus",
        dayOfWeek: 4,
        order: 2,
        muscleGroups: ["back", "chest", "shoulders", "biceps", "triceps"],
        exercises: [
          { name: "Lat Pulldown",              repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Flat Dumbbell Press",        repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Machine Shoulder Press",    repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Incline Dumbbell Curl",     repRangeMin: 10, repRangeMax: 15, targetSets: 2, setType: "regular" as const },
          { name: "Overhead Tricep Extension", repRangeMin: 10, repRangeMax: 15, targetSets: 2, setType: "regular" as const },
        ],
      },
      {
        name: "Lower B — Glute & Ham Focus",
        dayOfWeek: 5,
        order: 3,
        muscleGroups: ["hamstrings", "glutes", "quads", "calves"],
        exercises: [
          { name: "Hack Squat",        repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Leg Curl",          repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Hip Thrust",        repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Seated Calf Raise", repRangeMin: 10, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
        ],
      },
    ];

    const volumeTargets = [
      { muscleGroup: "chest",       mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "back",        mev: 10, mav: 14, mrv: 20 },
      { muscleGroup: "shoulders",   mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "biceps",      mev: 6,  mav: 10, mrv: 16 },
      { muscleGroup: "triceps",     mev: 6,  mav: 10, mrv: 14 },
      { muscleGroup: "quads",       mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "hamstrings",  mev: 6,  mav: 10, mrv: 14 },
      { muscleGroup: "glutes",      mev: 6,  mav: 10, mrv: 14 },
      { muscleGroup: "calves",      mev: 6,  mav: 10, mrv: 14 },
    ];

    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: "Upper/Lower Hypertrophy Block",
      startDate: Date.now(),
      weeks,
      status: "active",
      volumeTargets,
    });

    for (const def of sessionDefs) {
      const resolvedExIds: any[] = [];
      for (const exDef of def.exercises) {
        const ex = await findEx(exDef.name);
        if (ex) resolvedExIds.push({ id: ex._id, ...exDef });
      }

      const sessionId = await ctx.db.insert("sessions", {
        mesocycleId: mesoId,
        userId: args.userId,
        dayOfWeek: def.dayOfWeek,
        name: def.name,
        exerciseIds: resolvedExIds.map((e) => e.id),
        order: def.order,
        muscleGroups: def.muscleGroups,
      });

      for (let i = 0; i < resolvedExIds.length; i++) {
        const exDef = resolvedExIds[i];
        await ctx.db.insert("sessionExercises", {
          sessionId,
          exerciseId: exDef.id,
          order: i,
          repRangeMin: exDef.repRangeMin,
          repRangeMax: exDef.repRangeMax,
          targetSets: exDef.targetSets,
          setType: exDef.setType,
        });
      }
    }

    return mesoId;
  },
});
