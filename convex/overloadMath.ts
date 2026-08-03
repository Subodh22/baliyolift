/**
 * Pure, dependency-free math for the overload / RP progression engine.
 *
 * These functions live outside `overload.ts` so they can be unit-tested without
 * pulling in the Convex generated server runtime. They contain NO database or
 * `ctx` access — same inputs always give the same output. `overload.ts` imports
 * from here; behaviour is identical to when they lived inline.
 */

/** Round to nearest step. */
export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Smallest sensible load increment for a given equipment type (kg). */
export function stepForEquipment(equipment?: string | null): number {
  switch (equipment) {
    case "dumbbell": return 1;   // small dumbbells / micro-loading
    case "bodyweight": return 1; // added load, when any
    default: return 2.5;         // barbell (1.25/side), cable, machine, other
  }
}

/**
 * Next working weight — ~2.5% progression, snapped up to at least one equipment
 * step. Percent-based so light isolation work and heavy compounds both advance
 * sensibly, and rounded to the equipment step so sub-20 kg loads actually move
 * (the old `+1 then round-to-2.5` snapped straight back).
 */
export function nextWeight(current: number, equipment?: string | null): number {
  const step = stepForEquipment(equipment);
  const inc = Math.max(step, roundToStep(current * 0.025, step));
  return roundToStep(current + inc, step);
}

/** Estimated 1RM (Epley) — used only to pick the best working set as reference. */
export function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export const START_RIR = 3;

/** Hard ceiling on suggested working sets for a single exercise in one session. */
export const PER_EXERCISE_SET_CAP = 5;

/**
 * The final week of a multi-week mesocycle is a programmed deload.
 * (A 1-week meso has no deload.)
 */
export function isDeloadWeek(weekNumber: number, totalWeeks: number): boolean {
  return totalWeeks > 1 && weekNumber >= totalWeeks;
}

/**
 * Week-based target RIR — RP mesocycle progression scaled to the meso length.
 * RIR ramps from START_RIR (most reserve) down to 0 (near failure) across the
 * training weeks, then the final week deloads at a high RIR. Interpolating on
 * `totalWeeks` means a 5- or 6-week meso no longer grinds at failure for its
 * last weeks the way a hardcoded 4-week ramp did.
 */
export function targetRirForWeek(weekNumber: number, totalWeeks: number): number {
  if (isDeloadWeek(weekNumber, totalWeeks)) return 4; // deload — stay well shy of failure
  const trainingWeeks = totalWeeks > 1 ? totalWeeks - 1 : totalWeeks;
  if (trainingWeeks <= 1) return START_RIR;
  const w = Math.min(Math.max(weekNumber, 1), trainingWeeks);
  return Math.round(START_RIR * (1 - (w - 1) / (trainingWeeks - 1)));
}

/**
 * RP set-progression delta — bottom-up autoregulation. Given a muscle's
 * post-workout feedback for one session, returns how many working sets to
 * change for that muscle's NEXT session (typically −2…+2).
 *
 * Signals (matching FeedbackModal): soreness = recovery (0 never sore …
 * 3 still sore), pump = stimulus (0 low … 2 amazing), workload = effort /
 * disruption (0 easy … 3 too much).
 *
 * Recovery is the primary driver — recovered early leaves room to add ~2 sets,
 * "healed just on time" is the sweet spot for +1, still-sore means back off.
 * A strong stimulus (amazing pump) or excessive effort tempers the add so we
 * approach MRV without overshooting into junk volume.
 */
export function setDelta(soreness?: number, pump?: number, workload?: number): number {
  const s = soreness ?? 2, p = pump ?? 1, w = workload ?? 1;
  let delta = s >= 3 ? -1 : s === 2 ? 1 : 2; // recovery headroom
  if (p >= 2) delta -= 1;        // amazing pump — stimulus already sufficient
  if (w >= 3) delta -= 2;        // "too much" — back off
  else if (w >= 2) delta -= 1;   // pushed limits — ease the add
  return Math.max(-2, Math.min(2, delta));
}
