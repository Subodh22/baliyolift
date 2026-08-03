// Meal Plans — pre-built recipes for cut / bulk / maintain goals
// Macros calculated per ingredient amount from USDA FoodData Central data
// Total macros are pre-summed per recipe for display performance

export type GoalType = "cut" | "bulk" | "maintain";
// MealType = recipe CATEGORY (used for browsing/classifying recipes).
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "post-workout" | "sauce" | "smoothie" | "dessert";
// MealSlot = the schedulable/loggable daily meals. Meal-plan slots
// (mealPlanSlots) and food entries (foodEntries) only ever use these four —
// a recipe categorised "post-workout"/"sauce"/etc. is logged into one of them.
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type Ingredient = {
  name: string;
  amount: string;       // display label e.g. "200g", "2 tbsp"
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  goal: GoalType;
  mealType: MealType;
  prepTimeMins: number;
  cookTimeMins: number;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  totalMacros: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
};

export const RECIPES: Recipe[] = [

  // ── CUT ────────────────────────────────────────────────────────────────────

  {
    id: "cut-egg-white-omelette",
    name: "Egg White Omelette",
    description: "Light, high-protein omelette with spinach and tomato. Zero-fat cooking keeps calories low while the egg whites deliver a clean protein hit.",
    goal: "cut",
    mealType: "breakfast",
    prepTimeMins: 3,
    cookTimeMins: 7,
    tags: ["high-protein", "low-fat", "quick"],
    ingredients: [
      { name: "Egg Whites",        amount: "200g",        calories: 104, proteinG: 22.0, carbsG: 1.4, fatG: 0.4 },
      { name: "Spinach (raw)",     amount: "50g",         calories: 12,  proteinG: 1.5,  carbsG: 1.8, fatG: 0.2 },
      { name: "Tomato",            amount: "1 medium",    calories: 22,  proteinG: 1.1,  carbsG: 4.8, fatG: 0.2 },
    ],
    instructions: [
      "Whisk egg whites with a pinch of salt and black pepper.",
      "Heat a non-stick pan over medium heat — no oil needed.",
      "Pour in egg whites and cook until edges set, ~2 min.",
      "Add spinach and diced tomato to one half.",
      "Fold omelette over filling and cook 1 more minute.",
      "Slide onto plate and serve immediately.",
    ],
    totalMacros: { calories: 138, proteinG: 24.6, carbsG: 8.0, fatG: 0.8 },
  },

  {
    id: "cut-yoghurt-parfait",
    name: "Greek Yoghurt Parfait",
    description: "Thick 0% Greek yoghurt layered with oats and banana. High protein, moderate carbs, and almost no fat — perfect for a cutting breakfast.",
    goal: "cut",
    mealType: "breakfast",
    prepTimeMins: 5,
    cookTimeMins: 0,
    tags: ["high-protein", "no-cook", "meal-prep"],
    ingredients: [
      { name: "Greek Yoghurt (0% fat)", amount: "200g",        calories: 118, proteinG: 20.0, carbsG: 7.2, fatG: 0.8 },
      { name: "Rolled Oats (dry)",      amount: "30g",         calories: 117, proteinG: 4.9,  carbsG: 20.0, fatG: 2.1 },
      { name: "Banana",                 amount: "1 medium",    calories: 105, proteinG: 1.3,  carbsG: 27.0, fatG: 0.4 },
    ],
    instructions: [
      "Layer yoghurt into a bowl or jar.",
      "Top with dry oats — they soften naturally from the yoghurt.",
      "Slice banana over the top.",
      "For meal prep: assemble the night before, oats will be creamy by morning.",
    ],
    totalMacros: { calories: 340, proteinG: 26.2, carbsG: 54.2, fatG: 3.3 },
  },

  {
    id: "cut-overnight-oats",
    name: "High-Protein Overnight Oats",
    description: "Whey protein stirred into overnight oats for a filling, high-protein breakfast. Prep the night before and it's ready when you wake up.",
    goal: "cut",
    mealType: "breakfast",
    prepTimeMins: 5,
    cookTimeMins: 0,
    tags: ["high-protein", "meal-prep", "no-cook"],
    ingredients: [
      { name: "Rolled Oats (dry)",    amount: "80g",       calories: 311, proteinG: 13.0, carbsG: 53.0, fatG: 5.5 },
      { name: "Skim Milk",            amount: "240ml",     calories: 83,  proteinG: 8.3,  carbsG: 12.0, fatG: 0.2 },
      { name: "Whey Protein Powder",  amount: "1 scoop",   calories: 113, proteinG: 22.5, carbsG: 2.0,  fatG: 1.5 },
      { name: "Banana (half)",        amount: "60g",       calories: 53,  proteinG: 0.7,  carbsG: 13.7, fatG: 0.2 },
    ],
    instructions: [
      "Add oats and skim milk to a jar or container.",
      "Stir in whey protein until fully dissolved.",
      "Slice half a banana on top.",
      "Seal and refrigerate overnight (or at least 4 hours).",
      "Give it a stir before eating — add a splash of milk if too thick.",
    ],
    totalMacros: { calories: 560, proteinG: 44.5, carbsG: 80.7, fatG: 7.4 },
  },

  {
    id: "cut-chicken-rice-bowl",
    name: "Chicken & Rice Bowl",
    description: "The classic bodybuilding staple done right. Lean chicken breast over white rice with broccoli — high protein, controlled carbs, minimal fat.",
    goal: "cut",
    mealType: "lunch",
    prepTimeMins: 5,
    cookTimeMins: 20,
    tags: ["high-protein", "meal-prep", "classic"],
    ingredients: [
      { name: "Chicken Breast (cooked)", amount: "200g",  calories: 330, proteinG: 62.0, carbsG: 0.0,  fatG: 7.2 },
      { name: "White Rice (cooked)",     amount: "200g",  calories: 260, proteinG: 5.4,  carbsG: 56.0, fatG: 0.6 },
      { name: "Broccoli (steamed)",      amount: "100g",  calories: 34,  proteinG: 2.8,  carbsG: 7.0,  fatG: 0.4 },
      { name: "Spinach (raw)",           amount: "50g",   calories: 12,  proteinG: 1.5,  carbsG: 1.8,  fatG: 0.2 },
    ],
    instructions: [
      "Season chicken with salt, pepper, garlic powder.",
      "Cook chicken in a non-stick pan or oven at 200°C for 18–20 min.",
      "Steam broccoli for 5 minutes until just tender.",
      "Assemble rice in a bowl, top with sliced chicken, broccoli, and spinach.",
      "Add a splash of soy sauce or hot sauce for flavour if desired.",
    ],
    totalMacros: { calories: 636, proteinG: 71.7, carbsG: 64.8, fatG: 8.4 },
  },

  {
    id: "cut-tuna-wrap",
    name: "Tuna Salad Wrap",
    description: "Canned tuna loaded with fresh salad in a corn tortilla. Almost zero fat, very high protein, and takes 5 minutes flat.",
    goal: "cut",
    mealType: "lunch",
    prepTimeMins: 5,
    cookTimeMins: 0,
    tags: ["high-protein", "quick", "no-cook"],
    ingredients: [
      { name: "Tuna in Water (canned)",  amount: "150g drained", calories: 174, proteinG: 39.0, carbsG: 0.3,  fatG: 1.5 },
      { name: "Mixed Salad Leaves",      amount: "80g",          calories: 16,  proteinG: 1.2,  carbsG: 2.4,  fatG: 0.2 },
      { name: "Cucumber",               amount: "80g",          calories: 12,  proteinG: 0.6,  carbsG: 2.9,  fatG: 0.1 },
      { name: "Tomato",                 amount: "1 medium",     calories: 22,  proteinG: 1.1,  carbsG: 4.8,  fatG: 0.2 },
      { name: "Corn Tortilla",          amount: "1 tortilla",   calories: 57,  proteinG: 1.5,  carbsG: 12.0, fatG: 0.7 },
    ],
    instructions: [
      "Drain tuna thoroughly and flake into a bowl.",
      "Mix in diced cucumber and torn salad leaves.",
      "Season with salt, pepper, and a squeeze of lemon.",
      "Lay tortilla flat, add tuna mix and sliced tomato.",
      "Roll tightly and slice in half.",
    ],
    totalMacros: { calories: 281, proteinG: 43.4, carbsG: 22.4, fatG: 2.7 },
  },

  {
    id: "cut-salmon-sweet-potato",
    name: "Baked Salmon + Sweet Potato",
    description: "Omega-3 rich salmon with baked sweet potato and steamed broccoli. Healthy fats from the salmon keep you satiated on a deficit.",
    goal: "cut",
    mealType: "dinner",
    prepTimeMins: 10,
    cookTimeMins: 25,
    tags: ["omega-3", "meal-prep"],
    ingredients: [
      { name: "Salmon Fillet",        amount: "180g",   calories: 374, proteinG: 36.0, carbsG: 0.0,  fatG: 23.4 },
      { name: "Sweet Potato (baked)", amount: "200g",   calories: 180, proteinG: 4.0,  carbsG: 42.0, fatG: 0.2 },
      { name: "Broccoli (steamed)",   amount: "150g",   calories: 51,  proteinG: 4.2,  carbsG: 10.5, fatG: 0.6 },
    ],
    instructions: [
      "Preheat oven to 200°C. Pierce sweet potato and bake 20–25 min.",
      "Season salmon with salt, pepper, and a squeeze of lemon.",
      "Place salmon on a lined baking tray. Bake at 200°C for 12–15 min.",
      "Steam broccoli for the last 5 minutes.",
      "Slice sweet potato open and serve alongside salmon and broccoli.",
    ],
    totalMacros: { calories: 605, proteinG: 44.2, carbsG: 52.5, fatG: 24.2 },
  },

  {
    id: "cut-turkey-stir-fry",
    name: "Turkey Stir Fry",
    description: "Lean turkey breast stir-fried with vegetables over white rice. One of the highest protein-to-calorie ratios in the meal plan.",
    goal: "cut",
    mealType: "dinner",
    prepTimeMins: 10,
    cookTimeMins: 15,
    tags: ["high-protein", "low-fat", "quick"],
    ingredients: [
      { name: "Turkey Breast (cooked)", amount: "200g",  calories: 270, proteinG: 60.0, carbsG: 0.0,  fatG: 2.0  },
      { name: "White Rice (cooked)",    amount: "150g",  calories: 195, proteinG: 4.1,  carbsG: 42.0, fatG: 0.5  },
      { name: "Broccoli (steamed)",     amount: "100g",  calories: 34,  proteinG: 2.8,  carbsG: 7.0,  fatG: 0.4  },
      { name: "Zucchini / Courgette",   amount: "100g",  calories: 17,  proteinG: 1.2,  carbsG: 3.1,  fatG: 0.3  },
      { name: "Olive Oil",              amount: "1 tbsp",calories: 119, proteinG: 0.0,  carbsG: 0.0,  fatG: 13.5 },
    ],
    instructions: [
      "Slice turkey into thin strips. Season with soy sauce, garlic, ginger.",
      "Heat olive oil in a wok or large pan over high heat.",
      "Stir-fry turkey 3–4 min until cooked through. Remove and set aside.",
      "Add broccoli and zucchini to the same pan, stir-fry 3–4 min.",
      "Return turkey to pan, toss everything together.",
      "Serve over white rice.",
    ],
    totalMacros: { calories: 635, proteinG: 68.1, carbsG: 52.1, fatG: 16.7 },
  },

  {
    id: "cut-cottage-cheese-bowl",
    name: "Cottage Cheese Bowl",
    description: "Slow-digesting cottage cheese with a banana. High protein, fills you up for hours — ideal as an afternoon snack or before bed.",
    goal: "cut",
    mealType: "snack",
    prepTimeMins: 2,
    cookTimeMins: 0,
    tags: ["high-protein", "no-cook", "slow-digesting"],
    ingredients: [
      { name: "Cottage Cheese (low fat)", amount: "200g",       calories: 144, proteinG: 24.0, carbsG: 6.8, fatG: 2.0 },
      { name: "Apple",                    amount: "1 medium",   calories: 95,  proteinG: 0.5,  carbsG: 25.0, fatG: 0.3 },
    ],
    instructions: [
      "Spoon cottage cheese into a bowl.",
      "Slice apple and arrange on top.",
      "Optional: add a pinch of cinnamon or a drizzle of honey.",
    ],
    totalMacros: { calories: 239, proteinG: 24.5, carbsG: 31.8, fatG: 2.3 },
  },

  {
    id: "cut-rice-cakes-tuna",
    name: "Rice Cakes + Tuna",
    description: "Crispy rice cakes topped with drained tuna. Ultra-low calorie, high protein — the go-to cutting snack when hunger strikes.",
    goal: "cut",
    mealType: "snack",
    prepTimeMins: 3,
    cookTimeMins: 0,
    tags: ["high-protein", "ultra-low-cal", "no-cook"],
    ingredients: [
      { name: "Rice Cakes",              amount: "3 cakes (27g)", calories: 105, proteinG: 2.1,  carbsG: 21.9, fatG: 0.9 },
      { name: "Tuna in Water (canned)",  amount: "100g drained",  calories: 116, proteinG: 26.0, carbsG: 0.0,  fatG: 1.0 },
    ],
    instructions: [
      "Drain tuna and mix with salt, pepper, and a squeeze of lemon.",
      "Spoon tuna onto rice cakes.",
      "Optional: add sliced cucumber or a drop of hot sauce.",
    ],
    totalMacros: { calories: 221, proteinG: 28.1, carbsG: 21.9, fatG: 1.9 },
  },

  // ── BULK ───────────────────────────────────────────────────────────────────

  {
    id: "bulk-egg-oat-pancakes",
    name: "Egg & Oat Pancakes",
    description: "Three whole eggs blended with oats and banana — a high-calorie, protein-dense pancake stack. Great pre-training fuel for a bulk.",
    goal: "bulk",
    mealType: "breakfast",
    prepTimeMins: 5,
    cookTimeMins: 12,
    tags: ["high-calorie", "high-protein", "pre-workout"],
    ingredients: [
      { name: "Whole Egg",         amount: "3 large",    calories: 258, proteinG: 22.5, carbsG: 1.8,  fatG: 18.0 },
      { name: "Rolled Oats (dry)", amount: "80g",        calories: 311, proteinG: 13.0, carbsG: 53.0, fatG: 5.5  },
      { name: "Banana",            amount: "1 medium",   calories: 105, proteinG: 1.3,  carbsG: 27.0, fatG: 0.4  },
      { name: "Whole Milk",        amount: "120ml",      calories: 75,  proteinG: 4.0,  carbsG: 6.0,  fatG: 4.0  },
    ],
    instructions: [
      "Blend oats, eggs, banana, and milk until smooth batter forms.",
      "Heat a non-stick pan over medium heat with a small spray of oil.",
      "Pour batter into 3–4 pancakes. Cook 2–3 min each side until golden.",
      "Stack and top with a sliced banana or a small drizzle of honey.",
    ],
    totalMacros: { calories: 749, proteinG: 40.8, carbsG: 87.8, fatG: 27.9 },
  },

  {
    id: "bulk-mass-smoothie-bowl",
    name: "Mass Smoothie Bowl",
    description: "Thick smoothie bowl packed with oats, whole milk, peanut butter, and whey. Nearly 900 calories in one bowl — serious bulking fuel.",
    goal: "bulk",
    mealType: "breakfast",
    prepTimeMins: 5,
    cookTimeMins: 0,
    tags: ["high-calorie", "high-protein", "no-cook"],
    ingredients: [
      { name: "Rolled Oats (dry)",    amount: "80g",          calories: 311, proteinG: 13.0, carbsG: 53.0, fatG: 5.5  },
      { name: "Whole Milk",           amount: "240ml",         calories: 149, proteinG: 8.0,  carbsG: 12.0, fatG: 8.0  },
      { name: "Banana",               amount: "1 medium",      calories: 105, proteinG: 1.3,  carbsG: 27.0, fatG: 0.4  },
      { name: "Peanut Butter",        amount: "2 tbsp",        calories: 188, proteinG: 8.0,  carbsG: 6.4,  fatG: 16.0 },
      { name: "Whey Protein Powder",  amount: "1 scoop",       calories: 113, proteinG: 22.5, carbsG: 2.0,  fatG: 1.5  },
    ],
    instructions: [
      "Blend oats, milk, banana, and whey protein until thick and smooth.",
      "Pour into a bowl.",
      "Top with peanut butter and sliced banana.",
      "Eat immediately — the oats thicken fast.",
    ],
    totalMacros: { calories: 866, proteinG: 52.8, carbsG: 100.4, fatG: 31.4 },
  },

  {
    id: "bulk-double-chicken-pasta",
    name: "Double Chicken Pasta",
    description: "300g of chicken breast over a large bowl of pasta with olive oil and broccoli. Over 100g protein in one meal — built for serious bulking.",
    goal: "bulk",
    mealType: "lunch",
    prepTimeMins: 5,
    cookTimeMins: 20,
    tags: ["very-high-protein", "high-calorie", "meal-prep"],
    ingredients: [
      { name: "Chicken Breast (cooked)", amount: "300g",    calories: 495, proteinG: 93.0, carbsG: 0.0,  fatG: 10.8 },
      { name: "Pasta (cooked)",          amount: "250g",    calories: 395, proteinG: 14.5, carbsG: 77.5, fatG: 2.3  },
      { name: "Olive Oil",               amount: "1 tbsp",  calories: 119, proteinG: 0.0,  carbsG: 0.0,  fatG: 13.5 },
      { name: "Broccoli (steamed)",      amount: "100g",    calories: 34,  proteinG: 2.8,  carbsG: 7.0,  fatG: 0.4  },
    ],
    instructions: [
      "Cook pasta in salted boiling water until al dente. Drain.",
      "Season and grill or pan-fry chicken for 18–20 min.",
      "Toss pasta with olive oil, salt, pepper, and garlic powder.",
      "Steam broccoli while pasta cooks.",
      "Slice chicken and serve over pasta with broccoli on the side.",
    ],
    totalMacros: { calories: 1043, proteinG: 110.3, carbsG: 84.5, fatG: 27.0 },
  },

  {
    id: "bulk-beef-burrito-bowl",
    name: "Ground Beef Burrito Bowl",
    description: "20% fat beef mince with rice, corn tortillas, and cheddar. A calorie-dense, flavourful bulk meal that doesn't feel like diet food.",
    goal: "bulk",
    mealType: "lunch",
    prepTimeMins: 5,
    cookTimeMins: 20,
    tags: ["high-calorie", "high-fat", "comfort-food"],
    ingredients: [
      { name: "Beef Mince 20% Fat",  amount: "200g",         calories: 508, proteinG: 44.0, carbsG: 0.0,  fatG: 36.0 },
      { name: "White Rice (cooked)", amount: "200g",         calories: 260, proteinG: 5.4,  carbsG: 56.0, fatG: 0.6  },
      { name: "Corn Tortilla",       amount: "2 tortillas",  calories: 114, proteinG: 3.0,  carbsG: 24.0, fatG: 1.4  },
      { name: "Cheddar Cheese",      amount: "1 slice (30g)",calories: 121, proteinG: 7.4,  carbsG: 0.4,  fatG: 10.0 },
    ],
    instructions: [
      "Cook rice as per packet instructions.",
      "Brown beef mince in a pan over high heat, breaking it up. Season with cumin, paprika, salt, pepper.",
      "Warm tortillas in a dry pan for 30 seconds each side.",
      "Build the bowl: rice, beef, then torn tortillas and shredded cheddar on top.",
    ],
    totalMacros: { calories: 1003, proteinG: 59.8, carbsG: 80.4, fatG: 48.0 },
  },

  {
    id: "bulk-beef-rice-bowl",
    name: "Lean Beef Rice Bowl",
    description: "5% fat mince over a large rice base with broccoli and olive oil. Clean bulk with controlled fat — high protein, high carb.",
    goal: "bulk",
    mealType: "dinner",
    prepTimeMins: 5,
    cookTimeMins: 20,
    tags: ["high-protein", "high-carb", "meal-prep"],
    ingredients: [
      { name: "Beef Mince 5% Fat",   amount: "250g",   calories: 425, proteinG: 65.0, carbsG: 0.0,  fatG: 17.5 },
      { name: "White Rice (cooked)", amount: "250g",   calories: 325, proteinG: 6.8,  carbsG: 70.0, fatG: 0.8  },
      { name: "Broccoli (steamed)",  amount: "150g",   calories: 51,  proteinG: 4.2,  carbsG: 10.5, fatG: 0.6  },
      { name: "Olive Oil",           amount: "1 tbsp", calories: 119, proteinG: 0.0,  carbsG: 0.0,  fatG: 13.5 },
    ],
    instructions: [
      "Cook rice. While it cooks, brown beef mince in a pan with olive oil.",
      "Season beef with garlic powder, onion powder, soy sauce, salt, pepper.",
      "Steam broccoli.",
      "Serve beef over rice with broccoli. Drizzle with soy sauce.",
    ],
    totalMacros: { calories: 920, proteinG: 76.0, carbsG: 80.5, fatG: 32.4 },
  },

  {
    id: "bulk-pasta-bolognese",
    name: "Pasta Bolognese",
    description: "Rich beef bolognese over a large pasta base. Comfort food that fits perfectly in a bulk — nearly 1000 calories and 58g protein.",
    goal: "bulk",
    mealType: "dinner",
    prepTimeMins: 5,
    cookTimeMins: 25,
    tags: ["high-calorie", "comfort-food"],
    ingredients: [
      { name: "Beef Mince 20% Fat", amount: "200g",    calories: 508, proteinG: 44.0, carbsG: 0.0,  fatG: 36.0 },
      { name: "Pasta (cooked)",     amount: "200g",    calories: 316, proteinG: 11.6, carbsG: 62.0, fatG: 1.8  },
      { name: "Tomato",             amount: "2 medium",calories: 44,  proteinG: 2.2,  carbsG: 9.6,  fatG: 0.4  },
      { name: "Olive Oil",          amount: "1 tbsp",  calories: 119, proteinG: 0.0,  carbsG: 0.0,  fatG: 13.5 },
    ],
    instructions: [
      "Cook pasta in salted water until al dente. Drain.",
      "Brown beef mince in olive oil over high heat.",
      "Add diced tomatoes and season with oregano, basil, salt, pepper.",
      "Simmer sauce for 15 minutes, stirring occasionally.",
      "Serve sauce over pasta. Top with a little black pepper.",
    ],
    totalMacros: { calories: 987, proteinG: 57.8, carbsG: 71.6, fatG: 51.7 },
  },

  {
    id: "bulk-peanut-butter-oats",
    name: "Peanut Butter Oats",
    description: "Creamy oats with whole milk and peanut butter. A bulking snack that's calorie-dense without being junk food.",
    goal: "bulk",
    mealType: "snack",
    prepTimeMins: 2,
    cookTimeMins: 5,
    tags: ["high-calorie", "high-fat", "quick"],
    ingredients: [
      { name: "Rolled Oats (dry)", amount: "80g",      calories: 311, proteinG: 13.0, carbsG: 53.0, fatG: 5.5  },
      { name: "Whole Milk",        amount: "240ml",    calories: 149, proteinG: 8.0,  carbsG: 12.0, fatG: 8.0  },
      { name: "Peanut Butter",     amount: "2 tbsp",   calories: 188, proteinG: 8.0,  carbsG: 6.4,  fatG: 16.0 },
      { name: "Banana (half)",     amount: "60g",      calories: 53,  proteinG: 0.7,  carbsG: 13.7, fatG: 0.2  },
    ],
    instructions: [
      "Combine oats and milk in a saucepan over medium heat.",
      "Stir continuously for 3–4 minutes until thick and creamy.",
      "Remove from heat, stir in peanut butter.",
      "Top with sliced banana.",
    ],
    totalMacros: { calories: 701, proteinG: 29.7, carbsG: 85.1, fatG: 29.7 },
  },

  {
    id: "bulk-granola-milk",
    name: "Granola & Whole Milk",
    description: "Simple, quick bulk snack. A big bowl of granola with whole milk — easy calories when you're struggling to hit your surplus.",
    goal: "bulk",
    mealType: "snack",
    prepTimeMins: 1,
    cookTimeMins: 0,
    tags: ["high-calorie", "quick", "no-cook"],
    ingredients: [
      { name: "Granola",     amount: "½ cup (57g)", calories: 250, proteinG: 5.0,  carbsG: 38.0, fatG: 9.0 },
      { name: "Whole Milk",  amount: "240ml",       calories: 149, proteinG: 8.0,  carbsG: 12.0, fatG: 8.0 },
    ],
    instructions: [
      "Pour granola into a bowl.",
      "Add cold whole milk.",
      "Eat immediately for crunch, or let it sit 2 min to soften.",
    ],
    totalMacros: { calories: 399, proteinG: 13.0, carbsG: 50.0, fatG: 17.0 },
  },

  // ── MAINTAIN ───────────────────────────────────────────────────────────────

  {
    id: "maintain-egg-scramble",
    name: "Whole Egg Scramble",
    description: "Three whole eggs scrambled with spinach and cheddar. Balanced macros from real whole food — the definition of a maintenance breakfast.",
    goal: "maintain",
    mealType: "breakfast",
    prepTimeMins: 3,
    cookTimeMins: 6,
    tags: ["balanced", "quick", "high-protein"],
    ingredients: [
      { name: "Whole Egg",        amount: "3 large", calories: 258, proteinG: 22.5, carbsG: 1.8, fatG: 18.0 },
      { name: "Spinach (raw)",    amount: "50g",     calories: 12,  proteinG: 1.5,  carbsG: 1.8, fatG: 0.2  },
      { name: "Cheddar Cheese",   amount: "1 slice", calories: 121, proteinG: 7.4,  carbsG: 0.4, fatG: 10.0 },
    ],
    instructions: [
      "Crack eggs into a bowl, season with salt and pepper, whisk.",
      "Heat a non-stick pan over medium-low heat with a tiny spray of oil.",
      "Add spinach — it wilts in about 30 seconds.",
      "Pour in eggs and stir gently, folding as they set.",
      "Just before fully set, add shredded cheddar and fold in.",
      "Remove from heat — residual heat finishes cooking.",
    ],
    totalMacros: { calories: 391, proteinG: 31.4, carbsG: 4.0, fatG: 28.2 },
  },

  {
    id: "maintain-avocado-toast",
    name: "Avocado Toast + Eggs",
    description: "Wholegrain toast with mashed avocado and two pan-fried eggs. Classic balanced breakfast with healthy fats, protein, and complex carbs.",
    goal: "maintain",
    mealType: "breakfast",
    prepTimeMins: 5,
    cookTimeMins: 8,
    tags: ["balanced", "healthy-fats"],
    ingredients: [
      { name: "Wholegrain Bread", amount: "2 slices",  calories: 172, proteinG: 9.0,  carbsG: 28.0, fatG: 3.0  },
      { name: "Avocado",          amount: "½ avocado", calories: 120, proteinG: 1.5,  carbsG: 6.4,  fatG: 11.0 },
      { name: "Whole Egg",        amount: "2 large",   calories: 172, proteinG: 15.0, carbsG: 1.2,  fatG: 12.0 },
    ],
    instructions: [
      "Toast bread to your liking.",
      "Mash avocado with a fork, season with salt, pepper, and lemon juice.",
      "Fry eggs in a non-stick pan — sunny side up or over easy.",
      "Spread avocado on toast, top each slice with a fried egg.",
      "Season eggs with salt, pepper, and chilli flakes.",
    ],
    totalMacros: { calories: 464, proteinG: 25.5, carbsG: 35.6, fatG: 26.0 },
  },

  {
    id: "maintain-chicken-caesar",
    name: "Chicken Caesar Salad",
    description: "Grilled chicken over mixed greens with cheddar and olive oil dressing. High protein, low carb — fits maintenance with room for carbs elsewhere.",
    goal: "maintain",
    mealType: "lunch",
    prepTimeMins: 10,
    cookTimeMins: 20,
    tags: ["high-protein", "low-carb", "balanced"],
    ingredients: [
      { name: "Chicken Breast (cooked)", amount: "150g",    calories: 248, proteinG: 46.5, carbsG: 0.0, fatG: 5.4  },
      { name: "Mixed Salad Leaves",      amount: "100g",    calories: 20,  proteinG: 1.5,  carbsG: 3.0, fatG: 0.3  },
      { name: "Cheddar Cheese",          amount: "1 slice", calories: 121, proteinG: 7.4,  carbsG: 0.4, fatG: 10.0 },
      { name: "Olive Oil",               amount: "1 tbsp",  calories: 119, proteinG: 0.0,  carbsG: 0.0, fatG: 13.5 },
    ],
    instructions: [
      "Season and grill or pan-fry chicken until cooked through. Slice into strips.",
      "Arrange salad leaves in a large bowl.",
      "Top with sliced chicken and shredded cheddar.",
      "Drizzle with olive oil and a squeeze of lemon.",
      "Season with salt, black pepper, and garlic powder.",
    ],
    totalMacros: { calories: 508, proteinG: 55.4, carbsG: 3.4, fatG: 29.2 },
  },

  {
    id: "maintain-mixed-rice-bowl",
    name: "Mixed Rice Bowl",
    description: "Brown rice, grilled chicken, avocado, and spinach. Each macro group represented in balanced amounts — textbook maintenance meal.",
    goal: "maintain",
    mealType: "lunch",
    prepTimeMins: 5,
    cookTimeMins: 25,
    tags: ["balanced", "meal-prep"],
    ingredients: [
      { name: "Brown Rice (cooked)",     amount: "200g",      calories: 244, proteinG: 5.2,  carbsG: 50.0, fatG: 2.0  },
      { name: "Chicken Breast (cooked)", amount: "150g",      calories: 248, proteinG: 46.5, carbsG: 0.0,  fatG: 5.4  },
      { name: "Avocado",                 amount: "½ avocado", calories: 120, proteinG: 1.5,  carbsG: 6.4,  fatG: 11.0 },
      { name: "Spinach (raw)",           amount: "50g",       calories: 12,  proteinG: 1.5,  carbsG: 1.8,  fatG: 0.2  },
    ],
    instructions: [
      "Cook brown rice per packet instructions (~20 min).",
      "Season and grill chicken. Slice into pieces.",
      "Layer brown rice in a bowl, top with chicken, sliced avocado, and spinach.",
      "Season with salt, pepper, and a squeeze of lime.",
    ],
    totalMacros: { calories: 624, proteinG: 54.7, carbsG: 58.2, fatG: 18.6 },
  },

  {
    id: "maintain-salmon-broccoli",
    name: "Salmon + Broccoli",
    description: "Pan-seared salmon with steamed broccoli and olive oil. Rich in omega-3s, balanced protein and fat, near-zero carbs for flexible macro management.",
    goal: "maintain",
    mealType: "dinner",
    prepTimeMins: 5,
    cookTimeMins: 15,
    tags: ["omega-3", "low-carb", "balanced"],
    ingredients: [
      { name: "Salmon Fillet",       amount: "200g",   calories: 416, proteinG: 40.0, carbsG: 0.0,  fatG: 26.0 },
      { name: "Broccoli (steamed)",  amount: "200g",   calories: 68,  proteinG: 5.6,  carbsG: 14.0, fatG: 0.8  },
      { name: "Olive Oil",           amount: "1 tbsp", calories: 119, proteinG: 0.0,  carbsG: 0.0,  fatG: 13.5 },
    ],
    instructions: [
      "Pat salmon dry, season with salt, pepper, and lemon zest.",
      "Heat olive oil in a pan over medium-high heat.",
      "Place salmon skin-side up and cook 3–4 min. Flip, cook 3 more min.",
      "Steam broccoli alongside for 5 minutes until just tender.",
      "Serve with a wedge of lemon.",
    ],
    totalMacros: { calories: 603, proteinG: 45.6, carbsG: 14.0, fatG: 40.3 },
  },

  {
    id: "maintain-chicken-potato",
    name: "Chicken & Roasted Potato",
    description: "Lean chicken breast with roasted white potato and zucchini. Classic maintenance dinner — protein and starchy carbs in equal balance.",
    goal: "maintain",
    mealType: "dinner",
    prepTimeMins: 10,
    cookTimeMins: 30,
    tags: ["balanced", "meal-prep"],
    ingredients: [
      { name: "Chicken Breast (cooked)", amount: "200g",   calories: 330, proteinG: 62.0, carbsG: 0.0,  fatG: 7.2  },
      { name: "White Potato (boiled)",   amount: "250g",   calories: 193, proteinG: 5.0,  carbsG: 42.5, fatG: 0.3  },
      { name: "Zucchini / Courgette",    amount: "100g",   calories: 17,  proteinG: 1.2,  carbsG: 3.1,  fatG: 0.3  },
      { name: "Olive Oil",               amount: "1 tbsp", calories: 119, proteinG: 0.0,  carbsG: 0.0,  fatG: 13.5 },
    ],
    instructions: [
      "Preheat oven to 220°C. Cube potato and toss in half the olive oil, salt, rosemary.",
      "Roast potato 25–30 min, flipping once, until golden.",
      "Season chicken and pan-fry in remaining olive oil, 6–7 min each side.",
      "Slice zucchini and add to chicken pan for last 3 minutes.",
      "Plate with roasted potato alongside.",
    ],
    totalMacros: { calories: 659, proteinG: 68.2, carbsG: 45.6, fatG: 21.3 },
  },

  {
    id: "maintain-nuts-apple",
    name: "Mixed Nuts + Apple",
    description: "Handful of mixed nuts with an apple. Healthy fats, fibre, and natural sugar — the perfect balanced snack between meals.",
    goal: "maintain",
    mealType: "snack",
    prepTimeMins: 1,
    cookTimeMins: 0,
    tags: ["balanced", "healthy-fats", "no-cook"],
    ingredients: [
      { name: "Mixed Nuts", amount: "30g",         calories: 182, proteinG: 5.0,  carbsG: 6.0,  fatG: 16.0 },
      { name: "Apple",      amount: "1 medium",    calories: 95,  proteinG: 0.5,  carbsG: 25.0, fatG: 0.3  },
    ],
    instructions: [
      "Portion out nuts into a small bowl.",
      "Slice or eat the apple whole.",
    ],
    totalMacros: { calories: 277, proteinG: 5.5, carbsG: 31.0, fatG: 16.3 },
  },

  {
    id: "maintain-post-workout-shake",
    name: "Post-Workout Protein Shake",
    description: "Whey protein with skim milk and banana. Fast-digesting protein + carbs to kick-start recovery. Hit this within 30 minutes of training.",
    goal: "maintain",
    mealType: "post-workout",
    prepTimeMins: 2,
    cookTimeMins: 0,
    tags: ["post-workout", "quick", "high-protein"],
    ingredients: [
      { name: "Whey Protein Powder", amount: "1 scoop",  calories: 113, proteinG: 22.5, carbsG: 2.0,  fatG: 1.5 },
      { name: "Skim Milk",           amount: "240ml",    calories: 83,  proteinG: 8.3,  carbsG: 12.0, fatG: 0.2 },
      { name: "Banana",              amount: "1 medium", calories: 105, proteinG: 1.3,  carbsG: 27.0, fatG: 0.4 },
    ],
    instructions: [
      "Add skim milk to a blender or shaker.",
      "Add whey protein and blend/shake until dissolved.",
      "Add banana and blend until smooth.",
      "Drink immediately after training.",
    ],
    totalMacros: { calories: 301, proteinG: 32.1, carbsG: 41.0, fatG: 2.1 },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

export const GOAL_LABELS: Record<GoalType, string> = {
  cut:      "CUT",
  bulk:     "BULK",
  maintain: "MAINTAIN",
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast:      "Breakfast",
  lunch:          "Lunch",
  dinner:         "Dinner",
  snack:          "Snack",
  "post-workout": "Post-Workout",
  sauce:          "Sauce",
  smoothie:       "Smoothie",
  dessert:        "Dessert",
};

export const GOAL_COLORS: Record<GoalType, { bg: string; text: string; border: string }> = {
  cut:      { bg: "rgba(184,48,48,0.15)",  text: "#E05555", border: "rgba(184,48,48,0.4)"  },
  bulk:     { bg: "rgba(58,125,90,0.15)",  text: "#4DAA7A", border: "rgba(58,125,90,0.4)"  },
  maintain: { bg: "rgba(90,159,212,0.15)", text: "#6AAED6", border: "rgba(90,159,212,0.4)" },
};
