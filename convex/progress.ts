import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Estimated 1RM using effective reps (reps + RIR), a rep cap to tame Epley's
// high-rep inaccuracy, and 0 for weightless bodyweight sets. See sets.ts.
function estimated1RM(weight: number, reps: number, rir = 0): number {
  if (weight <= 0) return 0;
  const effectiveReps = Math.min(reps + rir, 12);
  return Math.round(weight * (1 + effectiveReps / 30));
}

export const getDashboard = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // ── All working sets for this user ────────────────────────────────────────
    const allSets = await ctx.db
      .query("sets")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isWarmup"), false))
      .order("desc")
      .collect();

    if (allSets.length === 0) return null;

    // ── Count sets per exercise ───────────────────────────────────────────────
    const countByEx: Record<string, number> = {};
    for (const s of allSets) {
      const id = s.exerciseId as string;
      countByEx[id] = (countByEx[id] ?? 0) + 1;
    }

    // ── PRs: best e1RM per exercise ───────────────────────────────────────────
    const bestByEx: Record<string, { weight: number; reps: number; e1rm: number; timestamp: number }> = {};
    for (const s of allSets) {
      const id = s.exerciseId as string;
      const e1rm = estimated1RM(s.weight, s.reps, s.rir);
      if (e1rm <= 0) continue; // skip bodyweight / weightless sets — no meaningful 1RM
      if (!bestByEx[id] || e1rm > bestByEx[id].e1rm) {
        bestByEx[id] = { weight: s.weight, reps: s.reps, e1rm, timestamp: s.timestamp };
      }
    }

    // Resolve exercise names for top 5 PRs
    const topPRExIds = Object.entries(bestByEx)
      .sort((a, b) => b[1].e1rm - a[1].e1rm)
      .slice(0, 5)
      .map(([id]) => id);

    const prs = await Promise.all(
      topPRExIds.map(async (id) => {
        const ex = await ctx.db.get(id as Id<"exercises">);
        return {
          exerciseId: id,
          name: ex?.name ?? "Unknown",
          muscleGroup: ex?.muscleGroup ?? "",
          ...bestByEx[id],
        };
      })
    );

    // ── Strength chart: most-trained exercise ─────────────────────────────────
    const topExId = Object.entries(countByEx).sort((a, b) => b[1] - a[1])[0][0];
    const topEx = await ctx.db.get(topExId as Id<"exercises">);

    // Group sets by workoutId, take best e1RM per session, last 10 sessions
    const workoutMap = new Map<string, { sets: typeof allSets; date: number; weekNumber: number }>();
    for (const s of allSets) {
      if ((s.exerciseId as string) !== topExId) continue;
      const key = s.workoutId as string;
      if (!workoutMap.has(key)) workoutMap.set(key, { sets: [], date: 0, weekNumber: 0 });
      workoutMap.get(key)!.sets.push(s);
    }

    // Resolve workout dates
    const chartPoints = await Promise.all(
      Array.from(workoutMap.entries()).map(async ([wid, { sets }]) => {
        const workout = await ctx.db.get(wid as Id<"workouts">);
        const topE1RM = Math.max(...sets.map((s) => estimated1RM(s.weight, s.reps, s.rir)));
        const topSet = sets.reduce((best, s) => estimated1RM(s.weight, s.reps, s.rir) > estimated1RM(best.weight, best.reps, best.rir) ? s : best);
        return {
          date: workout?.date ?? 0,
          weekNumber: workout?.weekNumber ?? 0,
          e1rm: topE1RM,
          weight: topSet.weight,
          reps: topSet.reps,
        };
      })
    );

    chartPoints.sort((a, b) => a.date - b.date);
    const chart = chartPoints.slice(-10);

    // ── Meso summary ──────────────────────────────────────────────────────────
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    const totalWorkouts = workouts.length;
    const totalSets = allSets.length;
    const totalVolume = Math.round(allSets.reduce((sum, s) => sum + s.weight * s.reps, 0));

    // Current meso stats
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();

    let mesoWorkouts = 0;
    let mesoSets = 0;
    let mesoVolume = 0;
    if (activeMeso) {
      const mesoWids = new Set(
        workouts.filter((w) => (w.mesocycleId as string) === (activeMeso._id as string)).map((w) => w._id as string)
      );
      mesoWorkouts = mesoWids.size;
      for (const s of allSets) {
        if (mesoWids.has(s.workoutId as string)) {
          mesoSets++;
          mesoVolume += s.weight * s.reps;
        }
      }
    }

    return {
      chart: {
        exerciseName: topEx?.name ?? "Top Exercise",
        points: chart,
      },
      prs,
      summary: {
        totalWorkouts,
        totalSets,
        totalVolume,
        mesoWorkouts,
        mesoSets,
        mesoVolume: Math.round(mesoVolume),
      },
    };
  },
});
