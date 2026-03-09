// Muscle group metadata — RP default MEV/MAV/MRV by experience level
// Source: Renaissance Periodization volume landmarks

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "forearms";

export interface VolumeDefaults {
  mev: number;
  mav: number;
  mrv: number;
}

// Sets per week defaults
export const VOLUME_DEFAULTS: Record<
  MuscleGroup,
  Record<"beginner" | "intermediate" | "advanced", VolumeDefaults>
> = {
  chest: {
    beginner:     { mev: 8,  mav: 12, mrv: 16 },
    intermediate: { mev: 10, mav: 16, mrv: 20 },
    advanced:     { mev: 12, mav: 18, mrv: 22 },
  },
  back: {
    beginner:     { mev: 10, mav: 14, mrv: 18 },
    intermediate: { mev: 12, mav: 18, mrv: 22 },
    advanced:     { mev: 14, mav: 20, mrv: 25 },
  },
  shoulders: {
    beginner:     { mev: 6,  mav: 12, mrv: 18 },
    intermediate: { mev: 8,  mav: 16, mrv: 22 },
    advanced:     { mev: 10, mav: 18, mrv: 26 },
  },
  biceps: {
    beginner:     { mev: 6,  mav: 10, mrv: 14 },
    intermediate: { mev: 8,  mav: 14, mrv: 18 },
    advanced:     { mev: 10, mav: 16, mrv: 20 },
  },
  triceps: {
    beginner:     { mev: 6,  mav: 10, mrv: 14 },
    intermediate: { mev: 8,  mav: 14, mrv: 18 },
    advanced:     { mev: 10, mav: 16, mrv: 20 },
  },
  quads: {
    beginner:     { mev: 8,  mav: 14, mrv: 18 },
    intermediate: { mev: 10, mav: 16, mrv: 20 },
    advanced:     { mev: 12, mav: 18, mrv: 22 },
  },
  hamstrings: {
    beginner:     { mev: 6,  mav: 10, mrv: 14 },
    intermediate: { mev: 8,  mav: 12, mrv: 16 },
    advanced:     { mev: 10, mav: 14, mrv: 18 },
  },
  glutes: {
    beginner:     { mev: 0,  mav: 8,  mrv: 16 },
    intermediate: { mev: 4,  mav: 12, mrv: 20 },
    advanced:     { mev: 6,  mav: 16, mrv: 22 },
  },
  calves: {
    beginner:     { mev: 6,  mav: 10, mrv: 14 },
    intermediate: { mev: 8,  mav: 14, mrv: 18 },
    advanced:     { mev: 10, mav: 16, mrv: 20 },
  },
  abs: {
    beginner:     { mev: 0,  mav: 8,  mrv: 16 },
    intermediate: { mev: 4,  mav: 12, mrv: 20 },
    advanced:     { mev: 6,  mav: 16, mrv: 25 },
  },
  forearms: {
    beginner:     { mev: 0,  mav: 6,  mrv: 10 },
    intermediate: { mev: 0,  mav: 8,  mrv: 14 },
    advanced:     { mev: 4,  mav: 10, mrv: 16 },
  },
};

export const MUSCLE_DISPLAY_NAMES: Record<MuscleGroup, string> = {
  chest:      "Chest",
  back:       "Back",
  shoulders:  "Shoulders",
  biceps:     "Biceps",
  triceps:    "Triceps",
  quads:      "Quads",
  hamstrings: "Hamstrings",
  glutes:     "Glutes",
  calves:     "Calves",
  abs:        "Abs",
  forearms:   "Forearms",
};

export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "abs", "forearms",
];
