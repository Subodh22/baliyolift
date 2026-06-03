# baliyolift

Expo / React Native (web + native) hypertrophy training app. Frontend is Expo Router; backend is Convex; auth is Clerk.

## Stack
- **App**: Expo Router (`app/`), React Native 0.81, React 19, Reanimated. Web via `react-native-web`.
- **Backend**: Convex (`convex/`) — queries/mutations/actions. Generated client in `convex/_generated/`.
- **Auth**: Clerk (`@clerk/clerk-expo`).
- **Theming**: `hooks/useTheme.ts` + `constants/` (colors, typography, muscles).

## Commands
- `npm run start` — Expo dev server. `npm run web` / `ios` / `android` for a platform.
- `npx convex dev` — run Convex locally / push functions; **`npx convex codegen`** regenerates `convex/_generated` (run after adding/renaming Convex functions, otherwise `api.*` types are stale).
- Typecheck: `npx tsc --noEmit`. There is **no test runner** configured — typecheck is the gate before pushing.

## Conventions
- Conventional commits.
- TypeScript everywhere. Match surrounding style (compact object literals, aligned columns in data tables).

## Domain model (Convex `schema.ts`)
- **mesocycles** → **sessions** (one per training day, keyed by `dayOfWeek` 0=Sun..6=Sat + `order`) → **sessionExercises** (per-exercise `repRangeMin/Max`, `targetSets`, `setType`). `sessions.exerciseIds` is kept in sync with `sessionExercises` for legacy reads.
- **exercises** is the shared library; `isCustom`/`userId` mark user-created ones. Seed data lives in `data/exercises.ts` (`EXERCISE_SEED_DATA`).
- **workouts** are logged instances of a session; **sets** are the atomic logged unit.
- Nutrition: `foodEntries`, `foodTargets`, `customFoods`, recipes/meal-planner tables.

## Program templates
- Named templates are Convex mutations in `convex/templates.ts` (e.g. `createPPLTemplate`, `createSamSulekTemplate`). Most resolve exercises by name from the seeded library and **skip** unknown names. `createSamSulekTemplate` instead **find-or-creates** exercises so plan names are preserved exactly.
- The picker UI lives in `app/meso/new.tsx`: a `TEMPLATES` array drives the preview sheet, and `handleConfirmTemplate` dispatches each template `id` to its mutation. Adding a template = add a `TEMPLATES` entry **and** a dispatch branch + `useMutation` hook.
- Sessions map to days of the week, so a template can have **at most 7 sessions** (one per unique `dayOfWeek`). Splits longer than 7 days must be condensed.
