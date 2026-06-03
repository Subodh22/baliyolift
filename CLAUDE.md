# baliyolift — project guide for Claude

A React Native (Expo Router) hypertrophy training + nutrition app backed by Convex.

## Stack
- **App:** Expo / React Native, file-based routing under `app/`. Web build via `expo start --web`.
- **Backend:** Convex (`convex/`). Auth via Clerk. File storage on Cloudflare R2.
- **State:** Convex live queries (`useQuery`/`useMutation`), plus `hooks/useWorkoutStore.tsx` for the active-workout session.

## Run
- `npm run web` — Expo web dev server.
- `npm run ios` / `npm run android` — native.
- `npx convex dev` — **must be running** to sync `convex/` functions to the dev deployment (`dev:precious-chipmunk-168`). Env lives in the **repo-root `.env.local`** (not in git worktrees).

## ⚠️ Convex deploy gotcha (causes "Could not find public function …")
The client references functions by string (e.g. `templates:createSamSulekTemplate`). If a client calls a function the **deployment** doesn't have, you get:

> Server Error: Could not find public function for '…'. Did you forget to run `npx convex dev`?

This happens when the convex functions deployed (synced from whatever branch `npx convex dev` runs against) are out of sync with the client branch you're running. Fix: ensure the function exists in `convex/` **and** that `npx convex dev` (or `npx convex deploy`) has pushed it to the deployment the app's `EXPO_PUBLIC_CONVEX_URL` points at. Adding a client `useMutation(api.x.y)` is not enough on its own — the Convex function must be deployed.

## Mesocycle templates
- Built-in program templates live in **two places that must stay in sync**:
  1. `app/meso/new.tsx` — the `TEMPLATES` array (UI preview) + a `useMutation` hook + a dispatch branch in `handleConfirmTemplate` keyed on the template `id`.
  2. `convex/templates.ts` — a `createXTemplate` mutation that inserts the mesocycle, sessions, and sessionExercises.
- A template session may set a custom `label` (e.g. `"Day 1"`); the preview falls back to `DAY_SHORT[day]` then `D{day}`. Use `label` for splits longer than 7 days (the Sam Sulek 8-day split uses `dayOfWeek` 1–8).
- Robust templates resolve exercises with a `findOrCreate` helper so they work even when the exercise library isn't seeded (see `createSamSulekTemplate`).

## Conventions
- **Always run tests / typecheck before pushing** (`npx tsc --noEmit`). Note: the repo currently has pre-existing type errors unrelated to feature work (typography tokens, meal-planner `MealType`); don't let those mask new ones — filter `tsc` output to the files you touched.
- **Conventional commits** (`feat:`, `fix:`, etc.).
- Match the surrounding file's style (column-aligned object literals are common in `convex/templates.ts`).
