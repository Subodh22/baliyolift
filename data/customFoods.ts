// Custom Foods Import Data
// ─────────────────────────────────────────────────────────────────────────────
// Fill in your foods below following this format, then run:
//
//   npx convex run importFoods:seedCustomFoods --args '{"clerkId":"<your-clerk-id>"}'
//
// All macros are PER SERVING (based on the servingG amount).
// ─────────────────────────────────────────────────────────────────────────────

export type CustomFoodImport = {
  name: string;
  serving: string;   // display label shown in the UI  e.g. "100g" | "1 scoop (30g)" | "1 cup (240ml)"
  servingG: number;  // grams that 1 serving equals — used for macro scaling
  calories: number;  // kcal per serving
  proteinG: number;  // grams of protein per serving
  carbsG: number;    // grams of carbs per serving
  fatG: number;      // grams of fat per serving
};

export const CUSTOM_FOODS: CustomFoodImport[] = [
  // ── PROTEINS ──────────────────────────────────────────────────────────────
  {
    name: "Chicken Breast (cooked)",
    serving: "100g",
    servingG: 100,
    calories: 165,
    proteinG: 31.0,
    carbsG: 0.0,
    fatG: 3.6,
  },
  {
    name: "Canned Tuna (in water)",
    serving: "1 can (185g drained)",
    servingG: 185,
    calories: 194,
    proteinG: 43.0,
    carbsG: 0.0,
    fatG: 1.7,
  },
  {
    name: "Whey Protein Isolate",
    serving: "1 scoop (30g)",
    servingG: 30,
    calories: 110,
    proteinG: 25.0,
    carbsG: 1.0,
    fatG: 0.5,
  },
  {
    name: "Whole Eggs",
    serving: "1 large (50g)",
    servingG: 50,
    calories: 72,
    proteinG: 6.3,
    carbsG: 0.4,
    fatG: 5.0,
  },
  {
    name: "Greek Yoghurt (0% fat)",
    serving: "200g",
    servingG: 200,
    calories: 118,
    proteinG: 20.0,
    carbsG: 7.2,
    fatG: 0.8,
  },
  {
    name: "Cottage Cheese (low fat)",
    serving: "100g",
    servingG: 100,
    calories: 84,
    proteinG: 11.0,
    carbsG: 3.4,
    fatG: 2.3,
  },

  // ── CARBS ─────────────────────────────────────────────────────────────────
  {
    name: "Rolled Oats (dry)",
    serving: "80g",
    servingG: 80,
    calories: 312,
    proteinG: 10.8,
    carbsG: 52.8,
    fatG: 5.6,
  },
  {
    name: "White Rice (cooked)",
    serving: "200g",
    servingG: 200,
    calories: 260,
    proteinG: 4.8,
    carbsG: 57.0,
    fatG: 0.4,
  },
  {
    name: "Sweet Potato (baked)",
    serving: "150g",
    servingG: 150,
    calories: 129,
    proteinG: 2.9,
    carbsG: 30.0,
    fatG: 0.2,
  },
  {
    name: "Banana",
    serving: "1 medium (120g)",
    servingG: 120,
    calories: 107,
    proteinG: 1.3,
    carbsG: 27.0,
    fatG: 0.4,
  },

  // ── FATS ──────────────────────────────────────────────────────────────────
  {
    name: "Peanut Butter",
    serving: "2 tbsp (32g)",
    servingG: 32,
    calories: 188,
    proteinG: 7.0,
    carbsG: 6.9,
    fatG: 16.0,
  },
  {
    name: "Olive Oil",
    serving: "1 tbsp (14g)",
    servingG: 14,
    calories: 124,
    proteinG: 0.0,
    carbsG: 0.0,
    fatG: 14.0,
  },
  {
    name: "Avocado",
    serving: "half (70g)",
    servingG: 70,
    calories: 114,
    proteinG: 1.4,
    carbsG: 6.1,
    fatG: 10.5,
  },

  // ── VEGETABLES ────────────────────────────────────────────────────────────
  {
    name: "Broccoli (steamed)",
    serving: "100g",
    servingG: 100,
    calories: 35,
    proteinG: 2.4,
    carbsG: 7.2,
    fatG: 0.4,
  },
  {
    name: "Spinach (raw)",
    serving: "100g",
    servingG: 100,
    calories: 23,
    proteinG: 2.9,
    carbsG: 3.6,
    fatG: 0.4,
  },

  // ── ADD YOUR OWN BELOW ────────────────────────────────────────────────────
  // Copy and paste this block for each new food:
  //
  // {
  //   name: "Food Name",
  //   serving: "1 serving (Xg)",
  //   servingG: X,
  //   calories: X,
  //   proteinG: X,
  //   carbsG: X,
  //   fatG: X,
  // },
];
