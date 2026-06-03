# baliyolift

Expo / React Native (expo-router) hypertrophy-training + nutrition app. Backend is **Convex**. Auth is **Clerk**.

## Stack
- **App:** Expo SDK 54, React Native 0.81, expo-router v6, react-native-reanimated. TS strict-ish.
- **Backend:** Convex (`convex/`). Schema in `convex/schema.ts`; generated types in `convex/_generated/`.
- **No test runner is configured.** Validate with `npx tsc --noEmit` (typecheck). Convex validates schemas/functions on `npx convex dev`/`deploy`.

## Key domain model (training)
- `mesocycles` → `sessions` (training days) → `sessionExercises` (per-exercise rep range / set count / set type).
- `exercises` is the shared exercise library (`isCustom: false`, no `userId` = global; `isCustom: true` + `userId` = user-created).
- Actual logging: `workouts` → `sets` / `cardioSets`.

## Mesocycle templates
- Named templates live in `convex/templates.ts` as mutations (`createPPLTemplate`, `createLaxmanTemplate`, `createSamSulekTemplate`, …).
- The template **picker UI** is `app/meso/new.tsx` — the `TEMPLATES` array drives the list/preview, and `handleConfirmTemplate` maps each template `id` to its mutation (with a generic `createCustom` fallback for imported templates).
- Most templates resolve exercises by name via a `findEx` helper that **silently skips** names missing from the library. If a program uses exercises not in the seed, the template mutation must **create the missing exercises** (find-or-create) so names are preserved exactly — see `createSamSulekTemplate`.

## Conventions
- Conventional commits.
- Run `npx tsc --noEmit` before pushing.
