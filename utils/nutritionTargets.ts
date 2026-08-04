// Katch-McArdle BMR + RP-style macro split.
// Shared by the Fuel screen (auto-init) and Profile (explicit goal switch).

export type Goal = "cut" | "bulk" | "maintain";

export type TargetProfile = {
  weightKg: number; currentBf: number; targetBf: number;
  weeklyGoal: number; sex: string; age: number; heightCm: number;
  experienceLevel?: "beginner" | "intermediate" | "advanced";
};

export type FoodTargets = {
  calories: number; proteinG: number; carbsG: number; fatG: number; goal: Goal;
};

// Calorie offset applied to TDEE for each goal.
const GOAL_KCAL_DELTA: Record<Goal, number> = {
  cut:      -400,
  bulk:     250,
  maintain: 0,
};

export const GOAL_LABEL: Record<Goal, string> = {
  cut:      "Cut",
  bulk:     "Bulk",
  maintain: "Maintain",
};

export function calcTdee(profile: TargetProfile): number {
  const lbm = profile.weightKg * (1 - profile.currentBf / 100);
  const bmr = 370 + 21.6 * lbm;
  // Activity factor by training days/week, defined across the full 0–7 range so
  // 6–7×/week no longer silently falls back to the 3×/week factor (underfeeding
  // the most active users) and 1–2×/week is no longer overfed.
  const actMap: Record<number, number> = {
    0: 1.35, 1: 1.40, 2: 1.45, 3: 1.55, 4: 1.60, 5: 1.725, 6: 1.80, 7: 1.90,
  };
  const days = Math.min(7, Math.max(0, Math.round(profile.weeklyGoal)));
  return bmr * (actMap[days] ?? 1.55);
}

// Split a calorie budget into protein/fat/carbs. Protein per kg of lean body
// mass, not total bodyweight — total-BW targets overshoot for high-BF users.
// ~2.8 g/kg LBM on a cut, ~2.5 otherwise (roughly equivalent to 2.5/2.2 g/kg
// total BW for a lean lifter). Fat is 27% of kcal, carbs fill the remainder.
// Rounding order (protein → fat → carbs) is load-bearing: callers that used to
// inline this math must keep byte-identical outputs.
function splitMacros(profile: TargetProfile, calories: number, isCut: boolean) {
  const lbm      = profile.weightKg * (1 - profile.currentBf / 100);
  const proteinG = Math.round(lbm * (isCut ? 2.8 : 2.5));
  const fatG     = Math.round(calories * 0.27 / 9);
  const carbsG   = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, fatG, carbsG };
}

// Targets for an explicit goal — used when the user picks cut/bulk/maintain.
export function calcTargetsForGoal(profile: TargetProfile, goal: Goal): FoodTargets {
  const tdee     = calcTdee(profile);
  const calories = Math.round(tdee + GOAL_KCAL_DELTA[goal]);
  const macros   = splitMacros(profile, calories, goal === "cut");
  return { calories, ...macros, goal };
}

// Targets for an explicit calorie delta off TDEE — used by the roadmap engine
// when a phase's required weekly rate (via the 7700 kcal/kg model) differs from
// the fixed cut/bulk offsets. `goal` is the enum label persisted downstream.
export function calcTargetsForRate(
  profile: TargetProfile, kcalDelta: number, goal: Goal,
): FoodTargets {
  const calories = Math.round(calcTdee(profile) + kcalDelta);
  const macros   = splitMacros(profile, calories, goal === "cut");
  return { calories, ...macros, goal };
}

// Auto-derive the goal from the body-fat gap — used for the first-time default.
export function calcTargets(profile: TargetProfile): FoodTargets {
  const bfDiff = profile.currentBf - profile.targetBf;
  const goal: Goal = bfDiff > 3 ? "cut" : bfDiff < -3 ? "bulk" : "maintain";
  return calcTargetsForGoal(profile, goal);
}
