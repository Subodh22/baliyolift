// Katch-McArdle BMR + RP-style macro split.
// Shared by the Fuel screen (auto-init) and Profile (explicit goal switch).

export type Goal = "cut" | "bulk" | "maintain";

export type TargetProfile = {
  weightKg: number; currentBf: number; targetBf: number;
  weeklyGoal: number; sex: string; age: number; heightCm: number;
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
  const actMap: Record<number, number> = { 3: 1.55, 4: 1.60, 5: 1.725 };
  return bmr * (actMap[profile.weeklyGoal] ?? 1.55);
}

// Targets for an explicit goal — used when the user picks cut/bulk/maintain.
export function calcTargetsForGoal(profile: TargetProfile, goal: Goal): FoodTargets {
  const tdee     = calcTdee(profile);
  const calories = Math.round(tdee + GOAL_KCAL_DELTA[goal]);
  const proteinG = Math.round(profile.weightKg * (goal === "cut" ? 2.5 : 2.2));
  const fatG     = Math.round(calories * 0.27 / 9);
  const carbsG   = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { calories, proteinG, carbsG, fatG, goal };
}

// Auto-derive the goal from the body-fat gap — used for the first-time default.
export function calcTargets(profile: TargetProfile): FoodTargets {
  const bfDiff = profile.currentBf - profile.targetBf;
  const goal: Goal = bfDiff > 3 ? "cut" : bfDiff < -3 ? "bulk" : "maintain";
  return calcTargetsForGoal(profile, goal);
}
