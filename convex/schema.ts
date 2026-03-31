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
      v.literal("forearms"),
      v.literal("cardio")
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
    videoUrl: v.optional(v.string()),
    // Cardio-specific fields
    category: v.optional(v.union(v.literal("strength"), v.literal("cardio"))),
    cardioMode: v.optional(v.union(
      v.literal("duration_pace"),   // treadmill, cycling — track time + distance
      v.literal("duration_only"),   // stairmaster, elliptical — track time + RPE
      v.literal("intervals")        // HIIT — track intervals, work/rest, RPE
    )),
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
      v.literal("draft"),
      v.literal("paused")
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

  // --- Cardio Sets ---
  cardioSets: defineTable({
    workoutId: v.id("workouts"),
    exerciseId: v.id("exercises"),
    userId: v.id("users"),
    setNumber: v.number(),
    durationSec: v.number(),           // total duration in seconds
    distanceM: v.optional(v.number()), // meters (for duration_pace mode)
    rpe: v.number(),                   // 1–10 RPE
    targetRpe: v.optional(v.number()),
    // Interval-specific
    intervalCount: v.optional(v.number()),
    intervalWorkSec: v.optional(v.number()),
    intervalRestSec: v.optional(v.number()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_workout", ["workoutId"])
    .index("by_exercise_user", ["exerciseId", "userId"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  // --- Progress Photos ---
  progressPhotos: defineTable({
    userId: v.id("users"),
    imageUrl: v.string(), // Cloudflare R2 public URL
    date: v.string(), // "YYYY-MM-DD" — one per day enforced at query level
    takenAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

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

  // --- User Profile / Goal Campaign ---
  userProfile: defineTable({
    userId: v.id("users"),
    sex: v.union(v.literal("male"), v.literal("female")),
    age: v.number(),
    heightCm: v.number(),
    weightKg: v.number(),
    neckCm: v.optional(v.number()),
    waistCm: v.optional(v.number()),
    hipCm: v.optional(v.number()), // women only
    currentBf: v.number(),         // Navy formula result at onboarding
    targetBf: v.number(),
    weeklyGoal: v.number(),        // workouts per week commitment
  }).index("by_user", ["userId"]),

  // --- Food Entries ---
  foodEntries: defineTable({
    userId: v.id("users"),
    date: v.string(),              // "YYYY-MM-DD"
    mealType: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack"),
    ),
    name: v.string(),
    calories: v.number(),
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
    timestamp: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user", ["userId"]),

  // --- Food Targets (Katch-McArdle TDEE + RP macro split) ---
  foodTargets: defineTable({
    userId: v.id("users"),
    calories: v.number(),
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
    goal: v.union(
      v.literal("cut"),
      v.literal("bulk"),
      v.literal("maintain"),
    ),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // --- Custom Foods (user-saved food library) ---
  customFoods: defineTable({
    userId: v.id("users"),
    name: v.string(),
    serving: v.string(),    // display string e.g. "100g", "1 scoop (30g)"
    servingG: v.number(),   // grams per serving (base for scaling)
    calories: v.number(),   // per servingG
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // --- Weight Entries (daily weigh-ins) ---
  weightEntries: defineTable({
    userId: v.id("users"),
    date: v.string(),      // "YYYY-MM-DD"
    weightKg: v.number(),
    timestamp: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user", ["userId"]),

  // --- Weekly Meal Planner Items (multiple per slot, with portions) ---
  mealPlanSlots: defineTable({
    userId:    v.id("users"),
    weekStart: v.string(),   // "YYYY-MM-DD" — always the Monday of that week
    dayIndex:  v.number(),   // 0=Mon … 6=Sun
    mealType:  v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack"),
    ),
    recipeId:  v.string(),
    portion:   v.optional(v.number()),   // multiplier: 0.5=half, 1.0=full, 2.0=double
    order:     v.optional(v.number()),   // display order within the meal slot
  })
    .index("by_user_week", ["userId", "weekStart"])
    .index("by_user_week_day", ["userId", "weekStart", "dayIndex"]),

  // --- Saved Meal Plan Recipes ---
  savedMealPlans: defineTable({
    userId: v.id("users"),
    recipeId: v.string(),
    savedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_recipe", ["userId", "recipeId"]),

  // --- Food Preferences (per-user, drives smart autofill + grocery list) ---
  foodPreferences: defineTable({
    userId:              v.id("users"),
    proteinSources:      v.array(v.string()),  // ["chicken","beef","eggs","fish","turkey","plant"]
    carbSources:         v.array(v.string()),  // ["rice","oats","pasta","potato","sweetPotato","bread"]
    fatSources:          v.array(v.string()),  // ["oliveOil","avocado","nuts","dairy"]
    excludedIngredients: v.array(v.string()),  // lowercased substrings to avoid
    plannedMealTypes:    v.array(v.string()),  // subset of ["breakfast","lunch","dinner","snack"]
    varietyLevel:        v.number(),           // 1=repeat  2=balanced  3=variety
    updatedAt:           v.number(),
  }).index("by_user", ["userId"]),

  // --- Global Recipe Library (shared across all users) ---
  recipes: defineTable({
    recipeId:     v.string(),   // slug e.g. "cut-egg-white-omelette"
    name:         v.string(),
    description:  v.string(),
    goal:         v.union(v.literal("cut"), v.literal("bulk"), v.literal("maintain")),
    mealType:     v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack"),
      v.literal("post-workout"),
      v.literal("sauce"),
      v.literal("smoothie"),
      v.literal("dessert"),
    ),
    prepTimeMins: v.number(),
    cookTimeMins: v.number(),
    tags:         v.array(v.string()),
    ingredients:  v.array(v.object({
      name:     v.string(),
      amount:   v.string(),
      calories: v.optional(v.number()),
      proteinG: v.optional(v.number()),
      carbsG:   v.optional(v.number()),
      fatG:     v.optional(v.number()),
    })),
    instructions: v.array(v.string()),
    totalMacros:  v.object({
      calories: v.number(),
      proteinG: v.number(),
      carbsG:   v.number(),
      fatG:     v.number(),
    }),
  })
    .index("by_recipe_id", ["recipeId"])
    .index("by_goal", ["goal"])
    .index("by_meal_type", ["mealType"]),
});
