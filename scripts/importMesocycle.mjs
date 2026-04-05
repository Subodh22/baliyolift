#!/usr/bin/env node
// Add a mesocycle template to the app's template picker (app/meso/new.tsx).
// The template will appear for all users when they create a new mesocycle.
//
// Accepts two JSON formats:
//   1. App format  — has "sessions" array (script's own format)
//   2. External format — has "workouts" array (e.g. exported from other tools)
//
// Usage:
//   node scripts/importMesocycle.mjs --file data/my-meso.json

import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const TARGET    = resolve(ROOT, "app/meso/new.tsx");

const argv     = process.argv.slice(2);
const filePath = argv[argv.indexOf("--file") + 1];
const dryRun   = argv.includes("--dry-run");

if (!filePath) {
  console.error("Usage: node scripts/importMesocycle.mjs --file data/my-meso.json [--dry-run]");
  process.exit(1);
}

// ── Day-of-week helpers ───────────────────────────────────────────────────────

const DAY_NAME_TO_NUM = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function dayNameToNum(name) {
  return DAY_NAME_TO_NUM[name?.toLowerCase()] ?? 1;
}

// ── Muscle group normalisation ────────────────────────────────────────────────

const MUSCLE_MAP = {
  "chest": "chest", "upper chest": "chest", "chest (upper)": "chest",
  "back": "back", "back (lats)": "back", "back (mid)": "back", "lats": "back",
  "shoulders": "shoulders", "shoulders (lateral head)": "shoulders",
  "rear delts": "shoulders", "rear delts / rotator cuff": "shoulders",
  "biceps": "biceps", "biceps / brachialis": "biceps",
  "triceps": "triceps",
  "quads": "quads", "quads / glutes": "quads",
  "hamstrings": "hamstrings", "hamstrings / posterior chain": "hamstrings",
  "glutes": "glutes",
  "calves": "calves",
  "abs": "abs", "core": "abs", "core / abs": "abs", "abs_core": "abs",
  "forearms": "forearms",
};

function normaliseMuscle(raw) {
  return MUSCLE_MAP[raw?.toLowerCase()?.trim()] ?? null;
}

// ── Exercise name normalisation ───────────────────────────────────────────────
// Some entries are "X / Y" — take the first option only.
// Map common external names to exact names in the exercise library.

const EXERCISE_NAME_MAP = {
  "barbell bench press":                  "Flat Barbell Press",
  "dumbbell bench press":                 "Flat Dumbbell Press",
  "chest supported row":                  "Chest-Supported Row",
  "seated cable row":                     "Cable Row",
  "hack squat / leg press":               "Hack Squat Machine",
  "hack squat":                           "Hack Squat Machine",
  "seated overhead press":                "Overhead Press Barbell",
  "dumbbell shoulder press":              "Overhead Press Dumbbell",
  "pull up / lat pulldown":               "Lat Pulldown",
  "pull up":                              "Pull-Up",
  "romanian deadlift / barbell deadlift": "Romanian Deadlift",
  "pec deck / cable fly":                 "Pec Deck Machine",
  "pec dec":                              "Pec Deck Machine",
  "preacher curl":                        "Preacher Curl Machine",
  "tricep pushdown":                      "Cable Pushdown",
  "cable tricep pushdown":                "Cable Pushdown",
  "overhead tricep extension":            "Cable Overhead Tricep Extension",
  "face pull":                            "Cable Face Pull",
  "single arm cable row":                 "Single-Arm Cable Row",
};

function normaliseExerciseName(raw) {
  const lower = raw?.toLowerCase()?.trim();
  return EXERCISE_NAME_MAP[lower] ?? raw;
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// ── Transform external format → app template format ──────────────────────────

function transformExternal(json) {
  const workouts = json.workouts ?? [];

  const sessions = workouts.map((w) => {
    // Determine dayOfWeek
    const day = w.scheduled_day
      ? dayNameToNum(w.scheduled_day)
      : (w.day ?? 1);

    // Collect muscle groups from primary muscles
    const rawMuscles = [
      ...(w.muscles_primary ?? []),
      ...(w.muscles_secondary ?? []),
    ];
    const muscleGroups = [...new Set(
      rawMuscles.map(normaliseMuscle).filter(Boolean)
    )];

    // Collect exercise names (normalised)
    const exercises = (w.exercises ?? []).map((e) => normaliseExerciseName(e.name));

    return {
      day,
      name: w.name,
      muscleGroups,
      exercises,
    };
  });

  // Build subtitle from sessions
  const days   = sessions.map((s) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][s.day]).join(" · ");
  const subtitle = `${sessions.length} days · ${days}`;

  return {
    id:          slugify(json.name),
    name:        json.name,
    subtitle,
    tag:         json.level ?? "Custom",
    tagColor:    "#AF52DE",
    description: json.description ?? "",
    weeks:       json.duration_weeks ?? json.weeks ?? 5,
    sessions,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const raw = JSON.parse(await readFile(resolve(ROOT, filePath), "utf8"));

// Detect format
const tpl = raw.workouts ? transformExternal(raw) : raw;

// Validate required fields
for (const key of ["id", "name", "subtitle", "tag", "tagColor", "description", "weeks", "sessions"]) {
  if (tpl[key] === undefined) {
    console.error(`Missing required field: "${key}"`);
    process.exit(1);
  }
}

// Format as a TEMPLATES entry
const entry = `  {
    id: ${JSON.stringify(tpl.id)},
    name: ${JSON.stringify(tpl.name)},
    subtitle: ${JSON.stringify(tpl.subtitle)},
    tag: ${JSON.stringify(tpl.tag)},
    tagColor: ${JSON.stringify(tpl.tagColor)},
    description: ${JSON.stringify(tpl.description)},
    weeks: ${tpl.weeks},
    sessions: [
${tpl.sessions.map((s) =>
  `      { day: ${s.day}, name: ${JSON.stringify(s.name)}, muscleGroups: ${JSON.stringify(s.muscleGroups)}, exercises: ${JSON.stringify(s.exercises)} }`
).join(",\n")}
    ],
  },`;

// Insert before the closing ]; of the TEMPLATES array
const source = await readFile(TARGET, "utf8");
// Normalise to LF for matching, then restore original line endings when writing
const crlf    = source.includes("\r\n");
const src     = source.replace(/\r\n/g, "\n");
const marker  = "\n];\n\n// ─── Template Confirm Sheet";

if (!src.includes(marker)) {
  console.error("Could not find TEMPLATES array end marker in new.tsx — aborting.");
  process.exit(1);
}

if (src.includes(`id: ${JSON.stringify(tpl.id)},`)) {
  console.error(`Template with id "${tpl.id}" already exists in new.tsx.`);
  process.exit(1);
}

let updated = src.replace(marker, `\n${entry}\n];` + "\n\n// ─── Template Confirm Sheet");
if (crlf) updated = updated.replace(/\n/g, "\r\n");

if (dryRun) {
  console.log("DRY RUN — no files written.\n");
  console.log("Would insert into app/meso/new.tsx:\n");
  console.log(entry);
} else {
  await writeFile(TARGET, updated, "utf8");
}

console.log(`${dryRun ? "[dry-run]" : "✓"} "${tpl.name}" → app/meso/new.tsx`);
console.log(`  id:       ${tpl.id}`);
console.log(`  weeks:    ${tpl.weeks}`);
console.log(`  sessions: ${tpl.sessions.length}`);
tpl.sessions.forEach((s) => {
  const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][s.day];
  console.log(`    ${dayName}  ${s.name}  [${s.exercises.length} exercises]`);
});
