/**
 * RP Full Mesocycle Simulator — fully automatic, no prompts
 * Simulates a realistic athlete over 5 weeks of PPL with auto-generated feedback.
 *
 * Run: npx tsx scripts/simulate-overload.ts
 * Output: scripts/overload-simulation.xlsx
 */

import * as XLSX from "xlsx";

// ─── Algorithm (mirrors convex/overload.ts exactly) ───────────────────────────

function roundToIncrement(v: number, inc = 2.5) {
  return Math.round(v / inc) * inc;
}

function targetRirForWeek(week: number) {
  if (week <= 1) return 3;
  if (week === 2) return 2;
  if (week === 3) return 1;
  return 0;
}

function suggestedSetsForWeek(
  week: number, base: number,
  fbWorkload?: number, fbSoreness?: number
) {
  let added = Math.min(week - 1, 3);
  if (fbWorkload === 3) added = Math.max(added - 1, 0);
  if (fbSoreness === 3) added = Math.max(added - 1, 0);
  if (fbWorkload === 0 && fbSoreness === 0 && added < 3) added += 1;
  return base + added;
}

interface SetData { weight: number; reps: number; rir: number; sets: number; }

function getSuggestion(
  last: SetData | null, prev: SetData | null,
  week: number, repMin: number, repMax: number, baseSets: number,
  fbWorkload?: number, fbSoreness?: number
) {
  const targetRir = targetRirForWeek(week);
  const suggestedSets = suggestedSetsForWeek(week, baseSets, fbWorkload, fbSoreness);

  let weightMult = 1.0;
  if (fbSoreness === 3) weightMult *= 0.95;
  if (fbWorkload === 3) weightMult *= 0.95;
  if (fbWorkload === 0 && fbSoreness === 0) weightMult *= 1.05;

  if (!last) {
    return { weight: 0, reps: repMin, sets: suggestedSets, targetRir, indicator: "First session", deload: false };
  }

  const deload = week >= 4 && prev !== null &&
    last.rir === 0 && last.reps <= repMin &&
    prev.rir === 0  && prev.reps <= repMin;

  if (last.reps < repMin) return {
    weight: Math.max(roundToIncrement(last.weight * 0.95 * weightMult), 2.5),
    reps: repMin, sets: suggestedSets, targetRir, deload,
    indicator: "↓ WEIGHT",
    reason: `${last.reps} reps below min ${repMin} → -5% weight`,
  };

  if (last.reps >= repMax && last.rir <= targetRir) return {
    weight: roundToIncrement(last.weight * weightMult + (last.weight < 20 ? 1 : 2.5)),
    reps: repMin, sets: suggestedSets, targetRir, deload,
    indicator: "↑ WEIGHT",
    reason: `Hit ${last.reps}@RIR${last.rir} = top of range → +2.5 kg`,
  };

  if (last.reps < repMax && last.rir > targetRir) return {
    weight: roundToIncrement(last.weight * weightMult),
    reps: Math.min(last.reps + 1, repMax),
    sets: suggestedSets, targetRir, deload,
    indicator: "+1 REP",
    reason: `RIR ${last.rir} > target ${targetRir} → +1 rep`,
  };

  return {
    weight: roundToIncrement(last.weight * weightMult),
    reps: last.reps, sets: suggestedSets, targetRir, deload,
    indicator: "→ HOLD",
    reason: `${last.reps}@RIR${last.rir} on track`,
  };
}

// ─── PPL Template with realistic starting weights ─────────────────────────────

const PPL_SESSIONS = [
  {
    name: "Push A — Chest & Shoulders", day: "Mon",
    exercises: [
      { name: "Incline DB Press",       repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "chest",     startWeight: 32.5 },
      { name: "Machine Chest Press",    repMin: 10, repMax: 15, baseSets: 3, muscleGroup: "chest",     startWeight: 60 },
      { name: "Cable Lateral Raise",    repMin: 12, repMax: 20, baseSets: 3, muscleGroup: "shoulders", startWeight: 10 },
      { name: "Overhead Tricep Ext",    repMin: 10, repMax: 15, baseSets: 3, muscleGroup: "triceps",   startWeight: 25 },
    ],
  },
  {
    name: "Pull A — Back & Biceps", day: "Tue",
    exercises: [
      { name: "Cable Row",              repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "back",    startWeight: 55 },
      { name: "Lat Pulldown",           repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "back",    startWeight: 60 },
      { name: "Incline DB Curl",        repMin: 10, repMax: 15, baseSets: 3, muscleGroup: "biceps",  startWeight: 12.5 },
      { name: "Hammer Curl",            repMin: 10, repMax: 15, baseSets: 2, muscleGroup: "biceps",  startWeight: 15 },
    ],
  },
  {
    name: "Legs A — Quads & Glutes", day: "Wed",
    exercises: [
      { name: "Leg Press",              repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "quads",      startWeight: 120 },
      { name: "Leg Extension",          repMin: 12, repMax: 20, baseSets: 3, muscleGroup: "quads",      startWeight: 50 },
      { name: "Romanian Deadlift",      repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "hamstrings", startWeight: 60 },
      { name: "Standing Calf Raise",    repMin: 10, repMax: 20, baseSets: 4, muscleGroup: "calves",     startWeight: 40 },
    ],
  },
  {
    name: "Push B — Chest & Triceps", day: "Thu",
    exercises: [
      { name: "Flat DB Press",          repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "chest",     startWeight: 35 },
      { name: "Pec Dec",                repMin: 12, repMax: 20, baseSets: 3, muscleGroup: "chest",     startWeight: 45 },
      { name: "Machine Shoulder Press", repMin: 10, repMax: 15, baseSets: 3, muscleGroup: "shoulders", startWeight: 40 },
      { name: "Cable Tricep Pushdown",  repMin: 12, repMax: 20, baseSets: 3, muscleGroup: "triceps",   startWeight: 20 },
    ],
  },
  {
    name: "Pull B — Back & Biceps", day: "Fri",
    exercises: [
      { name: "Chest Supported Row",    repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "back",   startWeight: 50 },
      { name: "Single Arm Cable Row",   repMin: 10, repMax: 15, baseSets: 3, muscleGroup: "back",   startWeight: 25 },
      { name: "EZ Bar Curl",            repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "biceps", startWeight: 30 },
      { name: "Cable Curl",             repMin: 12, repMax: 20, baseSets: 2, muscleGroup: "biceps", startWeight: 12.5 },
    ],
  },
  {
    name: "Legs B — Hams & Glutes", day: "Sat",
    exercises: [
      { name: "Hack Squat",             repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "quads",      startWeight: 80 },
      { name: "Leg Curl",               repMin: 10, repMax: 15, baseSets: 3, muscleGroup: "hamstrings", startWeight: 40 },
      { name: "Hip Thrust",             repMin: 8,  repMax: 12, baseSets: 3, muscleGroup: "glutes",     startWeight: 80 },
      { name: "Seated Calf Raise",      repMin: 10, repMax: 20, baseSets: 3, muscleGroup: "calves",     startWeight: 30 },
    ],
  },
];

// ─── Simulated weekly feedback (realistic escalation then recovery) ────────────
// Indexed by week (1-based). Simulates a typical athlete's response curve.
// Week 1: fresh, easy. Week 2-3: accumulating fatigue. Week 4: peak fatigue. Week 5: pushing limits.

const WEEKLY_FEEDBACK: Record<string, { soreness: number; pump: number; workload: number }[]> = {
  chest:      [{ s:0,p:2,w:1 }, { s:1,p:2,w:1 }, { s:1,p:2,w:2 }, { s:2,p:2,w:2 }, { s:2,p:1,w:3 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  back:       [{ s:0,p:1,w:1 }, { s:1,p:2,w:1 }, { s:1,p:2,w:2 }, { s:2,p:2,w:2 }, { s:3,p:1,w:3 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  shoulders:  [{ s:0,p:2,w:0 }, { s:0,p:2,w:1 }, { s:1,p:2,w:1 }, { s:1,p:2,w:2 }, { s:2,p:2,w:2 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  biceps:     [{ s:1,p:2,w:1 }, { s:1,p:2,w:1 }, { s:2,p:2,w:2 }, { s:2,p:1,w:2 }, { s:3,p:1,w:3 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  triceps:    [{ s:0,p:2,w:1 }, { s:1,p:2,w:1 }, { s:1,p:2,w:2 }, { s:2,p:2,w:2 }, { s:2,p:2,w:2 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  quads:      [{ s:1,p:2,w:1 }, { s:2,p:2,w:2 }, { s:2,p:2,w:2 }, { s:3,p:1,w:3 }, { s:3,p:1,w:3 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  hamstrings: [{ s:1,p:1,w:1 }, { s:1,p:2,w:2 }, { s:2,p:2,w:2 }, { s:2,p:2,w:2 }, { s:3,p:1,w:3 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  glutes:     [{ s:1,p:2,w:1 }, { s:1,p:2,w:1 }, { s:2,p:2,w:2 }, { s:2,p:2,w:2 }, { s:2,p:2,w:2 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
  calves:     [{ s:0,p:1,w:0 }, { s:0,p:1,w:1 }, { s:1,p:1,w:1 }, { s:1,p:1,w:1 }, { s:2,p:1,w:2 }].map(f=>({soreness:f.s,pump:f.p,workload:f.w})),
};

// ─── Simulate athlete performing at suggestion (±1 rep natural variance) ──────
function simulate(sug: ReturnType<typeof getSuggestion>, repMin: number, repMax: number): SetData {
  // Athlete performs at exactly what's suggested — this is the ideal case
  return { weight: sug.weight, reps: sug.reps, sets: sug.sets, rir: sug.targetRir };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const WEEKS = 5;

interface ExerciseState {
  name: string; day: string; session: string;
  muscleGroup: string; repMin: number; repMax: number; baseSets: number;
  last: SetData | null; prev: SetData | null;
  history: Array<{
    week: number; weight: number; reps: number; rir: number; sets: number;
    targetRir: number; indicator: string; reason: string;
    volume: number; deload: boolean;
    fbSoreness: number; fbPump: number; fbWorkload: number;
  }>;
}

const exerciseStates: ExerciseState[] = PPL_SESSIONS.flatMap((s) =>
  s.exercises.map((ex) => ({
    ...ex, day: s.day, session: s.name,
    last: null, prev: null, history: [],
  }))
);

console.log("\n" + "═".repeat(80));
console.log("  RP 5-WEEK PPL MESOCYCLE SIMULATION");
console.log("  24 exercises × 5 weeks × set/rep/weight + feedback progression");
console.log("═".repeat(80));

for (let week = 1; week <= WEEKS; week++) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`  WEEK ${week}  (Target RIR: ${targetRirForWeek(week)})`);
  console.log(`${"─".repeat(80)}`);

  for (const session of PPL_SESSIONS) {
    console.log(`\n  ${session.day} — ${session.name}`);
    console.log(`  ${"Exercise".padEnd(26)} ${"Sets".padEnd(5)} ${"Weight".padEnd(8)} ${"Reps".padEnd(6)} ${"RIR".padEnd(5)} ${"tRIR".padEnd(6)} Action`);
    console.log(`  ${"─".repeat(76)}`);

    for (const ex of session.exercises) {
      const state = exerciseStates.find((e) => e.name === ex.name && e.session === session.name)!;
      const fb = WEEKLY_FEEDBACK[ex.muscleGroup]?.[week - 1];

      // For week 1, feedback from "previous meso" = neutral
      const fbWorkload = week === 1 ? 1 : fb?.workload;
      const fbSoreness = week === 1 ? 0 : fb?.soreness;

      const sug = getSuggestion(
        state.last, state.prev, week,
        ex.repMin, ex.repMax, ex.baseSets,
        fbWorkload, fbSoreness
      );

      if (week === 1 || sug.weight === 0) sug.weight = ex.startWeight;

      const performed = simulate(sug, ex.repMin, ex.repMax);
      const volume = performed.weight * performed.reps * performed.sets;

      console.log(
        `  ${ex.name.padEnd(26)} ${String(performed.sets).padEnd(5)} ` +
        `${performed.weight.toFixed(1).padEnd(8)} ${String(performed.reps).padEnd(6)} ` +
        `${String(performed.rir).padEnd(5)} ${String(sug.targetRir).padEnd(6)} ` +
        `${sug.indicator}${sug.deload ? "  ⚠ DELOAD" : ""}`
      );

      state.history.push({
        week, weight: performed.weight, reps: performed.reps,
        rir: performed.rir, sets: performed.sets,
        targetRir: sug.targetRir, indicator: sug.indicator,
        reason: (sug as any).reason ?? sug.indicator,
        volume, deload: sug.deload ?? false,
        fbSoreness: fb?.soreness ?? 0,
        fbPump: fb?.pump ?? 1,
        fbWorkload: fb?.workload ?? 1,
      });

      state.prev = state.last;
      state.last = performed;
    }
  }

  // Show feedback that will apply NEXT week
  if (week < WEEKS) {
    console.log(`\n  Feedback going into Week ${week + 1}:`);
    const mgs = [...new Set(PPL_SESSIONS.flatMap((s) => s.exercises.map((e) => e.muscleGroup)))];
    for (const mg of mgs) {
      const fb = WEEKLY_FEEDBACK[mg]?.[week - 1];
      if (fb) {
        console.log(`    ${mg.padEnd(12)} soreness=${fb.soreness}  pump=${fb.pump}  workload=${fb.workload}`);
      }
    }
  }
}

// ─── Build Excel ──────────────────────────────────────────────────────────────

const wb = XLSX.utils.book_new();

// ── Summary sheet (all exercises, all weeks) ──
const summaryRows = exerciseStates.flatMap((ex) =>
  ex.history.map((h) => ({
    Week: h.week,
    Day: ex.day,
    Session: ex.session,
    Exercise: ex.name,
    "Muscle": ex.muscleGroup,
    "Rep Range": `${ex.repMin}–${ex.repMax}`,
    "Sets": h.sets,
    "Weight (kg)": h.weight,
    "Reps": h.reps,
    "Actual RIR": h.rir,
    "Target RIR": h.targetRir,
    "Volume (kg×r×s)": h.volume,
    "Action": h.indicator,
    "Reason": h.reason,
    "Deload Flag": h.deload ? "⚠ YES" : "",
    "Feedback: Soreness": h.fbSoreness,
    "Feedback: Pump": h.fbPump,
    "Feedback: Workload": h.fbWorkload,
  }))
);

const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
wsSummary["!cols"] = [
  { wch: 6 }, { wch: 6 }, { wch: 28 }, { wch: 26 }, { wch: 13 },
  { wch: 11 }, { wch: 6 }, { wch: 12 }, { wch: 6 }, { wch: 11 },
  { wch: 11 }, { wch: 16 }, { wch: 10 }, { wch: 45 }, { wch: 13 },
  { wch: 20 }, { wch: 16 }, { wch: 20 },
];
XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

// ── Per-exercise sheets ──
for (const ex of exerciseStates) {
  const rows = ex.history.map((h) => ({
    Week: h.week,
    "Target RIR": h.targetRir,
    "Suggested Sets": h.sets,
    "Weight (kg)": h.weight,
    "Reps": h.reps,
    "Actual RIR": h.rir,
    "Volume (kg×r×s)": h.volume,
    "Action": h.indicator,
    "Reason": h.reason,
    "Deload?": h.deload ? "⚠ YES" : "",
    "Soreness In": h.fbSoreness,
    "Workload In": h.fbWorkload,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 6 }, { wch: 11 }, { wch: 15 }, { wch: 12 },
    { wch: 6 }, { wch: 11 }, { wch: 16 }, { wch: 10 },
    { wch: 45 }, { wch: 10 }, { wch: 13 }, { wch: 13 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, ex.name.substring(0, 31));
}

// ── Progression summary sheet ──
const progressRows = exerciseStates.map((ex) => {
  const first = ex.history[0];
  const last  = ex.history[ex.history.length - 1];
  const wGain = last.weight - first.weight;
  const rGain = last.reps - first.reps;
  const sGain = last.sets - first.sets;
  const vGain = last.volume - first.volume;
  return {
    Exercise: ex.name,
    Muscle: ex.muscleGroup,
    Session: ex.session,
    "Wk1 Weight": first.weight,
    "Wk5 Weight": last.weight,
    "Weight Gain (kg)": wGain,
    "Wk1 Reps": first.reps,
    "Wk5 Reps": last.reps,
    "Rep Gain": rGain,
    "Wk1 Sets": first.sets,
    "Wk5 Sets": last.sets,
    "Set Gain": sGain,
    "Wk1 Volume": first.volume,
    "Wk5 Volume": last.volume,
    "Volume Gain (kg)": vGain,
    "Volume Gain (%)": `${((vGain / first.volume) * 100).toFixed(1)}%`,
  };
});

const wsProgress = XLSX.utils.json_to_sheet(progressRows);
wsProgress["!cols"] = [
  { wch: 26 }, { wch: 13 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
  { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
];
XLSX.utils.book_append_sheet(wb, wsProgress, "Progression Summary");

const outPath = "scripts/overload-simulation.xlsx";
XLSX.writeFile(wb, outPath);

// ── Console progression summary ──
console.log("\n" + "═".repeat(80));
console.log("  PROGRESSION SUMMARY  (Week 1 → Week 5)");
console.log("═".repeat(80));
console.log(`  ${"Exercise".padEnd(26)} ${"Wk1".padEnd(22)} ${"Wk5".padEnd(22)} ${"Δ Weight".padEnd(10)} ${"Δ Sets".padEnd(8)} Vol%`);
console.log(`  ${"─".repeat(78)}`);
for (const ex of exerciseStates) {
  const f = ex.history[0], l = ex.history[ex.history.length - 1];
  const volPct = ((l.volume - f.volume) / f.volume * 100).toFixed(0);
  console.log(
    `  ${ex.name.padEnd(26)} ` +
    `${f.weight}kg×${f.reps}r×${f.sets}s`.padEnd(22) +
    `${l.weight}kg×${l.reps}r×${l.sets}s`.padEnd(22) +
    `+${(l.weight - f.weight).toFixed(1)}kg`.padEnd(10) +
    `+${l.sets - f.sets}`.padEnd(8) +
    `+${volPct}%`
  );
}
console.log(`\n  ✓ Excel saved: ${outPath}`);
console.log("  Sheets: Summary | Progression Summary | 1 tab per exercise\n");
