# baliyolift

Expo / React Native (expo-router) hypertrophy training + nutrition app with a Convex backend and Clerk auth.

## Stack
- **App**: Expo SDK 54, React Native 0.81, React 19, expo-router (file-based routing under `app/`), react-native-reanimated.
- **Backend**: Convex (`convex/`) — queries/mutations/actions. Generated types in `convex/_generated/`.
- **Auth**: Clerk (`@clerk/clerk-expo`).
- **Web**: react-native-web; some screens have `.web.tsx` variants.

## Commands
- `npm start` — Expo dev server
- `npm run web` / `npm run ios` / `npm run android`
- `npx tsc --noEmit` — typecheck (no dedicated test runner is configured)
- `npx convex dev` — run/sync the Convex backend

> There is no test suite. Treat `npx tsc --noEmit` as the verification gate before pushing.

## Conventions
- Conventional commits (e.g. `feat:`, `fix:`, `chore:`).
- TypeScript throughout. Path alias `@/` maps to the repo root (e.g. `@/convex/_generated/api`).

## Key concepts
- **Mesocycle** = a training block (4–8 weeks). A meso has **sessions** (one per training day), each session has **sessionExercises** (rows holding rep ranges, target sets, set type).
- Built-in program templates live in two places that must stay in sync:
  - `convex/templates.ts` — `createXTemplate` mutations that look up seeded exercises by name and insert the meso + sessions + sessionExercises (with explicit rep ranges / set types / volume targets).
  - `app/meso/new.tsx` — the `TEMPLATES` array (UI preview) plus the mutation wiring in `MesoNew` / `handleConfirmTemplate`.
- Templates that don't have a dedicated mutation fall back to the generic `mesocycles.createCustom` path using per-session `muscleGroups` + `exercises` (see the Jeff Nippard Fundamentals entry).
- Exercise names referenced in templates must match `EXERCISE_SEED_DATA` / `CARDIO_EXERCISE_SEED_DATA` in `data/exercises.ts` exactly (lookups are case-insensitive but otherwise literal). Unmatched names are silently skipped.
- `setType` is `"regular"` or `"myorep"`. Muscle groups are defined in `data/exercises.ts` / `constants/muscles.ts`.
