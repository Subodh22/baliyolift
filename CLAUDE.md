# BaliyoLift — Project Notes

Expo / React Native (Expo Router) app with a Convex backend. Training (mesocycles,
sessions, sets, progressive overload) + nutrition (meal planning, food logging).

## Layout
- `app/` — Expo Router screens. Tabs in `app/(tabs)/`. Workout flow in `app/workout/[id].tsx`,
  mesocycle creation wizard in `app/meso/new.tsx`.
- `convex/` — backend functions + `schema.ts`. Run `npx convex dev` to typecheck/deploy
  backend; `convex/_generated/` is codegen — do not edit by hand.
- `data/` — static seed data (exercises, foods, recipes). Exercise names here are the
  canonical strings used to resolve template/session exercises by name.
- `constants/` — colors, typography, muscle-group volume landmarks (`muscles.ts`).

## Mesocycle scheduling model (important)
- A mesocycle has N `sessions`, each with a numeric `order` and a `dayOfWeek`.
- **Scheduling is order-based, not calendar-based.** `convex/workouts.ts:getNextSession`
  walks sessions by `order` and serves the first not-yet-completed *this week*. `dayOfWeek`
  is only a display hint on some screens (`plan.tsx`, `progress.tsx` weekly roadmap,
  `index.tsx` heatmap) and assumes a 7-day week (0=Sun…6=Sat).
- Because scheduling is order-based, **rotating splits longer than 7 days work** (e.g. the
  Sam Sulek 8-day split). For such templates the weekday displays are cosmetic; screens
  label sessions by cycle position (`D1…D8`) when a meso isn't a clean weekly layout.

## Templates
- Preset programs live in `app/meso/new.tsx` `TEMPLATES`. Each is either:
  - mapped to a dedicated mutation in `convex/templates.ts` (PPL, Laxman, etc.), or
  - created through the generic `convex/mesocycles.ts:createCustom` path (the `else`
    branch in `handleConfirmTemplate`), which resolves `exercises` by name and builds
    volume targets from `muscleGroups`.
- The generic path is preferred for new templates — no new backend mutation/deploy needed.
  **Every exercise name must exist in `data/exercises.ts`** or it is silently skipped.

## Conventions
- Conventional commits. Run tests before pushing (no test script is configured yet;
  `npx tsc --noEmit` is the closest validation).
