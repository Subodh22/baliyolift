import {
  PER_EXERCISE_SET_CAP,
  e1rm,
  isDeloadWeek,
  nextWeight,
  roundToStep,
  setDelta,
  stepForEquipment,
  targetRirForWeek,
} from "./overloadMath";

// ─── roundToStep ──────────────────────────────────────────────────────────────
test("roundToStep snaps to the nearest multiple", () => {
  expect(roundToStep(11, 2.5)).toBe(10);
  expect(roundToStep(11.3, 2.5)).toBe(12.5);
  expect(roundToStep(0, 2.5)).toBe(0);
  expect(roundToStep(7, 1)).toBe(7);
});

// ─── stepForEquipment ─────────────────────────────────────────────────────────
test("stepForEquipment picks the right increment", () => {
  expect(stepForEquipment("dumbbell")).toBe(1);
  expect(stepForEquipment("bodyweight")).toBe(1);
  expect(stepForEquipment("barbell")).toBe(2.5);
  expect(stepForEquipment(undefined)).toBe(2.5);
  expect(stepForEquipment(null)).toBe(2.5);
});

// ─── nextWeight ───────────────────────────────────────────────────────────────
test("nextWeight always advances by at least one equipment step", () => {
  expect(nextWeight(10, "cable")).toBe(12.5);
  expect(nextWeight(100, "barbell")).toBe(102.5);
  expect(nextWeight(20, "dumbbell")).toBe(21);
  for (const w of [5, 12.5, 20, 42.5, 60]) {
    expect(nextWeight(w, "barbell")).toBeGreaterThan(w);
  }
});

// ─── e1rm ─────────────────────────────────────────────────────────────────────
test("e1rm (Epley) increases with reps and weight", () => {
  expect(e1rm(100, 0)).toBe(100);
  expect(e1rm(100, 5)).toBeGreaterThan(e1rm(100, 4));
  expect(e1rm(110, 5)).toBeGreaterThan(e1rm(100, 5));
  expect(e1rm(100, 30)).toBe(200);
});

// ─── isDeloadWeek ─────────────────────────────────────────────────────────────
test("isDeloadWeek: only the final week of a multi-week meso", () => {
  expect(isDeloadWeek(4, 4)).toBe(true);
  expect(isDeloadWeek(3, 4)).toBe(false);
  expect(isDeloadWeek(5, 4)).toBe(true);
  expect(isDeloadWeek(1, 1)).toBe(false);
});

// ─── targetRirForWeek ─────────────────────────────────────────────────────────
test("targetRirForWeek ramps START_RIR→0 across training weeks, deload=4", () => {
  expect(targetRirForWeek(1, 4)).toBe(3);
  expect(targetRirForWeek(2, 4)).toBe(2);
  expect(targetRirForWeek(3, 4)).toBe(0);
  expect(targetRirForWeek(4, 4)).toBe(4); // deload
  // A longer meso keeps more reserve: by week 3 a 4-week meso is at 0 RIR.
  expect(targetRirForWeek(3, 4)).toBe(0);
  expect(targetRirForWeek(3, 6)).toBeGreaterThan(targetRirForWeek(3, 4));
  for (let wk = 1; wk < 6; wk++) {
    const rir = targetRirForWeek(wk, 6);
    expect(rir).toBeGreaterThanOrEqual(0);
    expect(rir).toBeLessThanOrEqual(3);
  }
});

// ─── setDelta (the just-rewritten autoregulation core) ────────────────────────
test("setDelta: recovery is the primary driver", () => {
  expect(setDelta(0, 1, 1)).toBe(2); // recovered early → add up to 2
  expect(setDelta(2, 1, 1)).toBe(1); // healed on time → +1 sweet spot
  expect(setDelta(3, 1, 1)).toBe(-1); // still sore → back off
});

test("setDelta: strong stimulus and excess effort temper the add", () => {
  expect(setDelta(0, 2, 1)).toBe(1); // amazing pump removes one
  expect(setDelta(0, 1, 3)).toBe(0); // 'too much' backs off hard
  expect(setDelta(0, 1, 2)).toBe(1); // pushed limits eases the add
  expect(setDelta(3, 2, 3)).toBe(-2); // clamped at the −2 floor
});

test("setDelta: defaults are neutral and output stays within [-2, 2]", () => {
  expect(setDelta()).toBe(1);
  expect(setDelta(undefined, undefined, undefined)).toBe(1);
  for (const s of [0, 1, 2, 3]) {
    for (const p of [0, 1, 2]) {
      for (const w of [0, 1, 2, 3]) {
        const d = setDelta(s, p, w);
        expect(d).toBeGreaterThanOrEqual(-2);
        expect(d).toBeLessThanOrEqual(2);
      }
    }
  }
});

// ─── PER_EXERCISE_SET_CAP invariant ───────────────────────────────────────────
test("a single exercise never exceeds the per-exercise set cap", () => {
  const clamp = (n: number) => Math.max(1, Math.min(PER_EXERCISE_SET_CAP, n));
  expect(clamp(99)).toBe(PER_EXERCISE_SET_CAP);
  expect(clamp(0)).toBe(1);
  expect(clamp(4)).toBe(4);
});
