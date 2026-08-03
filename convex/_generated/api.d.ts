/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cardioSets from "../cardioSets.js";
import type * as dailyReview from "../dailyReview.js";
import type * as exercises from "../exercises.js";
import type * as foodPreferences from "../foodPreferences.js";
import type * as http from "../http.js";
import type * as importFoods from "../importFoods.js";
import type * as importMesocycles from "../importMesocycles.js";
import type * as importRecipes from "../importRecipes.js";
import type * as mealPlanSlots from "../mealPlanSlots.js";
import type * as mealPlans from "../mealPlans.js";
import type * as mesocycles from "../mesocycles.js";
import type * as nutrition from "../nutrition.js";
import type * as overload from "../overload.js";
import type * as progress from "../progress.js";
import type * as progressPhotos from "../progressPhotos.js";
import type * as seed from "../seed.js";
import type * as sets from "../sets.js";
import type * as templates from "../templates.js";
import type * as userProfile from "../userProfile.js";
import type * as userRecipes from "../userRecipes.js";
import type * as users from "../users.js";
import type * as weightTracking from "../weightTracking.js";
import type * as workouts from "../workouts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cardioSets: typeof cardioSets;
  dailyReview: typeof dailyReview;
  exercises: typeof exercises;
  foodPreferences: typeof foodPreferences;
  http: typeof http;
  importFoods: typeof importFoods;
  importMesocycles: typeof importMesocycles;
  importRecipes: typeof importRecipes;
  mealPlanSlots: typeof mealPlanSlots;
  mealPlans: typeof mealPlans;
  mesocycles: typeof mesocycles;
  nutrition: typeof nutrition;
  overload: typeof overload;
  progress: typeof progress;
  progressPhotos: typeof progressPhotos;
  seed: typeof seed;
  sets: typeof sets;
  templates: typeof templates;
  userProfile: typeof userProfile;
  userRecipes: typeof userRecipes;
  users: typeof users;
  weightTracking: typeof weightTracking;
  workouts: typeof workouts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
