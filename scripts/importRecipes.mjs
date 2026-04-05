#!/usr/bin/env node
// Import recipes from data/recipes.json into Convex.
//
// Usage:
//   node scripts/importRecipes.mjs
//   node scripts/importRecipes.mjs --overwrite   # replace existing recipes
//   node scripts/importRecipes.mjs --clear       # wipe all recipes first, then import

import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Read .env.local for EXPO_PUBLIC_CONVEX_URL ────────────────────────────────

async function getConvexUrl() {
  const envPath = resolve(ROOT, ".env.local");
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("EXPO_PUBLIC_CONVEX_URL=")) {
      return trimmed.split("=")[1].trim();
    }
  }
  throw new Error("EXPO_PUBLIC_CONVEX_URL not found in .env.local");
}

// ── Call a Convex mutation via HTTP ───────────────────────────────────────────

async function callMutation(convexUrl, fnPath, args) {
  const url = `${convexUrl}/api/mutation`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fnPath, format: "json", args }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Convex error (${res.status}): ${text}`);
  }
  const json = JSON.parse(text);
  if (json.status === "error") {
    throw new Error(`Convex mutation failed: ${json.errorMessage}`);
  }
  return json.value;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
const clear = args.includes("--clear");

const convexUrl = await getConvexUrl();
const recipes = JSON.parse(await readFile(resolve(ROOT, "data/rr.json"), "utf8"));

console.log(`Convex: ${convexUrl}`);
console.log(`Recipes to import: ${recipes.length}`);

if (clear) {
  console.log("Clearing existing recipes...");
  const result = await callMutation(convexUrl, "importRecipes:clearRecipes", {});
  console.log(`  Deleted: ${result.deleted}`);
}

console.log(`Importing... (skipExisting: ${!overwrite})`);
const result = await callMutation(convexUrl, "importRecipes:seedRecipes", {
  recipes,
  skipExisting: !overwrite,
});

const { inserted, skipped, total } = result;
console.log(`Done. inserted=${inserted}  skipped=${skipped}  total=${total}`);
