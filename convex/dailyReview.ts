import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// End-of-day review summary for a single user, built for a scheduled "coach"
// agent that reads it once per day and reports what needs to change.
//
// Callers pass a LOCAL calendar day (`date`, "YYYY-MM-DD") plus the user's UTC
// offset in minutes (`tzOffsetMinutes`, e.g. Melbourne AEDT = 660, AEST = 600).
// Food + weight are keyed by local day directly; workouts are keyed by a
// millisecond timestamp, so we derive the local-day ms window from those args.
// Convex functions run in UTC, so we never build day keys from the server clock.

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// `date` shifted by `days`, anchored at noon so DST never bumps the day.
function offsetDay(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export const dailyReview = query({
  args: {
    clerkId:         v.string(),
    date:            v.string(),           // local "YYYY-MM-DD" to review
    tzOffsetMinutes: v.optional(v.number()), // user's offset from UTC (default 0)
  },
  handler: async (ctx, { clerkId, date, tzOffsetMinutes }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
      .first();
    if (!user) throw new Error(`No user found for clerkId: ${clerkId}`);
    const userId = user._id;

    const tz = tzOffsetMinutes ?? 0;
    // Local midnight expressed in UTC ms: parse the day as UTC, then back the
    // offset out (Melbourne local 00:00 == UTC 14:00 the day before).
    const dayStartMs = Date.parse(date + "T00:00:00Z") - tz * 60_000;
    const dayEndMs   = dayStartMs + 24 * 60 * 60 * 1000;

    // ── Nutrition: today's entries + targets ─────────────────────────────────
    const foodTarget = await ctx.db
      .query("foodTargets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const foodEntries = await ctx.db
      .query("foodEntries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();

    const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    const byMeal: Record<string, { calories: number; proteinG: number; items: number }> = {
      breakfast: { calories: 0, proteinG: 0, items: 0 },
      lunch:     { calories: 0, proteinG: 0, items: 0 },
      dinner:    { calories: 0, proteinG: 0, items: 0 },
      snack:     { calories: 0, proteinG: 0, items: 0 },
    };
    for (const e of foodEntries) {
      totals.calories += e.calories;
      totals.proteinG += e.proteinG;
      totals.carbsG   += e.carbsG;
      totals.fatG     += e.fatG;
      const m = byMeal[e.mealType];
      if (m) { m.calories += e.calories; m.proteinG += e.proteinG; m.items += 1; }
    }

    const nutrition = {
      target: foodTarget
        ? { calories: foodTarget.calories, proteinG: foodTarget.proteinG, carbsG: foodTarget.carbsG, fatG: foodTarget.fatG, goal: foodTarget.goal }
        : null,
      logged: {
        calories: Math.round(totals.calories),
        proteinG: Math.round(totals.proteinG),
        carbsG:   Math.round(totals.carbsG),
        fatG:     Math.round(totals.fatG),
        entryCount: foodEntries.length,
      },
      remaining: foodTarget
        ? { calories: Math.round(foodTarget.calories - totals.calories), proteinG: Math.round(foodTarget.proteinG - totals.proteinG) }
        : null,
      byMeal,
      items: foodEntries.map((e) => ({ mealType: e.mealType, name: e.name, calories: e.calories, proteinG: e.proteinG })),
    };

    // ── Bodyweight: today + 30-day trend ─────────────────────────────────────
    const fromDate = offsetDay(date, -30);
    const weightRows = await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", fromDate))
      .filter((q) => q.lte(q.field("date"), date))
      .collect();
    weightRows.sort((a, b) => a.date.localeCompare(b.date));

    const todayWeight = weightRows.find((w) => w.date === date)?.weightKg ?? null;
    const firstW = weightRows[0];
    const lastW  = weightRows[weightRows.length - 1];
    const weight = {
      today: todayWeight,
      loggedToday: todayWeight !== null,
      trend30d: weightRows.map((w) => ({ date: w.date, weightKg: w.weightKg })),
      deltaKg: firstW && lastW && firstW !== lastW ? Math.round((lastW.weightKg - firstW.weightKg) * 10) / 10 : 0,
    };

    const profile = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // ── Training: today's logged workout(s) ──────────────────────────────────
    const todaysWorkouts = await ctx.db
      .query("workouts")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", dayStartMs))
      .filter((q) => q.lt(q.field("date"), dayEndMs))
      .collect();

    const workoutSummaries = await Promise.all(
      todaysWorkouts.map(async (w) => {
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_workout", (q) => q.eq("workoutId", w._id))
          .filter((q) => q.eq(q.field("isWarmup"), false))
          .collect();
        const feedback = await ctx.db
          .query("sessionFeedback")
          .withIndex("by_workout", (q) => q.eq("workoutId", w._id))
          .collect();
        const session = w.sessionId ? await ctx.db.get(w.sessionId) : null;
        const totalVolume = Math.round(sets.reduce((s, x) => s + x.weight * x.reps, 0));
        const totalReps   = sets.reduce((s, x) => s + x.reps, 0);
        return {
          name: session?.name ?? "Workout",
          status: w.status,
          weekNumber: w.weekNumber,
          durationMin: w.durationMs ? Math.round(w.durationMs / 60000) : null,
          setCount: sets.length,
          totalReps,
          totalVolume,
          exerciseCount: new Set(sets.map((s) => s.exerciseId as string)).size,
          feedback: feedback.map((f) => ({
            muscleGroup: f.muscleGroup,
            perExercise: f.exerciseId != null,
            soreness: f.soreness ?? null,
            pump: f.pump ?? null,
            workload: f.workload ?? null,
          })),
        };
      })
    );

    // ── Weekly volume per muscle vs meso landmarks (MEV / MAV / MRV) ──────────
    const activeMeso = await ctx.db
      .query("mesocycles")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();

    let mesocycle: {
      name: string;
      weeks: number;
      currentWeek: number | null;
      volumeByMuscle: { muscleGroup: string; sets: number; mev: number; mav: number; mrv: number; status: string }[];
    } | null = null;

    if (activeMeso) {
      // Mon–Sun window containing `date`, in local-day ms.
      const dow = new Date(date + "T12:00:00").getDay();     // 0=Sun..6=Sat
      const daysFromMon = (dow + 6) % 7;
      const weekStartDay = offsetDay(date, -daysFromMon);
      const weekStartMs = Date.parse(weekStartDay + "T00:00:00Z") - tz * 60_000;
      const weekEndMs   = weekStartMs + 7 * 24 * 60 * 60 * 1000;

      const weekWorkouts = await ctx.db
        .query("workouts")
        .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", weekStartMs))
        .filter((q) => q.and(q.lt(q.field("date"), weekEndMs), q.eq(q.field("mesocycleId"), activeMeso._id)))
        .collect();

      const setsPerMuscle: Record<string, number> = {};
      const exCache = new Map<string, string | null>(); // exerciseId → muscleGroup
      for (const w of weekWorkouts) {
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_workout", (q) => q.eq("workoutId", w._id))
          .filter((q) => q.eq(q.field("isWarmup"), false))
          .collect();
        for (const s of sets) {
          const exId = s.exerciseId as string;
          if (!exCache.has(exId)) {
            const ex = await ctx.db.get(s.exerciseId as Id<"exercises">);
            exCache.set(exId, ex?.muscleGroup ?? null);
          }
          const mg = exCache.get(exId);
          if (mg) setsPerMuscle[mg] = (setsPerMuscle[mg] ?? 0) + 1;
        }
      }

      const startMs = activeMeso.startDate;
      const currentWeek = startMs ? Math.floor((dayStartMs - startMs) / (7 * 24 * 60 * 60 * 1000)) + 1 : null;

      const muscles = new Set<string>([
        ...activeMeso.volumeTargets.map((t) => t.muscleGroup),
        ...Object.keys(setsPerMuscle),
      ]);
      mesocycle = {
        name: activeMeso.name,
        weeks: activeMeso.weeks,
        currentWeek,
        volumeByMuscle: Array.from(muscles).map((mg) => {
          const t = activeMeso.volumeTargets.find((x) => x.muscleGroup === mg);
          const sets = setsPerMuscle[mg] ?? 0;
          const mev = t?.mev ?? 0, mav = t?.mav ?? 0, mrv = t?.mrv ?? 0;
          let status = "no-target";
          if (t) {
            if (sets < mev) status = "below-mev";
            else if (sets <= mav) status = "productive";
            else if (sets <= mrv) status = "high";
            else status = "over-mrv";
          }
          return { muscleGroup: mg, sets, mev, mav, mrv, status };
        }).sort((a, b) => a.muscleGroup.localeCompare(b.muscleGroup)),
      };
    }

    return {
      date,
      user: { name: user.name, experienceLevel: user.experienceLevel, unitSystem: user.unitSystem },
      goals: profile
        ? { currentBf: profile.currentBf, targetBf: profile.targetBf, weeklyGoal: profile.weeklyGoal }
        : null,
      nutrition,
      weight,
      training: { workoutsToday: workoutSummaries.length, workouts: workoutSummaries },
      mesocycle,
    };
  },
});
