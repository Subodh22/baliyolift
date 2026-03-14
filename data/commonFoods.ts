// Pre-built food library — macros per `servingG` grams
// All values from USDA FoodData Central / standard nutrition databases

export type FoodItem = {
  id: string;
  name: string;
  serving: string;   // display label e.g. "100g", "1 large egg (60g)"
  servingG: number;  // grams per serving (used for macro scaling)
  calories: number;  // per servingG
  proteinG: number;
  carbsG: number;
  fatG: number;
  category: "protein" | "carbs" | "fats" | "dairy" | "veg" | "other";
};

export const COMMON_FOODS: FoodItem[] = [
  // ── Proteins ────────────────────────────────────────────────────────────
  { id: "chicken-breast",    name: "Chicken Breast (cooked)",    serving: "100g",           servingG: 100, calories: 165, proteinG: 31,   carbsG: 0,   fatG: 3.6,  category: "protein" },
  { id: "turkey-breast",     name: "Turkey Breast (cooked)",     serving: "100g",           servingG: 100, calories: 135, proteinG: 30,   carbsG: 0,   fatG: 1,    category: "protein" },
  { id: "beef-mince-5",      name: "Beef Mince 5% Fat",          serving: "100g",           servingG: 100, calories: 170, proteinG: 26,   carbsG: 0,   fatG: 7,    category: "protein" },
  { id: "beef-mince-20",     name: "Beef Mince 20% Fat",         serving: "100g",           servingG: 100, calories: 254, proteinG: 22,   carbsG: 0,   fatG: 18,   category: "protein" },
  { id: "salmon",            name: "Salmon Fillet",              serving: "100g",           servingG: 100, calories: 208, proteinG: 20,   carbsG: 0,   fatG: 13,   category: "protein" },
  { id: "tuna-canned",       name: "Tuna in Water (canned)",     serving: "100g drained",   servingG: 100, calories: 116, proteinG: 26,   carbsG: 0,   fatG: 1,    category: "protein" },
  { id: "shrimp",            name: "Shrimp / Prawns (cooked)",   serving: "100g",           servingG: 100, calories: 99,  proteinG: 24,   carbsG: 0.2, fatG: 0.3,  category: "protein" },
  { id: "egg-whole",         name: "Whole Egg",                  serving: "1 large (60g)",  servingG: 60,  calories: 86,  proteinG: 7.5,  carbsG: 0.6, fatG: 6,    category: "protein" },
  { id: "egg-white",         name: "Egg Whites",                 serving: "100g",           servingG: 100, calories: 52,  proteinG: 11,   carbsG: 0.7, fatG: 0.2,  category: "protein" },
  { id: "whey-protein",      name: "Whey Protein Powder",        serving: "1 scoop (30g)",  servingG: 30,  calories: 113, proteinG: 22.5, carbsG: 2,   fatG: 1.5,  category: "protein" },
  { id: "casein-protein",    name: "Casein Protein Powder",      serving: "1 scoop (30g)",  servingG: 30,  calories: 110, proteinG: 23,   carbsG: 1.5, fatG: 0.5,  category: "protein" },
  { id: "pork-loin",         name: "Pork Loin (cooked)",         serving: "100g",           servingG: 100, calories: 189, proteinG: 29,   carbsG: 0,   fatG: 7.7,  category: "protein" },

  // ── Carbs ────────────────────────────────────────────────────────────────
  { id: "white-rice",        name: "White Rice (cooked)",        serving: "100g",           servingG: 100, calories: 130, proteinG: 2.7,  carbsG: 28,  fatG: 0.3,  category: "carbs" },
  { id: "brown-rice",        name: "Brown Rice (cooked)",        serving: "100g",           servingG: 100, calories: 122, proteinG: 2.6,  carbsG: 25,  fatG: 1,    category: "carbs" },
  { id: "oats-dry",          name: "Rolled Oats (dry)",          serving: "1 cup (80g)",    servingG: 80,  calories: 311, proteinG: 13,   carbsG: 53,  fatG: 5.5,  category: "carbs" },
  { id: "sweet-potato",      name: "Sweet Potato (baked)",       serving: "100g",           servingG: 100, calories: 90,  proteinG: 2,    carbsG: 21,  fatG: 0.1,  category: "carbs" },
  { id: "white-potato",      name: "White Potato (boiled)",      serving: "100g",           servingG: 100, calories: 77,  proteinG: 2,    carbsG: 17,  fatG: 0.1,  category: "carbs" },
  { id: "pasta-cooked",      name: "Pasta (cooked)",             serving: "100g",           servingG: 100, calories: 158, proteinG: 5.8,  carbsG: 31,  fatG: 0.9,  category: "carbs" },
  { id: "bread-white",       name: "White Bread",                serving: "1 slice (35g)",  servingG: 35,  calories: 93,  proteinG: 3.2,  carbsG: 17,  fatG: 1.1,  category: "carbs" },
  { id: "bread-wholegrain",  name: "Wholegrain Bread",           serving: "1 slice (35g)",  servingG: 35,  calories: 86,  proteinG: 4.5,  carbsG: 14,  fatG: 1.5,  category: "carbs" },
  { id: "banana",            name: "Banana",                     serving: "1 medium (118g)",servingG: 118, calories: 105, proteinG: 1.3,  carbsG: 27,  fatG: 0.4,  category: "carbs" },
  { id: "apple",             name: "Apple",                      serving: "1 medium (182g)",servingG: 182, calories: 95,  proteinG: 0.5,  carbsG: 25,  fatG: 0.3,  category: "carbs" },
  { id: "orange",            name: "Orange",                     serving: "1 medium (131g)",servingG: 131, calories: 62,  proteinG: 1.2,  carbsG: 15,  fatG: 0.2,  category: "carbs" },
  { id: "rice-cakes",        name: "Rice Cakes",                 serving: "1 cake (9g)",    servingG: 9,   calories: 35,  proteinG: 0.7,  carbsG: 7.3, fatG: 0.3,  category: "carbs" },
  { id: "bagel",             name: "Bagel (plain)",              serving: "1 bagel (98g)",  servingG: 98,  calories: 245, proteinG: 9.6,  carbsG: 48,  fatG: 1.5,  category: "carbs" },
  { id: "tortilla-corn",     name: "Corn Tortilla",              serving: "1 tortilla (26g)",servingG: 26, calories: 57,  proteinG: 1.5,  carbsG: 12,  fatG: 0.7,  category: "carbs" },

  // ── Fats ─────────────────────────────────────────────────────────────────
  { id: "avocado",           name: "Avocado",                    serving: "½ avocado (75g)",servingG: 75,  calories: 120, proteinG: 1.5,  carbsG: 6.4, fatG: 11,   category: "fats" },
  { id: "almonds",           name: "Almonds",                    serving: "handful (28g)",  servingG: 28,  calories: 162, proteinG: 6,    carbsG: 6,   fatG: 14,   category: "fats" },
  { id: "peanut-butter",     name: "Peanut Butter",              serving: "2 tbsp (32g)",   servingG: 32,  calories: 188, proteinG: 8,    carbsG: 6.4, fatG: 16,   category: "fats" },
  { id: "almond-butter",     name: "Almond Butter",              serving: "2 tbsp (32g)",   servingG: 32,  calories: 196, proteinG: 6.7,  carbsG: 7,   fatG: 18,   category: "fats" },
  { id: "olive-oil",         name: "Olive Oil",                  serving: "1 tbsp (13g)",   servingG: 13,  calories: 119, proteinG: 0,    carbsG: 0,   fatG: 13.5, category: "fats" },
  { id: "walnuts",           name: "Walnuts",                    serving: "handful (30g)",  servingG: 30,  calories: 196, proteinG: 4.6,  carbsG: 4.1, fatG: 20,   category: "fats" },
  { id: "mixed-nuts",        name: "Mixed Nuts",                 serving: "handful (30g)",  servingG: 30,  calories: 182, proteinG: 5,    carbsG: 6,   fatG: 16,   category: "fats" },
  { id: "chia-seeds",        name: "Chia Seeds",                 serving: "2 tbsp (28g)",   servingG: 28,  calories: 138, proteinG: 4.7,  carbsG: 12,  fatG: 8.7,  category: "fats" },
  { id: "flaxseeds",         name: "Flaxseeds (ground)",         serving: "2 tbsp (20g)",   servingG: 20,  calories: 107, proteinG: 3.7,  carbsG: 5.8, fatG: 8.5,  category: "fats" },

  // ── Dairy ─────────────────────────────────────────────────────────────────
  { id: "greek-yoghurt-0",   name: "Greek Yoghurt (0% fat)",     serving: "100g",           servingG: 100, calories: 59,  proteinG: 10,   carbsG: 3.6, fatG: 0.4,  category: "dairy" },
  { id: "greek-yoghurt-full",name: "Greek Yoghurt (full fat)",   serving: "100g",           servingG: 100, calories: 97,  proteinG: 9,    carbsG: 3.7, fatG: 5,    category: "dairy" },
  { id: "cottage-cheese",    name: "Cottage Cheese (low fat)",   serving: "100g",           servingG: 100, calories: 72,  proteinG: 12,   carbsG: 3.4, fatG: 1,    category: "dairy" },
  { id: "milk-whole",        name: "Whole Milk",                 serving: "1 cup (240ml)",  servingG: 240, calories: 149, proteinG: 8,    carbsG: 12,  fatG: 8,    category: "dairy" },
  { id: "milk-skim",         name: "Skim Milk",                  serving: "1 cup (240ml)",  servingG: 240, calories: 83,  proteinG: 8.3,  carbsG: 12,  fatG: 0.2,  category: "dairy" },
  { id: "cheddar",           name: "Cheddar Cheese",             serving: "1 slice (30g)",  servingG: 30,  calories: 121, proteinG: 7.4,  carbsG: 0.4, fatG: 10,   category: "dairy" },
  { id: "mozzarella",        name: "Mozzarella",                 serving: "100g",           servingG: 100, calories: 280, proteinG: 28,   carbsG: 2.2, fatG: 17,   category: "dairy" },

  // ── Vegetables ────────────────────────────────────────────────────────────
  { id: "broccoli",          name: "Broccoli (steamed)",         serving: "100g",           servingG: 100, calories: 34,  proteinG: 2.8,  carbsG: 7,   fatG: 0.4,  category: "veg" },
  { id: "spinach",           name: "Spinach (raw)",              serving: "100g",           servingG: 100, calories: 23,  proteinG: 2.9,  carbsG: 3.6, fatG: 0.4,  category: "veg" },
  { id: "mixed-salad",       name: "Mixed Salad Leaves",         serving: "100g",           servingG: 100, calories: 20,  proteinG: 1.5,  carbsG: 3,   fatG: 0.3,  category: "veg" },
  { id: "cucumber",          name: "Cucumber",                   serving: "100g",           servingG: 100, calories: 15,  proteinG: 0.7,  carbsG: 3.6, fatG: 0.1,  category: "veg" },
  { id: "tomato",            name: "Tomato",                     serving: "1 medium (123g)",servingG: 123, calories: 22,  proteinG: 1.1,  carbsG: 4.8, fatG: 0.2,  category: "veg" },
  { id: "zucchini",          name: "Zucchini / Courgette",       serving: "100g",           servingG: 100, calories: 17,  proteinG: 1.2,  carbsG: 3.1, fatG: 0.3,  category: "veg" },

  // ── Other / Mixed ─────────────────────────────────────────────────────────
  { id: "protein-bar",       name: "Protein Bar (generic)",      serving: "1 bar (60g)",    servingG: 60,  calories: 200, proteinG: 20,   carbsG: 22,  fatG: 5,    category: "other" },
  { id: "protein-shake",     name: "Protein Shake (water)",      serving: "1 serve (300ml)",servingG: 300, calories: 130, proteinG: 24,   carbsG: 4,   fatG: 2,    category: "other" },
  { id: "dark-chocolate",    name: "Dark Chocolate 70%",         serving: "2 squares (20g)",servingG: 20,  calories: 117, proteinG: 1.6,  carbsG: 10,  fatG: 8,    category: "other" },
  { id: "granola",           name: "Granola",                    serving: "½ cup (57g)",    servingG: 57,  calories: 250, proteinG: 5,    carbsG: 38,  fatG: 9,    category: "other" },
];

export const CATEGORY_LABELS: Record<FoodItem["category"], string> = {
  protein: "PROTEINS",
  carbs:   "CARBS",
  fats:    "FATS",
  dairy:   "DAIRY",
  veg:     "VEGETABLES",
  other:   "OTHER",
};

export const CATEGORY_ORDER: FoodItem["category"][] = [
  "protein", "carbs", "fats", "dairy", "veg", "other",
];
