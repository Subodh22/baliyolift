// Objective-driven goal-roadmap model.
//
// The user's OBJECTIVE is a first-class input — the engine no longer guesses
// intent from the body-fat gap. Given an objective + current composition +
// (optional) target + deadline, it produces an ordered sequence of diet phases
// (Cut / Lean Bulk / Mini-cut / Prep / Maintain / Recomp), each with its own
// calorie + macro target. Pure and deterministic — `startMs` is passed in (no
// Date.now() inside) so the client preview and the Convex mutation agree.
//
// Composition model: fat mass and lean mass are tracked separately and stepped
// week by week. Rates and partitioning are ATHLETE-DEPENDENT (experience, sex,
// aggressiveness), not global constants:
//  - Bulk: surplus partitions into lean/fat by a p-ratio that worsens as BF
//    climbs past the lean-bulk ceiling.
//  - Cut: loss is mostly fat, but a small share comes from lean mass as you
//    approach/pass essential levels (0 while above the ceiling).
//  - Recomp: at ~maintenance, a small amount of fat is reallocated to lean
//    (only modeled for athletes for whom recomp is realistic).
//  - Maintain: flat.
//
// Phase rates that must "land on" a target BF are solved numerically against the
// same simulation (binary search), so the simulation is the single source of
// truth and every plan terminates exactly on its objective's target.

import {
  calcTargetsForRate,
  type Goal,
  type TargetProfile,
} from "./nutritionTargets";

export type PhaseKind = "cut" | "bulk" | "maintain" | "prep";
export type Objective = "lose_fat" | "build_muscle" | "recomp" | "peak" | "maintain";
export type Aggressiveness = "conservative" | "standard" | "aggressive";
export type Experience = "beginner" | "intermediate" | "advanced";

export type RoadmapInput = {
  objective: Objective;
  targetBf?: number;          // required for lose_fat & peak; a bulk target/ceiling otherwise
  deadlineMs: number;
  hardDeadline?: boolean;     // don't auto-extend for safety (default: objective === "peak")
  aggressiveness?: Aggressiveness; // default "standard"
};

export type RoadmapPhase = {
  order: number;
  kind: PhaseKind;
  label: string;
  startWeekOffset: number;
  durationWeeks: number;
  startWeightKg: number;
  endWeightKg: number;
  startBf: number;
  endBf: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type Roadmap = {
  phases: RoadmapPhase[];
  objective: Objective;
  startMs: number;
  deadlineMs: number; // may be auto-extended past the requested deadline
  requestedDeadlineMs: number;
  targetBf: number;
  totalWeeks: number;
  feasible: boolean;
  adjusted: boolean; // true when we auto-extended the deadline
  note?: string;
};

// ── Tunable constants ─────────────────────────────────────────────────────────
const WEEK_MS = 7 * 86_400_000;
const KCAL_PER_KG = 7700;

// Weekly muscle-gain rate (fraction of bodyweight) scales with training age —
// novices gain several times faster than advanced lifters.
const EXP_BULK_RATE: Record<Experience, number> = {
  beginner: 0.0030, intermediate: 0.0018, advanced: 0.0010,
};
// Base weekly fat-loss rate; the safe cap is set separately by aggressiveness.
const EXP_CUT_RATE: Record<Experience, number> = {
  beginner: 0.0065, intermediate: 0.0060, advanced: 0.0055,
};
const AGGR_MULT: Record<Aggressiveness, number> = {
  conservative: 0.8, standard: 1.0, aggressive: 1.3,
};
const AGGR_SAFE_CUT: Record<Aggressiveness, number> = {
  conservative: 0.0065, standard: 0.0078, aggressive: 0.0100,
};

const LEAN_BULK_CEILING: Record<string, number> = { male: 15, female: 24 };
// Lowest body-fat the model will plan toward (below essential is unsafe).
const BF_FLOOR: Record<string, number> = { male: 6, female: 14 };

const MINICUT_WEEKS = 6;
const PREP_WEEKS_DEFAULT = 8;
const BULK_MAX_WEEKS = 16;
const MIN_PHASE_WEEKS = 3;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Athlete-dependent parameters ──────────────────────────────────────────────
type PlanParams = {
  cutRatePct: number;
  minicutRatePct: number;
  bulkRatePct: number;
  recompRatePct: number;
  safeCutMaxPct: number;
  ceiling: number;
  bfFloor: number;
  lbmShareAt: (bf: number) => number;   // surplus → share that is lean mass
  cutLbmLossAt: (bf: number) => number; // deficit → share of loss that is lean mass
};

function resolveParams(profile: TargetProfile, input: RoadmapInput): PlanParams {
  const exp: Experience = profile.experienceLevel ?? "intermediate";
  const aggr: Aggressiveness = input.aggressiveness ?? "standard";
  const mult = AGGR_MULT[aggr];
  const ceiling = LEAN_BULK_CEILING[profile.sex] ?? LEAN_BULK_CEILING.male;
  const bfFloor = BF_FLOOR[profile.sex] ?? BF_FLOOR.male;

  return {
    cutRatePct: EXP_CUT_RATE[exp] * mult,
    minicutRatePct: EXP_CUT_RATE[exp] * mult * 1.15,
    bulkRatePct: EXP_BULK_RATE[exp] * mult,
    // Simultaneous recomp is only realistic for novices or the notably over-fat.
    recompRatePct: exp === "beginner" ? 0.0015 : 0.0009,
    safeCutMaxPct: AGGR_SAFE_CUT[aggr],
    ceiling,
    bfFloor,
    // p-ratio: ~70% of surplus is lean while lean, falling ~2pt per BF-point
    // above the ceiling (bulking dirty stores more fat).
    lbmShareAt: (bf: number) => clamp(0.70 - 0.02 * Math.max(0, bf - ceiling), 0.35, 0.70),
    // Cuts are all-fat above the ceiling; below it a growing slice is lean mass.
    cutLbmLossAt: (bf: number) => bf >= ceiling ? 0 : clamp((ceiling - bf) * 0.02, 0, 0.20),
  };
}

// ── Body-composition simulation ───────────────────────────────────────────────
type Body = { bw: number; fat: number; lbm: number; bf: number };
type SimKind = "cut" | "bulk" | "maintain" | "recomp";

function bodyFrom(bw: number, bf: number): Body {
  const fat = (bw * bf) / 100;
  return { bw, fat, lbm: bw - fat, bf };
}

function withMass(fat: number, lbm: number): Body {
  const bw = fat + lbm;
  return { bw, fat, lbm, bf: bw > 0 ? (fat / bw) * 100 : 0 };
}

function stepWeek(b: Body, kind: SimKind, ratePct: number, p: PlanParams): Body {
  if (kind === "bulk") {
    const gain = b.bw * ratePct;
    const share = p.lbmShareAt(b.bf);
    return withMass(b.fat + (1 - share) * gain, b.lbm + share * gain);
  }
  if (kind === "cut") {
    const loss = b.bw * ratePct;
    const lbmShare = p.cutLbmLossAt(b.bf);
    return withMass(Math.max(0, b.fat - (1 - lbmShare) * loss), Math.max(0, b.lbm - lbmShare * loss));
  }
  if (kind === "recomp") {
    const move = b.bw * ratePct;
    return withMass(Math.max(0, b.fat - move), b.lbm + move);
  }
  return b; // maintain
}

function simulate(start: Body, kind: SimKind, ratePct: number, weeks: number, p: PlanParams): Body {
  let b = start;
  for (let i = 0; i < weeks; i++) b = stepWeek(b, kind, ratePct, p);
  return b;
}

// Natural whole-weeks to reach `targetBf` at a fixed rate (capped at maxWeeks).
function weeksToReach(start: Body, kind: SimKind, targetBf: number, ratePct: number, p: PlanParams, maxWeeks: number): number {
  let b = start;
  let w = 0;
  const cutting = kind === "cut";
  while (w < maxWeeks) {
    if (cutting ? b.bf <= targetBf : b.bf >= targetBf) break;
    b = stepWeek(b, kind, ratePct, p);
    w++;
  }
  return w;
}

// Solve the weekly rate that lands exactly on `targetBf` over `weeks` (binary
// search — endBf is monotonic in the rate for both cut and bulk).
function solveRate(start: Body, kind: SimKind, targetBf: number, weeks: number, p: PlanParams): number {
  if (weeks <= 0) return 0;
  let lo = 0, hi = 0.05;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    const endBf = simulate(start, kind, mid, weeks, p).bf;
    if (kind === "cut") {
      if (endBf > targetBf) lo = mid; else hi = mid; // faster cut ⇒ lower bf
    } else {
      if (endBf < targetBf) lo = mid; else hi = mid; // faster bulk ⇒ higher bf
    }
  }
  return (lo + hi) / 2;
}

// ── Phase specs & realization ─────────────────────────────────────────────────
type PhaseSpec = {
  kind: PhaseKind;
  label: string;
  weeks: number;
  sim: SimKind;
  toBf?: number;   // derive the rate to land here
  ratePct?: number; // fixed rate (ignored when toBf is set)
};

const mapGoal = (sim: SimKind): Goal => (sim === "bulk" ? "bulk" : sim === "cut" ? "cut" : "maintain");
const round1 = (n: number) => Math.round(n * 10) / 10;

function realize(specs: PhaseSpec[], start: Body, profile: TargetProfile, targetBf: number, p: PlanParams): RoadmapPhase[] {
  const phases: RoadmapPhase[] = [];
  let body = start;
  let offset = 0;
  let order = 0;

  for (const spec of specs) {
    if (spec.weeks <= 0) continue;
    let end: Body;
    if (spec.sim === "maintain") {
      end = body;
    } else if (spec.toBf !== undefined) {
      const rate = solveRate(body, spec.sim, spec.toBf, spec.weeks, p);
      end = simulate(body, spec.sim, rate, spec.weeks, p);
    } else {
      end = simulate(body, spec.sim, spec.ratePct ?? 0, spec.weeks, p);
    }

    const rateKg = (end.bw - body.bw) / spec.weeks;
    const kcalDelta = (rateKg * KCAL_PER_KG) / 7;
    const phaseProfile: TargetProfile = {
      ...profile,
      weightKg: body.bw,
      currentBf: body.bf,
      targetBf,
    };
    const macros = calcTargetsForRate(phaseProfile, kcalDelta, mapGoal(spec.sim));

    phases.push({
      order: order++,
      kind: spec.kind,
      label: spec.label,
      startWeekOffset: offset,
      durationWeeks: spec.weeks,
      startWeightKg: round1(body.bw),
      endWeightKg: round1(end.bw),
      startBf: round1(body.bf),
      endBf: round1(end.bf),
      calories: macros.calories,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
    });

    body = end;
    offset += spec.weeks;
  }
  return phases;
}

// ── Per-objective builders ────────────────────────────────────────────────────
// Straight cut to target, then hold. Never inserts a bulk.
function buildLoseFat(start: Body, target: number, W: number, p: PlanParams): PhaseSpec[] {
  const natural = weeksToReach(start, "cut", target, p.cutRatePct, p, W);
  const cutWeeks = clamp(natural || W, 1, W);
  const specs: PhaseSpec[] = [{ kind: "cut", label: "Cut", weeks: cutWeeks, sim: "cut", toBf: target }];
  if (W > cutWeeks) specs.push({ kind: "maintain", label: "Maintain", weeks: W - cutWeeks, sim: "maintain" });
  return specs;
}

// Bulk toward a target/ceiling; if it drifts over the ceiling and there's room,
// trim back with a mini-cut; then maintain any leftover window.
function buildBuildMuscle(start: Body, goalBf: number, W: number, p: PlanParams): PhaseSpec[] {
  const natural = weeksToReach(start, "bulk", goalBf, p.bulkRatePct, p, W);
  const bulkWeeks = clamp(natural || W, MIN_PHASE_WEEKS, W);
  const afterBulk = simulate(start, "bulk", p.bulkRatePct, bulkWeeks, p);
  const specs: PhaseSpec[] = [{ kind: "bulk", label: "Lean Bulk", weeks: bulkWeeks, sim: "bulk", ratePct: p.bulkRatePct }];

  let remaining = W - bulkWeeks;
  if (afterBulk.bf > p.ceiling + 0.5 && remaining >= MIN_PHASE_WEEKS) {
    const need = weeksToReach(afterBulk, "cut", p.ceiling, p.minicutRatePct, p, remaining);
    const trim = clamp(Math.min(need || remaining, remaining), MIN_PHASE_WEEKS, remaining);
    specs.push({ kind: "cut", label: "Mini-cut", weeks: trim, sim: "cut", toBf: p.ceiling });
    remaining -= trim;
  }
  if (remaining > 0) specs.push({ kind: "maintain", label: "Maintain", weeks: remaining, sim: "maintain" });
  return specs;
}

// Simultaneous fat-loss + muscle-gain at ~maintenance. Only realistic for
// novices or the notably over-fat; callers gate eligibility.
function buildRecomp(W: number, p: PlanParams): PhaseSpec[] {
  return [{ kind: "maintain", label: "Recomp", weeks: W, sim: "recomp", ratePct: p.recompRatePct }];
}

// Cut → bulk to the ceiling → re-lean, all sized so the FINAL phase lands
// exactly on the target (no fixed-length mini-cut overshoot).
function buildLeanThenGrow(start: Body, target: number, W: number, p: PlanParams): PhaseSpec[] {
  const leadCut = start.bf > p.ceiling + 0.5;
  const cutToCeil = leadCut ? weeksToReach(start, "cut", p.ceiling, p.cutRatePct, p, W) : 0;

  // Reserve a re-lean tail; if there isn't room for a meaningful bulk, fall back
  // to a straight cut to target.
  const reserveTail = MINICUT_WEEKS + PREP_WEEKS_DEFAULT;
  if (W < cutToCeil + reserveTail + MIN_PHASE_WEEKS) return buildLoseFat(start, target, W, p);

  const bulkWeeks = clamp(W - cutToCeil - reserveTail, MIN_PHASE_WEEKS, BULK_MAX_WEEKS);

  const afterCut = leadCut ? simulate(start, "cut", solveRate(start, "cut", p.ceiling, cutToCeil, p), cutToCeil, p) : start;
  const afterBulk = simulate(afterCut, "bulk", p.bulkRatePct, bulkWeeks, p);

  // Weeks the re-lean actually needs to reach target, so any slack becomes a
  // Maintain BEFORE the final cut rather than an overshoot after it.
  const remaining = W - cutToCeil - bulkWeeks;
  const need = weeksToReach(afterBulk, "cut", target, p.minicutRatePct, p, remaining);
  const prepWeeks = clamp(Math.min(need || remaining, remaining), MIN_PHASE_WEEKS, remaining);

  const specs: PhaseSpec[] = [];
  if (leadCut && cutToCeil > 0) specs.push({ kind: "cut", label: "Cut", weeks: cutToCeil, sim: "cut", toBf: p.ceiling });
  specs.push({ kind: "bulk", label: "Lean Bulk", weeks: bulkWeeks, sim: "bulk", ratePct: p.bulkRatePct });
  if (remaining > prepWeeks) specs.push({ kind: "maintain", label: "Maintain", weeks: remaining - prepWeeks, sim: "maintain" });
  specs.push({ kind: "prep", label: "Prep", weeks: prepWeeks, sim: "cut", toBf: target }); // sole lander ⇒ hits target
  return specs;
}

// Single derived cut across the whole window to land on the target ON the date.
function buildPeak(start: Body, target: number, W: number): PhaseSpec[] {
  return [{ kind: "prep", label: "Prep", weeks: W, sim: "cut", toBf: target }];
}

// ── Objective defaulting (back-compat) ────────────────────────────────────────
// Existing profiles have no stored objective — infer one from the BF gap so old
// plans keep generating.
export function inferObjective(currentBf: number, targetBf: number): Objective {
  const diff = currentBf - targetBf;
  if (diff > 3) return "lose_fat";
  if (diff < -3) return "build_muscle";
  return "maintain";
}

// ── Public entry point ────────────────────────────────────────────────────────
export function generateRoadmap(profile: TargetProfile, input: RoadmapInput, startMs: number): Roadmap {
  const objective = input.objective;
  const requestedDeadline = input.deadlineMs;

  const empty = (note: string, feasible = false): Roadmap => ({
    phases: [], objective, startMs, deadlineMs: requestedDeadline, requestedDeadlineMs: requestedDeadline,
    targetBf: input.targetBf ?? profile.currentBf, totalWeeks: 0, feasible, adjusted: false, note,
  });

  if (!(profile.weightKg > 0)) return empty("Add your weight to generate a plan.");
  if (requestedDeadline <= startMs) return empty("Deadline is in the past — pick a future date.");

  const p = resolveParams(profile, input);
  const start = bodyFrom(profile.weightKg, profile.currentBf);
  const hard = input.hardDeadline ?? (objective === "peak");
  const requestedWeeks = Math.max(1, Math.floor((requestedDeadline - startMs) / WEEK_MS));

  // Resolve the effective target BF per objective (clamped to a safe floor).
  let targetBf: number;
  let note: string | undefined;
  if (objective === "build_muscle") {
    const goal = input.targetBf && input.targetBf > profile.currentBf ? input.targetBf : p.ceiling;
    targetBf = goal;
  } else if (objective === "maintain") {
    targetBf = input.targetBf ?? profile.currentBf;
  } else {
    if (input.targetBf === undefined) return empty("Set a target body-fat % for this goal.");
    targetBf = input.targetBf;
    if (targetBf < p.bfFloor) {
      note = `Target raised to ${p.bfFloor}% — below that isn't safe to sustain.`;
      targetBf = p.bfFloor;
    }
  }

  // Feasibility gate (fat-loss objectives only): the minimum weeks to reach the
  // target at the fastest safe cut. Soft deadlines auto-extend; hard ones warn.
  let W = requestedWeeks;
  let adjusted = false;
  if ((objective === "lose_fat" || objective === "peak") && targetBf < start.bf) {
    const minSafe = weeksToReach(start, "cut", targetBf, p.safeCutMaxPct, p, 520);
    if (W < minSafe) {
      if (hard) {
        note = `Reaching ${round1(targetBf)}% by this date needs an unsafe rate — consider a later date.`;
      } else {
        W = minSafe;
        adjusted = true;
      }
    }
  }

  // Select the strategy from the OBJECTIVE (no more guessing from the BF gap).
  let specs: PhaseSpec[];
  switch (objective) {
    case "lose_fat": {
      // Already lean with a long runway ⇒ build first, then re-lean to target.
      const longRunway = start.bf <= p.ceiling && W >= 26;
      specs = longRunway ? buildLeanThenGrow(start, targetBf, W, p) : buildLoseFat(start, targetBf, W, p);
      break;
    }
    case "build_muscle":
      specs = buildBuildMuscle(start, targetBf, W, p);
      if (!note) note = "Mass-gain phase — building lean mass up to your ceiling.";
      break;
    case "recomp": {
      const eligible = (profile.experienceLevel ?? "intermediate") === "beginner" || start.bf > p.ceiling + 6;
      if (eligible) {
        specs = buildRecomp(W, p);
        note = "Recomp — training near maintenance to add muscle while slowly losing fat.";
      } else if (start.bf > targetBf + 0.5) {
        specs = buildLoseFat(start, targetBf, W, p);
        note = "Recomp isn't efficient at your level/leanness — cutting to your target instead.";
      } else {
        specs = [{ kind: "maintain", label: "Maintain", weeks: W, sim: "maintain" }];
        note = "Recomp isn't efficient at your level — maintaining while you keep training.";
      }
      break;
    }
    case "peak":
      specs = buildPeak(start, targetBf, W);
      break;
    case "maintain":
    default:
      specs = [{ kind: "maintain", label: "Maintain", weeks: W, sim: "maintain" }];
      if (!note) note = "Maintaining your current composition.";
      break;
  }

  const phases = realize(specs, start, profile, targetBf, p);
  const totalWeeks = phases.reduce((s, ph) => s + ph.durationWeeks, 0);
  const effectiveDeadline = adjusted ? startMs + totalWeeks * WEEK_MS : requestedDeadline;

  if (adjusted) {
    const extend = `Extended to ~${totalWeeks} weeks — a safe rate needs the extra time.`;
    note = note ? `${extend} ${note}` : extend;
  }

  return {
    phases,
    objective,
    startMs,
    deadlineMs: effectiveDeadline,
    requestedDeadlineMs: requestedDeadline,
    targetBf: round1(targetBf),
    totalWeeks,
    feasible: phases.length > 0,
    adjusted,
    note,
  };
}

// Which phase is active `atMs`, given a generated roadmap. Falls back to the
// last phase once past the deadline so a calorie target always exists.
export function activePhaseAt(roadmap: Roadmap, atMs: number): RoadmapPhase | null {
  if (!roadmap.feasible || roadmap.phases.length === 0) return null;
  const weeks = (atMs - roadmap.startMs) / WEEK_MS;
  return (
    roadmap.phases.find(
      (ph) => weeks >= ph.startWeekOffset && weeks < ph.startWeekOffset + ph.durationWeeks,
    ) ?? roadmap.phases[roadmap.phases.length - 1]
  );
}

// Overload for the persisted plan shape (phases + startMs), reused by Fuel/Stats.
export function activePhaseOf(
  plan: { phases: RoadmapPhase[]; startMs: number; feasible: boolean } | null | undefined,
  atMs: number,
): RoadmapPhase | null {
  if (!plan?.feasible || plan.phases.length === 0) return null;
  const weeks = (atMs - plan.startMs) / WEEK_MS;
  return (
    plan.phases.find(
      (ph) => weeks >= ph.startWeekOffset && weeks < ph.startWeekOffset + ph.durationWeeks,
    ) ?? plan.phases[plan.phases.length - 1]
  );
}
