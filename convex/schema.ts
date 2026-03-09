import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // --- Users ---
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    experienceLevel: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
    unitSystem: v.union(v.literal("kg"), v.literal("lbs")),
    createdAt: v.number(),
  }).index("by_clerk", ["clerkId"]),

  // --- Exercise Library ---
  exercises: defineTable({
    name: v.string(),
    muscleGroup: v.union(
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
      v.literal("forearms")
    ),
    equipment: v.union(
      v.literal("barbell"),
      v.literal("dumbbell"),
      v.literal("cable"),
      v.literal("machine"),
      v.literal("bodyweight"),
      v.literal("other")
    ),
    sfr: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    isCustom: v.boolean(),
    userId: v.optional(v.id("users")),
    instructions: v.optional(v.string()),
  })
    .index("by_muscle_group", ["muscleGroup"])
    .index("by_user", ["userId"]),

  // --- Mesocycles ---
  mesocycles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    startDate: v.number(),
    weeks: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("deload"),
      v.literal("draft")
    ),
    volumeTargets: v.array(
      v.object({
        muscleGroup: v.string(),
        mev: v.number(),
        mav: v.number(),
        mrv: v.number(),
      })
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  // --- Sessions (days within a mesocycle) ---
  sessions: defineTable({
    mesocycleId: v.id("mesocycles"),
    userId: v.id("users"),
    dayOfWeek: v.number(),
    name: v.string(),
    exerciseIds: v.array(v.id("exercises")),
    order: v.number(),
    muscleGroups: v.optional(v.array(v.string())),
  }).index("by_mesocycle", ["mesocycleId"]),

  // --- Session Exercises (per-exercise config: rep ranges, set count, type) ---
  sessionExercises: defineTable({
    sessionId: v.id("sessions"),
    exerciseId: v.id("exercises"),
    order: v.number(),
    repRangeMin: v.number(),
    repRangeMax: v.number(),
    targetSets: v.number(),
    setType: v.union(
      v.literal("regular"),
      v.literal("myorep"),
      v.literal("myorep_match")
    ),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_exercise", ["sessionId", "exerciseId"]),

  // --- Workouts (actual logged instances of sessions) ---
  workouts: defineTable({
    userId: v.id("users"),
    sessionId: v.id("sessions"),
    mesocycleId: v.id("mesocycles"),
    date: v.number(),
    weekNumber: v.number(),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("skipped")
    ),
    durationMs: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_session", ["sessionId"]),

  // --- Sets (atomic unit of training) ---
  sets: defineTable({
    workoutId: v.id("workouts"),
    exerciseId: v.id("exercises"),
    userId: v.id("users"),
    weight: v.number(),
    reps: v.number(),
    rir: v.number(),
    targetRir: v.optional(v.number()),
    rpe: v.optional(v.number()),
    setNumber: v.number(),
    timestamp: v.number(),
    isWarmup: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("by_workout", ["workoutId"])
    .index("by_exercise_user", ["exerciseId", "userId"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  // --- Post-workout Feedback (drives progressive overload adjustments) ---
  sessionFeedback: defineTable({
    workoutId: v.id("workouts"),
    userId: v.id("users"),
    muscleGroup: v.string(),
    soreness: v.number(), // 0=never, 1=long ago, 2=just in time, 3=still sore
    pump: v.number(),     // 0=low, 1=moderate, 2=amazing
    workload: v.number(), // 0=easy, 1=good, 2=pushed limits, 3=too much
    notes: v.optional(v.string()),
  })
    .index("by_workout", ["workoutId"])
    .index("by_user_muscle", ["userId", "muscleGroup"]),
});
