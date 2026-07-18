/**
 * Convex live-data wiring guide
 * ─────────────────────────────
 * After running `npx convex dev`, the generated API becomes available.
 * Replace mock data in screens with these patterns:
 *
 * import { useQuery, useMutation } from "convex/react";
 * import { api } from "@/convex/_generated/api";
 *
 * // Seed exercises once on first launch (add to _layout.tsx):
 * const seedExercises = useMutation(api.seed.seedExercises);
 * useEffect(() => { seedExercises(); }, []);
 *
 * // Today screen:
 * const activeMeso = useQuery(api.mesocycles.getActive, { userId });
 * const todaysWorkout = useQuery(api.workouts.getTodaysWorkout, { userId });
 * const weeklyVolume = useQuery(api.workouts.getWeeklyVolume, { userId, mesocycleId, weekNumber });
 *
 * // Workout runner:
 * const logSet = useMutation(api.sets.logSet);
 * const suggestion = useQuery(api.overload.getSuggestionV2, { userId, exerciseId, mesocycleId, weekNumber, repRangeMin, repRangeMax });
 *
 * // Meso wizard final step:
 * const createMeso = useMutation(api.mesocycles.create);
 *
 * // Progress screen:
 * const history = useQuery(api.sets.getProgressionHistory, { userId, exerciseId, limit: 8 });
 * const prs = useQuery(api.sets.getPersonalBest, { userId, exerciseId });
 *
 * Convex returns `undefined` while loading and `null` if the query returns nothing.
 * Handle both states with a loading skeleton or the existing mock data as fallback.
 */

export {};
