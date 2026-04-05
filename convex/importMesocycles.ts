import { v } from "convex/values";
import { mutation } from "./_generated/server";

// ── Import a mesocycle from a JSON definition ─────────────────────────────────
//
// Exercises are resolved by name — they must already exist in the exercise
// library. Unmatched exercises are silently skipped.
// The mesocycle is created with "paused" status so you can review it before
// setting it active via the app.
//
// Usage:
//
//   npx convex run importMesocycles:importMesocycle \
//     --args '{"clerkId":"user_xxxx","meso":{...}}'
//
// Or pass the JSON from a file:
//
//   npx convex run importMesocycles:importMesocycle \
//     --args "$(node -e "const d=require('./data/my-meso.json'); process.stdout.write(JSON.stringify({clerkId:'user_xxxx',meso:d}))")"
//
export const importMesocycle = mutation({
  args: {
    clerkId: v.string(),
    meso: v.object({
      name: v.string(),
      weeks: v.number(),
      volumeTargets: v.optional(v.array(v.object({
        muscleGroup: v.string(),
        mev: v.number(),
        mav: v.number(),
        mrv: v.number(),
      }))),
      sessions: v.array(v.object({
        name: v.string(),
        dayOfWeek: v.number(),
        muscleGroups: v.array(v.string()),
        order: v.number(),
        exercises: v.array(v.object({
          name: v.string(),
          repRangeMin: v.number(),
          repRangeMax: v.number(),
          targetSets: v.number(),
          setType: v.union(
            v.literal("regular"),
            v.literal("myorep"),
            v.literal("myorep_match"),
          ),
        })),
      })),
    }),
  },
  handler: async (ctx, { clerkId, meso }) => {
    // Resolve clerkId → internal userId
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
      .first();
    if (!user) throw new Error(`No user found for clerkId: ${clerkId}`);
    const userId = user._id;

    const mesoId = await ctx.db.insert("mesocycles", {
      userId,
      name: meso.name,
      startDate: Date.now(),
      weeks: meso.weeks,
      status: "paused",
      volumeTargets: meso.volumeTargets ?? [],
    });

    let totalExercisesMatched = 0;
    let totalExercisesMissed = 0;

    for (const sessionDef of meso.sessions) {
      const allExIds: any[] = [];
      const seInputs: {
        exerciseId: any;
        repMin: number; repMax: number;
        targetSets: number;
        setType: "regular" | "myorep" | "myorep_match";
      }[] = [];

      for (const exDef of sessionDef.exercises) {
        const ex = await ctx.db
          .query("exercises")
          .filter((q) => q.eq(q.field("name"), exDef.name))
          .first();
        if (ex) {
          allExIds.push(ex._id);
          seInputs.push({
            exerciseId: ex._id,
            repMin: exDef.repRangeMin,
            repMax: exDef.repRangeMax,
            targetSets: exDef.targetSets,
            setType: exDef.setType,
          });
          totalExercisesMatched++;
        } else {
          totalExercisesMissed++;
        }
      }

      const sessionId = await ctx.db.insert("sessions", {
        mesocycleId: mesoId,
        userId,
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
          targetSets: se.targetSets,
          setType: se.setType,
        });
      }
    }

    return {
      mesoId,
      sessions: meso.sessions.length,
      exercisesMatched: totalExercisesMatched,
      exercisesMissed: totalExercisesMissed,
    };
  },
});
