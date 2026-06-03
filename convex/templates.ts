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
    // Pause any currently active mesocycle
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (activeMeso) await ctx.db.patch(activeMeso._id, { status: "paused" });

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
 * Laxman 4-day split — Shoulders/Biceps · Chest/Triceps · Back · Legs
 * High-volume, super-set focused program from coach Laxman.
 */
export const createLaxmanTemplate = mutation({
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
        name: "Shoulders & Biceps",
        dayOfWeek: 1, // Monday
        order: 0,
        muscleGroups: ["shoulders", "biceps", "forearms"],
        exercises: [
          // SUPER SET: Bent Over Lateral Raise + Incline DB Front Raise — 4x15
          { name: "Bent Over Lateral Raise",          repRangeMin: 15, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          { name: "Incline DB Front Raise",           repRangeMin: 15, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          // SUPER SET: Wide Grip Upright Row + Machine Shoulder Press — 5x10
          { name: "Upright Row",                      repRangeMin: 10, repRangeMax: 10, targetSets: 5, setType: "regular" as const },
          { name: "Machine Shoulder Press",           repRangeMin: 10, repRangeMax: 10, targetSets: 5, setType: "regular" as const },
          // Cable Rotation — 4x20
          { name: "Cable Rotation",                   repRangeMin: 20, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
          // SUPER SET: Machine Shoulder Press + Lateral Raise — 3x10
          { name: "Machine Shoulder Press",           repRangeMin: 10, repRangeMax: 10, targetSets: 3, setType: "regular" as const },
          { name: "Machine Lateral Raise",            repRangeMin: 10, repRangeMax: 10, targetSets: 3, setType: "regular" as const },
          // Reverse Grip Barbell Curl — 4x15
          { name: "Reverse Curl",                     repRangeMin: 15, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          // SUPER SET: EZ Bar Curl + Hammer Curl — 3x20
          { name: "EZ Bar Curl",                      repRangeMin: 20, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
          { name: "Hammer Curl",                      repRangeMin: 20, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
          // Rear delt work (dispersed from old Back session) — 4x15
          { name: "Cable Face Pull",                  repRangeMin: 15, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          { name: "Reverse Pec Deck",                 repRangeMin: 15, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
        ],
      },
      {
        name: "Chest & Triceps",
        dayOfWeek: 2, // Tuesday
        order: 1,
        muscleGroups: ["chest", "triceps"],
        exercises: [
          // Pec Fly — 3x15
          { name: "Pec Deck Machine",                 repRangeMin: 15, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          // Incline Bench Press — 5 sets pyramid: 12-10-8-4-15
          { name: "Incline Barbell Press",            repRangeMin: 4,  repRangeMax: 15, targetSets: 5, setType: "regular" as const },
          // Push Up — 2x20 (bodyweight)
          { name: "Push Up",                          repRangeMin: 20, repRangeMax: 20, targetSets: 2, setType: "regular" as const },
          // Machine Chest Press — 3x30 drop set
          { name: "Machine Chest Press",              repRangeMin: 15, repRangeMax: 30, targetSets: 3, setType: "myorep" as const },
          // Dips — 4x15
          { name: "Dips",                             repRangeMin: 15, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          // Cross Cable Push Down (triceps) — 3x20
          { name: "Cable Pushdown",                   repRangeMin: 20, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
          // Additional triceps from old Triceps & Back session
          // Cable Kick Back — 7x10
          { name: "Cable Kickback",                   repRangeMin: 10, repRangeMax: 10, targetSets: 7, setType: "regular" as const },
          // Cable Overhead Extension — 4x12
          { name: "Cable Overhead Tricep Extension",  repRangeMin: 12, repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          // Reverse Grip Push Down — 3x8-12 drop sets
          { name: "Reverse Grip Pushdown",            repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Back",
        dayOfWeek: 4, // Thursday
        order: 2,
        muscleGroups: ["back", "shoulders"],
        exercises: [
          // Reverse Grip Pull Down — 6x15 (from old Back session)
          { name: "Reverse Grip Pulldown",            repRangeMin: 15, repRangeMax: 15, targetSets: 6, setType: "regular" as const },
          // V Bar Pull Down — 3x30 + drop 10+10+10 (from old Back session)
          { name: "V Bar Pulldown",                   repRangeMin: 10, repRangeMax: 30, targetSets: 3, setType: "myorep" as const },
          // DB Row — 2x20 (from old Back session)
          { name: "Dumbbell Row",                     repRangeMin: 20, repRangeMax: 20, targetSets: 2, setType: "regular" as const },
          // Wide Grip Cable Row — 3x8-12 drop sets (from old Back session)
          { name: "Seated Cable Row Wide Grip",       repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "myorep" as const },
          // Deadlift — 3 sets (from old Triceps & Back session)
          { name: "Deadlift",                         repRangeMin: 6,  repRangeMax: 10, targetSets: 3, setType: "regular" as const },
          // Chest Supported Row — 6x15 (from old Triceps & Back session)
          { name: "Chest-Supported Row",              repRangeMin: 15, repRangeMax: 15, targetSets: 6, setType: "regular" as const },
        ],
      },
      {
        name: "Legs",
        dayOfWeek: 5, // Friday
        order: 3,
        muscleGroups: ["quads", "hamstrings", "calves", "glutes"],
        exercises: [
          // Seated Leg Curl — 3x15 (pre-fatigue)
          { name: "Seated Leg Curl",                  repRangeMin: 15, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          // Deep Squat — 3x12
          { name: "Barbell Back Squat",               repRangeMin: 12, repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          // Seated Leg Curl — 3x15 (post squat)
          { name: "Seated Leg Curl",                  repRangeMin: 15, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          // Banded Hack Squat — 3x30 drop
          { name: "Hack Squat Machine",               repRangeMin: 12, repRangeMax: 30, targetSets: 3, setType: "myorep" as const },
          // Walking Lunges — 3x10 steps
          { name: "Walking Lunge",                    repRangeMin: 10, repRangeMax: 10, targetSets: 3, setType: "regular" as const },
          // Calf Raises — 5x20
          { name: "Standing Calf Raise",              repRangeMin: 20, repRangeMax: 20, targetSets: 5, setType: "regular" as const },
        ],
      },
    ];

    const volumeTargets = [
      { muscleGroup: "shoulders",  mev: 16, mav: 24, mrv: 30 },
      { muscleGroup: "biceps",     mev: 10, mav: 16, mrv: 20 },
      { muscleGroup: "forearms",   mev: 4,  mav: 8,  mrv: 12 },
      { muscleGroup: "chest",      mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "back",       mev: 14, mav: 22, mrv: 28 },
      { muscleGroup: "triceps",    mev: 12, mav: 20, mrv: 26 },
      { muscleGroup: "quads",      mev: 9,  mav: 15, mrv: 20 },
      { muscleGroup: "hamstrings", mev: 6,  mav: 10, mrv: 14 },
      { muscleGroup: "glutes",     mev: 4,  mav: 8,  mrv: 12 },
      { muscleGroup: "calves",     mev: 5,  mav: 10, mrv: 16 },
    ];

    // Pause any currently active mesocycle
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (activeMeso) await ctx.db.patch(activeMeso._id, { status: "paused" });

    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: "Laxman",
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

    // Pause any currently active mesocycle
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (activeMeso) await ctx.db.patch(activeMeso._id, { status: "paused" });

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

/**
 * Chris Bumstead 5-day Classic Physique split.
 * Chest/Tri · Back/Bi · Shoulders/Arms · Legs · Arms Pump
 */
export const createCBumTemplate = mutation({
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
        name: "Chest & Triceps",
        dayOfWeek: 1, // Monday
        order: 0,
        muscleGroups: ["chest", "triceps"],
        exercises: [
          { name: "Incline Dumbbell Press",    repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Machine Chest Press",        repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Pec Dec",                    repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Tricep Pushdown",      repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Overhead Tricep Extension",  repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
        ],
      },
      {
        name: "Back & Biceps",
        dayOfWeek: 2, // Tuesday
        order: 1,
        muscleGroups: ["back", "biceps"],
        exercises: [
          { name: "Deadlift",              repRangeMin: 4,  repRangeMax: 8,  targetSets: 4, setType: "regular" as const },
          { name: "Lat Pulldown",          repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Cable Row",             repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "EZ Bar Curl",           repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Incline Dumbbell Curl", repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
        ],
      },
      {
        name: "Shoulders & Arms",
        dayOfWeek: 4, // Thursday
        order: 2,
        muscleGroups: ["shoulders", "biceps", "triceps"],
        exercises: [
          { name: "Machine Shoulder Press",    repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Cable Lateral Raise",        repRangeMin: 15, repRangeMax: 20, targetSets: 4, setType: "myorep" as const },
          { name: "Cable Face Pull",            repRangeMin: 15, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
          { name: "EZ Bar Curl",               repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Cable Tricep Pushdown",      repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Legs",
        dayOfWeek: 5, // Friday
        order: 3,
        muscleGroups: ["quads", "hamstrings", "glutes", "calves"],
        exercises: [
          { name: "Leg Press",           repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Hack Squat",          repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Leg Extension",       repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Leg Curl",            repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Hip Thrust",          repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Standing Calf Raise", repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
          { name: "Seated Calf Raise",   repRangeMin: 10, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
        ],
      },
      {
        name: "Arms Pump",
        dayOfWeek: 6, // Saturday
        order: 4,
        muscleGroups: ["biceps", "triceps"],
        exercises: [
          { name: "Incline Dumbbell Curl",     repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Hammer Curl",               repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Curl",                repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Tricep Pushdown",     repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Overhead Tricep Extension", repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
        ],
      },
    ];

    const volumeTargets = [
      { muscleGroup: "chest",       mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "back",        mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "shoulders",   mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "biceps",      mev: 10, mav: 16, mrv: 20 },
      { muscleGroup: "triceps",     mev: 10, mav: 16, mrv: 20 },
      { muscleGroup: "quads",       mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "hamstrings",  mev: 6,  mav: 10, mrv: 16 },
      { muscleGroup: "glutes",      mev: 6,  mav: 10, mrv: 16 },
      { muscleGroup: "calves",      mev: 10, mav: 14, mrv: 20 },
    ];

    // Pause any currently active mesocycle
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (activeMeso) await ctx.db.patch(activeMeso._id, { status: "paused" });

    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: "CBum Classic Physique",
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

/**
 * Jeff Nippard 4-day Science-Based Upper/Lower.
 * Upper A Horizontal · Lower A Quad · Upper B Vertical · Lower B Hinge
 */
export const createJeffNippardTemplate = mutation({
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
        name: "Upper A — Horizontal",
        dayOfWeek: 1, // Monday
        order: 0,
        muscleGroups: ["chest", "back", "biceps", "triceps"],
        exercises: [
          { name: "Flat Dumbbell Press",       repRangeMin: 6,  repRangeMax: 10, targetSets: 4, setType: "regular" as const },
          { name: "Cable Row",                 repRangeMin: 6,  repRangeMax: 10, targetSets: 4, setType: "regular" as const },
          { name: "Pec Dec",                   repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "EZ Bar Curl",               repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Cable Tricep Pushdown",     repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Cable Face Pull",           repRangeMin: 15, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
        ],
      },
      {
        name: "Lower A — Quad Dominant",
        dayOfWeek: 2, // Tuesday
        order: 1,
        muscleGroups: ["quads", "hamstrings", "glutes", "calves"],
        exercises: [
          { name: "Barbell Back Squat",  repRangeMin: 4,  repRangeMax: 8,  targetSets: 4, setType: "regular" as const },
          { name: "Leg Press",           repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Leg Extension",       repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Leg Curl",            repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Standing Calf Raise", repRangeMin: 8,  repRangeMax: 15, targetSets: 4, setType: "regular" as const },
        ],
      },
      {
        name: "Upper B — Vertical",
        dayOfWeek: 4, // Thursday
        order: 2,
        muscleGroups: ["shoulders", "back", "chest", "biceps", "triceps"],
        exercises: [
          { name: "Machine Shoulder Press",    repRangeMin: 6,  repRangeMax: 10, targetSets: 4, setType: "regular" as const },
          { name: "Lat Pulldown",              repRangeMin: 6,  repRangeMax: 10, targetSets: 4, setType: "regular" as const },
          { name: "Cable Lateral Raise",       repRangeMin: 15, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Incline Dumbbell Press",    repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Hammer Curl",               repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Overhead Tricep Extension", repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
        ],
      },
      {
        name: "Lower B — Hip Dominant",
        dayOfWeek: 5, // Friday
        order: 3,
        muscleGroups: ["hamstrings", "glutes", "quads", "calves"],
        exercises: [
          { name: "Romanian Deadlift",   repRangeMin: 6,  repRangeMax: 10, targetSets: 4, setType: "regular" as const },
          { name: "Hip Thrust",          repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Hack Squat",          repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Seated Leg Curl",     repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "myorep" as const },
          { name: "Seated Calf Raise",   repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
        ],
      },
    ];

    const volumeTargets = [
      { muscleGroup: "chest",       mev: 8,  mav: 14, mrv: 20 },
      { muscleGroup: "back",        mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "shoulders",   mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "biceps",      mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "triceps",     mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "quads",       mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "hamstrings",  mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "glutes",      mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "calves",      mev: 8,  mav: 12, mrv: 16 },
    ];

    // Pause any currently active mesocycle
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (activeMeso) await ctx.db.patch(activeMeso._id, { status: "paused" });

    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: "Jeff Nippard Science-Based",
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

/**
 * Sam Sulek 5-day high-intensity bro split.
 * Chest · Back · Shoulders · Arms · Legs — high volume, drop sets, training to failure.
 */
export const createSamSulekTemplate = mutation({
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
        name: "Chest",
        dayOfWeek: 1, // Monday
        order: 0,
        muscleGroups: ["chest", "triceps"],
        exercises: [
          { name: "Smith Machine Incline Press", repRangeMin: 6,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Flat Dumbbell Press",         repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Machine Chest Press",         repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "myorep" as const },
          { name: "Pec Deck Machine",            repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Fly",                   repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Pushdown",              repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Back",
        dayOfWeek: 2, // Tuesday
        order: 1,
        muscleGroups: ["back", "biceps"],
        exercises: [
          { name: "Lat Pulldown",          repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "T-Bar Row",             repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Cable Row",             repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Dumbbell Row",          repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Cable Pullover",        repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Incline Dumbbell Curl", repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Shoulders",
        dayOfWeek: 4, // Thursday
        order: 2,
        muscleGroups: ["shoulders"],
        exercises: [
          { name: "Overhead Press Dumbbell", repRangeMin: 6,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Dumbbell Lateral Raise",  repRangeMin: 12, repRangeMax: 20, targetSets: 4, setType: "myorep" as const },
          { name: "Cable Lateral Raise",     repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Machine Lateral Raise",   repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Reverse Pec Deck",        repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Face Pull",         repRangeMin: 15, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
        ],
      },
      {
        name: "Arms",
        dayOfWeek: 5, // Friday
        order: 3,
        muscleGroups: ["biceps", "triceps"],
        exercises: [
          { name: "EZ Bar Curl",                    repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Cable Overhead Tricep Extension", repRangeMin: 10, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          { name: "Incline Dumbbell Curl",          repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "myorep" as const },
          { name: "EZ Bar Skull Crusher",           repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Hammer Curl",                    repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Pushdown",                 repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Legs",
        dayOfWeek: 6, // Saturday
        order: 4,
        muscleGroups: ["quads", "hamstrings", "glutes", "calves"],
        exercises: [
          { name: "Leg Press",           repRangeMin: 8,  repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          { name: "Hack Squat Machine",  repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Leg Extension",       repRangeMin: 12, repRangeMax: 20, targetSets: 4, setType: "myorep" as const },
          { name: "Lying Leg Curl",      repRangeMin: 10, repRangeMax: 15, targetSets: 4, setType: "regular" as const },
          { name: "Romanian Deadlift",   repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Standing Calf Raise", repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
          { name: "Seated Calf Raise",   repRangeMin: 10, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
        ],
      },
    ];

    const volumeTargets = [
      { muscleGroup: "chest",       mev: 10, mav: 18, mrv: 24 },
      { muscleGroup: "back",        mev: 12, mav: 20, mrv: 26 },
      { muscleGroup: "shoulders",   mev: 12, mav: 20, mrv: 28 },
      { muscleGroup: "biceps",      mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "triceps",     mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "quads",       mev: 10, mav: 18, mrv: 24 },
      { muscleGroup: "hamstrings",  mev: 8,  mav: 14, mrv: 20 },
      { muscleGroup: "glutes",      mev: 6,  mav: 12, mrv: 16 },
      { muscleGroup: "calves",      mev: 8,  mav: 14, mrv: 20 },
    ];

    // Pause any currently active mesocycle
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (activeMeso) await ctx.db.patch(activeMeso._id, { status: "paused" });

    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: "Sam Sulek High-Intensity",
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

/**
 * Lean Beef Patty 5-day Glute & Physique split.
 * Glutes & Hams · Upper Pull · Quads & Glutes · Upper Push · Full Legs
 */
export const createLeanBeefPattyTemplate = mutation({
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
        name: "Glutes & Hamstrings",
        dayOfWeek: 1, // Monday
        order: 0,
        muscleGroups: ["glutes", "hamstrings", "calves"],
        exercises: [
          { name: "Hip Thrust",          repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Romanian Deadlift",   repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Leg Curl",            repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Seated Leg Curl",     repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Standing Calf Raise", repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
        ],
      },
      {
        name: "Upper Pull",
        dayOfWeek: 2, // Tuesday
        order: 1,
        muscleGroups: ["back", "biceps", "shoulders"],
        exercises: [
          { name: "Lat Pulldown",          repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Cable Row",             repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Cable Face Pull",       repRangeMin: 15, repRangeMax: 20, targetSets: 3, setType: "regular" as const },
          { name: "Incline Dumbbell Curl", repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Hammer Curl",           repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Quads & Glutes",
        dayOfWeek: 4, // Thursday
        order: 2,
        muscleGroups: ["quads", "glutes", "calves"],
        exercises: [
          { name: "Leg Press",           repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Hack Squat",          repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Leg Extension",       repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Hip Thrust",          repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Seated Calf Raise",   repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
        ],
      },
      {
        name: "Upper Push",
        dayOfWeek: 5, // Friday
        order: 3,
        muscleGroups: ["chest", "shoulders", "triceps"],
        exercises: [
          { name: "Incline Dumbbell Press",    repRangeMin: 8,  repRangeMax: 12, targetSets: 4, setType: "regular" as const },
          { name: "Machine Chest Press",        repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Machine Shoulder Press",    repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Cable Lateral Raise",        repRangeMin: 15, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Cable Tricep Pushdown",     repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
        ],
      },
      {
        name: "Full Legs",
        dayOfWeek: 6, // Saturday
        order: 4,
        muscleGroups: ["quads", "hamstrings", "glutes", "calves"],
        exercises: [
          { name: "Barbell Back Squat",  repRangeMin: 6,  repRangeMax: 10, targetSets: 4, setType: "regular" as const },
          { name: "Romanian Deadlift",   repRangeMin: 8,  repRangeMax: 12, targetSets: 3, setType: "regular" as const },
          { name: "Leg Extension",       repRangeMin: 12, repRangeMax: 20, targetSets: 3, setType: "myorep" as const },
          { name: "Leg Curl",            repRangeMin: 10, repRangeMax: 15, targetSets: 3, setType: "regular" as const },
          { name: "Standing Calf Raise", repRangeMin: 10, repRangeMax: 20, targetSets: 4, setType: "regular" as const },
        ],
      },
    ];

    const volumeTargets = [
      { muscleGroup: "glutes",      mev: 12, mav: 20, mrv: 26 },
      { muscleGroup: "hamstrings",  mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "quads",       mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "calves",      mev: 8,  mav: 14, mrv: 20 },
      { muscleGroup: "back",        mev: 10, mav: 16, mrv: 22 },
      { muscleGroup: "biceps",      mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "shoulders",   mev: 8,  mav: 14, mrv: 20 },
      { muscleGroup: "chest",       mev: 8,  mav: 12, mrv: 18 },
      { muscleGroup: "triceps",     mev: 6,  mav: 10, mrv: 16 },
    ];

    // Pause any currently active mesocycle
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();
    if (activeMeso) await ctx.db.patch(activeMeso._id, { status: "paused" });

    const mesoId = await ctx.db.insert("mesocycles", {
      userId: args.userId,
      name: "Lean Beef Patty Glute Build",
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
