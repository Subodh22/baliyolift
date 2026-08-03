import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, Pressable, ActivityIndicator, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { localDateStr } from "@/utils/date";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import {
  GOAL_LABELS, GOAL_COLORS, MEAL_TYPE_LABELS,
  type Recipe, type GoalType, type MealType,
} from "@/data/mealPlans";

// ── Macro colours ──────────────────────────────────────────────────────────
const C_PROTEIN = P.gold;
const C_CARBS   = "#5A9FD4";
const C_FAT     = "#E88C35";

function round1(n: number) { return Math.round(n * 10) / 10; }

// ── Goal tab definitions ──────────────────────────────────────────────────
type GoalFilter = "all" | GoalType | "mine";
const GOAL_TABS: { key: GoalFilter; label: string }[] = [
  { key: "all",      label: "ALL"      },
  { key: "cut",      label: "CUT"      },
  { key: "bulk",     label: "BULK"     },
  { key: "maintain", label: "MAINTAIN" },
  { key: "mine",     label: "MY MEALS" },
];

// ── Meal type filter chips ─────────────────────────────────────────────────
type MealFilter = "all" | MealType;
const MEAL_CHIPS: { key: MealFilter; label: string }[] = [
  { key: "all",          label: "All"          },
  { key: "breakfast",    label: "Breakfast"    },
  { key: "lunch",        label: "Lunch"        },
  { key: "dinner",       label: "Dinner"       },
  { key: "snack",        label: "Snack"        },
  { key: "post-workout", label: "Post-Workout" },
  { key: "smoothie",     label: "Smoothie"     },
  { key: "sauce",        label: "Sauce"        },
  { key: "dessert",      label: "Dessert"      },
];

// ── Meal type options for logging ─────────────────────────────────────────
const LOG_MEAL_OPTIONS: { key: "breakfast" | "lunch" | "dinner" | "snack"; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch"     },
  { key: "dinner",    label: "Dinner"    },
  { key: "snack",     label: "Snack"     },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function GoalBadge({ goal }: { goal: GoalType }) {
  const c = GOAL_COLORS[goal];
  return (
    <View style={[s.goalBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[s.goalBadgeText, { color: c.text }]}>{GOAL_LABELS[goal]}</Text>
    </View>
  );
}

function MacroPill({ label, value, color, unit = "g" }: { label: string; value: number; color: string; unit?: string }) {
  return (
    <View style={s.macroPill}>
      <Text style={[s.macroPillLabel, { color }]}>{label}</Text>
      <Text style={s.macroPillValue}>{value}{unit}</Text>
    </View>
  );
}

// ── Recipe Card ────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  saved,
  isUserRecipe,
  onPress,
  onToggleStar,
}: {
  recipe: Recipe;
  saved: boolean;
  isUserRecipe: boolean;
  onPress: () => void;
  onToggleStar: () => void;
}) {
  const m = recipe.totalMacros;
  return (
    <Animated.View entering={FadeInDown.springify().damping(20)}>
      <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
        {/* Top row */}
        <View style={s.cardTop}>
          <GoalBadge goal={recipe.goal} />
          <Text style={s.cardMealType}>{MEAL_TYPE_LABELS[recipe.mealType].toUpperCase()}</Text>
          {!isUserRecipe && (
            <TouchableOpacity
              onPress={e => { e.stopPropagation(); onToggleStar(); }}
              hitSlop={12}
              style={s.starBtn}
            >
              <Text style={[s.starIcon, saved && s.starIconActive]}>
                {saved ? "★" : "☆"}
              </Text>
            </TouchableOpacity>
          )}
          {isUserRecipe && <Text style={s.myMealBadge}>MY MEAL</Text>}
        </View>

        {/* Name + description */}
        <Text style={s.cardName}>{recipe.name}</Text>
        <Text style={s.cardDesc} numberOfLines={2}>{recipe.description}</Text>

        {/* Macros */}
        <View style={s.cardMacroRow}>
          <View style={s.cardCals}>
            <Text style={s.cardCalsValue}>{m.calories}</Text>
            <Text style={s.cardCalsLabel}>kcal</Text>
          </View>
          <View style={s.cardMacroPills}>
            <MacroPill label="PRO"  value={round1(m.proteinG)} color={C_PROTEIN} />
            <MacroPill label="CARB" value={round1(m.carbsG)}   color={C_CARBS} />
            <MacroPill label="FAT"  value={round1(m.fatG)}     color={C_FAT} />
          </View>
        </View>

        {/* Footer */}
        <View style={s.cardFooter}>
          <Text style={s.cardTime}>⏱ {recipe.prepTimeMins + recipe.cookTimeMins} min</Text>
          <View style={s.cardTags}>
            {recipe.tags.slice(0, 2).map(tag => (
              <View key={tag} style={s.tag}>
                <Text style={s.tagText}>{tag.replace(/-/g, " ")}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Recipe Detail Modal ────────────────────────────────────────────────────

function RecipeDetail({
  recipe,
  saved,
  isUserRecipe,
  onClose,
  onToggleSave,
  onLog,
  onDelete,
  logging,
}: {
  recipe: Recipe;
  saved: boolean;
  isUserRecipe: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onLog: (mealType: "breakfast" | "lunch" | "dinner" | "snack") => void;
  onDelete: () => void;
  logging: boolean;
}) {
  const [showLogOptions, setShowLogOptions] = useState(false);
  const m = recipe.totalMacros;
  const c = GOAL_COLORS[recipe.goal];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={s.modalHeader}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={s.modalCloseBtn}>
          <Text style={s.modalCloseText}>×</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {isUserRecipe ? (
          <TouchableOpacity onPress={onDelete} hitSlop={12} style={s.saveBtn}>
            <Text style={[s.saveBtnText, { color: P.red }]}>⌫</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onToggleSave} hitSlop={12} style={s.saveBtn}>
            <Text style={[s.saveBtnText, saved && { color: P.gold }]}>
              {saved ? "★" : "☆"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>

        {/* Goal + meal type */}
        <View style={s.modalTopRow}>
          <GoalBadge goal={recipe.goal} />
          <Text style={s.modalMealType}>{MEAL_TYPE_LABELS[recipe.mealType].toUpperCase()}</Text>
          <Text style={s.modalTime}>⏱ {recipe.prepTimeMins + recipe.cookTimeMins} min</Text>
        </View>

        {/* Title */}
        <Text style={s.modalTitle}>{recipe.name}</Text>
        <Text style={s.modalDesc}>{recipe.description}</Text>

        {/* Macro summary */}
        <View style={[s.macroCard, { borderColor: c.border }]}>
          <View style={s.macroCardInner}>
            <View style={s.macroCardItem}>
              <Text style={[s.macroCardBig, { color: P.gold }]}>{m.calories}</Text>
              <Text style={s.macroCardLabel}>KCAL</Text>
            </View>
            <View style={s.macroDivider} />
            <View style={s.macroCardItem}>
              <Text style={[s.macroCardBig, { color: C_PROTEIN }]}>{round1(m.proteinG)}</Text>
              <Text style={s.macroCardLabel}>PROTEIN</Text>
            </View>
            <View style={s.macroDivider} />
            <View style={s.macroCardItem}>
              <Text style={[s.macroCardBig, { color: C_CARBS }]}>{round1(m.carbsG)}</Text>
              <Text style={s.macroCardLabel}>CARBS</Text>
            </View>
            <View style={s.macroDivider} />
            <View style={s.macroCardItem}>
              <Text style={[s.macroCardBig, { color: C_FAT }]}>{round1(m.fatG)}</Text>
              <Text style={s.macroCardLabel}>FAT</Text>
            </View>
          </View>
          <Text style={s.macroCardUnit}>grams per serving</Text>
        </View>

        {/* Tags */}
        <View style={s.tagsRow}>
          {recipe.tags.map(tag => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>{tag.replace(/-/g, " ")}</Text>
            </View>
          ))}
        </View>

        {/* Ingredients */}
        <Text style={s.sectionLabel}>INGREDIENTS</Text>
        <View style={s.ingredientTable}>
          <View style={[s.ingredientRow, s.ingredientHeader]}>
            <Text style={[s.ingCell, s.ingHeaderText, { flex: 2 }]}>ITEM</Text>
            <Text style={[s.ingCell, s.ingHeaderText]}>KCAL</Text>
            <Text style={[s.ingCell, s.ingHeaderText, { color: C_PROTEIN }]}>P</Text>
            <Text style={[s.ingCell, s.ingHeaderText, { color: C_CARBS }]}>C</Text>
            <Text style={[s.ingCell, s.ingHeaderText, { color: C_FAT }]}>F</Text>
          </View>
          {recipe.ingredients.map((ing, idx) => (
            <View key={idx} style={[s.ingredientRow, idx % 2 === 1 && s.ingredientAlt]}>
              <View style={{ flex: 2 }}>
                <Text style={s.ingName}>{ing.name}</Text>
                <Text style={s.ingAmount}>{ing.amount}</Text>
              </View>
              <Text style={[s.ingCell, s.ingValue]}>{ing.calories}</Text>
              <Text style={[s.ingCell, s.ingValue, { color: C_PROTEIN }]}>{round1(ing.proteinG)}</Text>
              <Text style={[s.ingCell, s.ingValue, { color: C_CARBS }]}>{round1(ing.carbsG)}</Text>
              <Text style={[s.ingCell, s.ingValue, { color: C_FAT }]}>{round1(ing.fatG)}</Text>
            </View>
          ))}
          <View style={[s.ingredientRow, s.ingredientTotal]}>
            <Text style={[{ flex: 2 }, s.ingTotalLabel]}>TOTAL</Text>
            <Text style={[s.ingCell, s.ingTotalValue]}>{m.calories}</Text>
            <Text style={[s.ingCell, s.ingTotalValue, { color: C_PROTEIN }]}>{round1(m.proteinG)}</Text>
            <Text style={[s.ingCell, s.ingTotalValue, { color: C_CARBS }]}>{round1(m.carbsG)}</Text>
            <Text style={[s.ingCell, s.ingTotalValue, { color: C_FAT }]}>{round1(m.fatG)}</Text>
          </View>
        </View>

        {/* Instructions */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>METHOD</Text>
        <View style={s.instructionList}>
          {recipe.instructions.map((step, idx) => (
            <View key={idx} style={s.instructionRow}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{idx + 1}</Text>
              </View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Log meal section */}
        {showLogOptions ? (
          <Animated.View entering={FadeIn.duration(180)} style={s.logOptions}>
            <Text style={s.logOptionsTitle}>ADD TO WHICH MEAL?</Text>
            <View style={s.logBtnGrid}>
              {LOG_MEAL_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.logOptionBtn, logging && { opacity: 0.5 }]}
                  onPress={() => onLog(opt.key)}
                  disabled={logging}
                >
                  {logging
                    ? <ActivityIndicator color={P.gold} size="small" />
                    : <Text style={s.logOptionText}>{opt.label.toUpperCase()}</Text>
                  }
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowLogOptions(false)} style={s.logCancelBtn}>
              <Text style={s.logCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={s.logBtn}
            onPress={() => setShowLogOptions(true)}
          >
            <Text style={s.logBtnText}>LOG THIS MEAL</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function MealPlansScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();

  const savedIds      = useQuery(api.mealPlans.getSaved,        userId ? { userId } : "skip") ?? [];
  const convexRecipes = useQuery(api.mealPlans.listRecipes)     ?? [];
  const userRecipesRaw = useQuery(api.userRecipes.getUserRecipes, userId ? { userId } : "skip") ?? [];
  const saveRecipe    = useMutation(api.mealPlans.save);
  const unsaveRecipe  = useMutation(api.mealPlans.unsave);
  const addEntry      = useMutation(api.nutrition.addFoodEntry);
  const deleteUserRecipe = useMutation(api.userRecipes.deleteUserRecipe);

  const [goalFilter, setGoalFilter] = useState<GoalFilter>("all");
  const [mealFilter, setMealFilter] = useState<MealFilter>("all");
  const [selected,   setSelected]   = useState<Recipe | null>(null);
  const [logging,    setLogging]     = useState(false);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  const globalRecipes = useMemo<Recipe[]>(() =>
    convexRecipes.map(r => ({
      id:           r.recipeId,
      name:         r.name,
      description:  r.description,
      goal:         r.goal,
      mealType:     r.mealType as MealType,
      prepTimeMins: r.prepTimeMins,
      cookTimeMins: r.cookTimeMins,
      tags:         r.tags,
      ingredients:  r.ingredients.map(i => ({
        name:     i.name,
        amount:   i.amount,
        calories: i.calories ?? 0,
        proteinG: i.proteinG ?? 0,
        carbsG:   i.carbsG ?? 0,
        fatG:     i.fatG ?? 0,
      })),
      instructions: r.instructions,
      totalMacros:  r.totalMacros,
    })),
  [convexRecipes]);

  const userRecipes = useMemo<Recipe[]>(() =>
    userRecipesRaw.map(r => ({
      id:           `user:${r._id}`,
      name:         r.name,
      description:  r.description,
      goal:         r.goal,
      mealType:     r.mealType as MealType,
      prepTimeMins: r.prepTimeMins,
      cookTimeMins: r.cookTimeMins,
      tags:         r.tags,
      ingredients:  r.ingredients,
      instructions: r.instructions,
      totalMacros:  r.totalMacros,
    })),
  [userRecipesRaw]);

  const filtered = useMemo(() => {
    if (goalFilter === "mine") {
      const starred = globalRecipes.filter(r => savedSet.has(r.id));
      return [...userRecipes, ...starred];
    }
    return globalRecipes.filter(r => {
      if (goalFilter !== "all" && r.goal !== goalFilter) return false;
      if (mealFilter !== "all" && r.mealType !== mealFilter) return false;
      return true;
    });
  }, [globalRecipes, userRecipes, savedSet, goalFilter, mealFilter]);

  const handleDeleteUserMeal = (recipe: Recipe) => {
    if (!userId) return;
    Alert.alert("Delete meal?", recipe.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const docId = recipe.id.replace("user:", "") as Id<"userRecipes">;
          await deleteUserRecipe({ userId, recipeDocId: docId });
          setSelected(null);
        },
      },
    ]);
  };

  const handleToggleSave = async () => {
    if (!userId || !selected) return;
    if (savedSet.has(selected.id)) {
      await unsaveRecipe({ userId, recipeId: selected.id });
    } else {
      await saveRecipe({ userId, recipeId: selected.id });
    }
  };

  const handleLog = async (mealType: "breakfast" | "lunch" | "dinner" | "snack") => {
    if (!userId || !selected) return;
    setLogging(true);
    // Local day key — must match Fuel's getDayEntries, which keys by local date.
    // Using UTC here (toISOString) stamped entries on the wrong day in +/- UTC
    // timezones, so logged food never appeared on today's Fuel view.
    const today = localDateStr();
    try {
      await addEntry({
        userId,
        date: today,
        mealType,
        name:     selected.name,
        calories: selected.totalMacros.calories,
        proteinG: selected.totalMacros.proteinG,
        carbsG:   selected.totalMacros.carbsG,
        fatG:     selected.totalMacros.fatG,
      });
      setSelected(null);
    } finally {
      setLogging(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Text style={s.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>NUTRITION</Text>
            <Text style={s.heroItalic}>Meal Plans.</Text>
          </View>
          {goalFilter === "mine" ? (
            <TouchableOpacity
              style={s.plannerBtn}
              onPress={() => router.push("/create-meal")}
            >
              <Text style={s.plannerBtnText}>+ CREATE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.plannerBtn}
              onPress={() => router.push("/meal-planner")}
            >
              <Text style={s.plannerBtnText}>WEEK PLAN</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sticky filters ──────────────────────────────────────────── */}
        <View style={s.filtersWrap}>
          {/* Goal tabs */}
          <View style={s.goalTabs}>
            {GOAL_TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[s.goalTab, goalFilter === tab.key && s.goalTabActive]}
                onPress={() => setGoalFilter(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.goalTabText, goalFilter === tab.key && s.goalTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Meal type chips — hidden on MY MEALS tab */}
          {goalFilter !== "mine" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}
            >
              {MEAL_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip.key}
                  style={[s.chip, mealFilter === chip.key && s.chipActive]}
                  onPress={() => setMealFilter(chip.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, mealFilter === chip.key && s.chipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Recipe list ──────────────────────────────────────────────── */}
        <View style={s.listWrap}>
          {filtered.length === 0 ? (
            goalFilter === "mine" ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No meals in your routine.</Text>
                <Text style={s.emptySubtext}>Tap ☆ on any recipe to star it, or create your own.</Text>
                <TouchableOpacity style={s.emptyCreateBtn} onPress={() => router.push("/create-meal")}>
                  <Text style={s.emptyCreateBtnText}>+ CREATE MEAL</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.empty}>
                <Text style={s.emptyText}>No recipes match these filters.</Text>
              </View>
            )
          ) : (
            filtered.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                saved={savedSet.has(recipe.id)}
                isUserRecipe={recipe.id.startsWith("user:")}
                onPress={() => setSelected(recipe)}
                onToggleStar={() => {
                  if (!userId) return;
                  if (savedSet.has(recipe.id)) {
                    unsaveRecipe({ userId, recipeId: recipe.id });
                  } else {
                    saveRecipe({ userId, recipeId: recipe.id });
                  }
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Recipe Detail Modal ──────────────────────────────────────────── */}
      <Modal
        visible={selected !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <RecipeDetail
            recipe={selected}
            saved={savedSet.has(selected.id)}
            isUserRecipe={selected.id.startsWith("user:")}
            onClose={() => setSelected(null)}
            onToggleSave={handleToggleSave}
            onLog={handleLog}
            onDelete={() => handleDeleteUserMeal(selected)}
            logging={logging}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll:       { paddingBottom: 100 },

  // Header
  header:       { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, gap: 12 },
  backBtn:      { marginBottom: 6 },
  backBtnText:  { fontFamily: OUT_L, fontSize: 22, color: P.mid, lineHeight: 28 },
  eyebrow:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:   { fontFamily: CG_ITALIC, fontSize: 48, letterSpacing: -0.5, lineHeight: 54, color: P.ink },
  plannerBtn:   { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-end", marginBottom: 6 },
  plannerBtnText: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.gold, textTransform: "uppercase" },

  // Sticky filters
  filtersWrap:  { backgroundColor: P.bg, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  goalTabs:     { flexDirection: "row", paddingHorizontal: 20, gap: 6, marginBottom: 10, marginTop: 4 },
  goalTab:      { flex: 1, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center" },
  goalTabActive:{ borderColor: P.gold, backgroundColor: P.goldDim },
  goalTabText:  { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  goalTabTextActive: { color: P.gold },
  chipsRow:     { paddingHorizontal: 20, gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 20 },
  chipActive:   { borderColor: P.gold, backgroundColor: P.goldDim },
  chipText:     { fontFamily: OUT_L, fontSize: 11, color: P.mid },
  chipTextActive: { color: P.gold },

  // Recipe list
  listWrap:       { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  empty:          { paddingVertical: 60, alignItems: "center", gap: 10 },
  emptyText:      { fontFamily: OUT_L, fontSize: 14, color: P.mid },
  emptyTitle:     { fontFamily: CG, fontSize: 22, color: P.ink, letterSpacing: -0.3 },
  emptySubtext:   { fontFamily: OUT_L, fontSize: 13, color: P.mid },
  emptyCreateBtn: { marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, paddingHorizontal: 24, paddingVertical: 12 },
  emptyCreateBtnText: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.gold, textTransform: "uppercase" },

  // Recipe card
  card:         { backgroundColor: P.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 18, gap: 10 },
  cardTop:      { flexDirection: "row", alignItems: "center", gap: 8 },
  cardMealType: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
  starBtn:      { marginLeft: "auto", padding: 2 },
  starIcon:     { fontSize: 18, color: P.dim },
  starIconActive: { color: P.gold },
  myMealBadge:  { marginLeft: "auto", fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, color: P.gold, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, paddingHorizontal: 6, paddingVertical: 2 },
  cardName:     { fontFamily: CG, fontSize: 22, color: P.ink, letterSpacing: -0.3 },
  cardDesc:     { fontFamily: OUT_L, fontSize: 12, color: P.mid, lineHeight: 18 },
  cardMacroRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 },
  cardCals:     { alignItems: "center" },
  cardCalsValue:{ fontFamily: CG, fontSize: 32, color: P.gold, lineHeight: 36 },
  cardCalsLabel:{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim, textTransform: "uppercase" },
  cardMacroPills:{ flexDirection: "row", gap: 8, flexWrap: "wrap" },
  macroPill:    { backgroundColor: P.s2, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 5, gap: 2, alignItems: "center" },
  macroPillLabel: { fontFamily: OUT_L, fontSize: 8, letterSpacing: 1.5, color: P.mid, textTransform: "uppercase" },
  macroPillValue: { fontFamily: CG, fontSize: 14, color: P.ink },
  cardFooter:   { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border, paddingTop: 10, gap: 10 },
  cardTime:     { fontFamily: OUT_L, fontSize: 11, color: P.mid },
  cardTags:     { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 },

  // Goal badge
  goalBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth },
  goalBadgeText:{ fontFamily: OUT_L, fontSize: 8, letterSpacing: 2, textTransform: "uppercase" },

  // Tag chip
  tag:          { backgroundColor: P.s2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  tagText:      { fontFamily: OUT_L, fontSize: 9, letterSpacing: 1, color: P.dim, textTransform: "uppercase" },

  // Modal
  modalHeader:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  modalCloseBtn:{ paddingRight: 12 },
  modalCloseText: { fontFamily: OUT_L, fontSize: 26, color: P.mid, lineHeight: 28 },
  saveBtn:      { padding: 4 },
  saveBtnText:  { fontFamily: OUT_L, fontSize: 24, color: P.mid, lineHeight: 28 },
  modalScroll:  { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 60 },
  modalTopRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  modalMealType:{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid },
  modalTime:    { fontFamily: OUT_L, fontSize: 11, color: P.dim, marginLeft: "auto" },
  modalTitle:   { fontFamily: CG_ITALIC, fontSize: 36, color: P.ink, letterSpacing: -0.3, lineHeight: 42, marginBottom: 10 },
  modalDesc:    { fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20, marginBottom: 20 },

  // Macro card
  macroCard:    { borderWidth: StyleSheet.hairlineWidth, backgroundColor: P.s1, padding: 20, marginBottom: 16 },
  macroCardInner: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  macroCardItem:{ alignItems: "center", flex: 1 },
  macroCardBig: { fontFamily: CG, fontSize: 32, lineHeight: 38 },
  macroCardLabel: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, textTransform: "uppercase", marginTop: 2 },
  macroCardUnit:{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim, textTransform: "uppercase", textAlign: "center", marginTop: 12 },
  macroDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: P.border },
  tagsRow:      { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 24 },

  // Section label
  sectionLabel: { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, textTransform: "uppercase", marginBottom: 12 },

  // Ingredient table
  ingredientTable: { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, marginBottom: 4 },
  ingredientHeader:{ backgroundColor: P.s2 },
  ingredientRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  ingredientAlt:   { backgroundColor: P.s1 },
  ingredientTotal: { backgroundColor: P.s2, borderBottomWidth: 0 },
  ingHeaderText:   { fontFamily: OUT_L, fontSize: 9, letterSpacing: 1.5, color: P.mid, textTransform: "uppercase" },
  ingCell:         { width: 42, textAlign: "right" },
  ingName:         { fontFamily: OUT, fontSize: 13, color: P.ink, marginBottom: 1 },
  ingAmount:       { fontFamily: OUT_L, fontSize: 11, color: P.dim },
  ingValue:        { fontFamily: CG, fontSize: 14, color: P.ink },
  ingTotalLabel:   { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  ingTotalValue:   { fontFamily: OUT_L, fontSize: 12, color: P.ink, width: 42, textAlign: "right" },

  // Instructions
  instructionList: { gap: 12 },
  instructionRow:  { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  stepNum:         { width: 24, height: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText:     { fontFamily: CG, fontSize: 13, color: P.gold },
  stepText:        { flex: 1, fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20 },

  // Log meal button
  logBtn:          { height: 56, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center", justifyContent: "center", marginTop: 32 },
  logBtnText:      { fontFamily: OUT_L, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: P.gold },
  logOptions:      { marginTop: 32, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "40", backgroundColor: P.goldDim, padding: 20, gap: 12 },
  logOptionsTitle: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.gold, textTransform: "uppercase", textAlign: "center" },
  logBtnGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  logOptionBtn:    { flex: 1, minWidth: "45%", height: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, alignItems: "center", justifyContent: "center" },
  logOptionText:   { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.gold },
  logCancelBtn:    { alignItems: "center", paddingVertical: 8 },
  logCancelText:   { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
});
