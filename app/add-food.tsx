import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useState, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { P } from "@/constants/colors";
import { CG, OUT_L, OUT } from "@/constants/typography";
import { COMMON_FOODS, CATEGORY_ORDER, CATEGORY_LABELS, type FoodItem } from "@/data/commonFoods";

// ── Macro colours ──────────────────────────────────────────────────────────
const C_PROTEIN = P.gold;
const C_CARBS   = "#5A9FD4";
const C_FAT     = "#E88C35";

type Tab = "recent" | "common" | "my";
type View = "list" | "create";

// ── Helpers ────────────────────────────────────────────────────────────────
function round1(n: number) { return Math.round(n * 10) / 10; }

function scaleMacros(food: FoodItem, grams: number) {
  const scale = grams / food.servingG;
  return {
    calories: Math.round(food.calories * scale),
    proteinG: round1(food.proteinG * scale),
    carbsG:   round1(food.carbsG   * scale),
    fatG:     round1(food.fatG     * scale),
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────
function MacroChip({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <View style={{ alignItems: "center", minWidth: 48 }}>
      <Text style={{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 1.5, color, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontFamily: CG, fontSize: 16, color: P.ink }}>
        {val}g
      </Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function AddFoodScreen() {
  const router = useRouter();
  const { meal = "breakfast", date = "" } = useLocalSearchParams<{ meal: string; date: string }>();
  const { userId } = useCurrentUser();

  // ── Queries / Mutations ──────────────────────────────────────────────────
  const recentRaw   = useQuery(api.nutrition.getRecentFoods,  userId ? { userId } : "skip") ?? [];
  const customFoods = useQuery(api.nutrition.getCustomFoods,  userId ? { userId } : "skip") ?? [];
  const addEntry    = useMutation(api.nutrition.addFoodEntry);
  const saveCustom  = useMutation(api.nutrition.saveCustomFood);
  const deleteCustom = useMutation(api.nutrition.deleteCustomFood);

  // ── UI State ─────────────────────────────────────────────────────────────
  const [tab,        setTab]        = useState<Tab>("common");
  const [view,       setView]       = useState<View>("list");
  const [search,     setSearch]     = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity,   setQuantity]   = useState("100");
  const [saving,     setSaving]     = useState(false);

  // Create form — manual mode
  const [cf, setCf] = useState({
    name: "", saveToLib: true,
    calories: "", proteinG: "", carbsG: "", fatG: "",
  });

  // Create form — build-from-ingredients mode
  type CreateMode = "manual" | "build";
  const [createMode,  setCreateMode]  = useState<CreateMode>("build");
  const [ingredients, setIngredients] = useState<{ food: FoodItem; grams: string }[]>([]);
  const [ingSearch,   setIngSearch]   = useState("");

  // ── Derived food lists ───────────────────────────────────────────────────

  // Convert recent entries → FoodItem shape (treat stored macros as 100g serving)
  const recentItems: FoodItem[] = useMemo(() => recentRaw.map(e => ({
    id:       `recent-${e._id}`,
    name:     e.name,
    serving:  "as logged",
    servingG: 100,
    calories: e.calories,
    proteinG: e.proteinG,
    carbsG:   e.carbsG,
    fatG:     e.fatG,
    category: "other" as const,
  })), [recentRaw]);

  // Convert custom Convex docs → FoodItem shape
  const customItems: FoodItem[] = useMemo(() => customFoods.map(f => ({
    id:       f._id,
    name:     f.name,
    serving:  f.serving,
    servingG: f.servingG,
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG:   f.carbsG,
    fatG:     f.fatG,
    category: "other" as const,
  })), [customFoods]);

  // All pickable foods for ingredient search (must come after customItems)
  const allFoods: FoodItem[] = useMemo(() => [
    ...COMMON_FOODS,
    ...customItems,
  ], [customItems]);

  const ingResults = ingSearch.trim().length >= 1
    ? allFoods.filter(f =>
        f.name.toLowerCase().includes(ingSearch.toLowerCase()) &&
        !ingredients.some(i => i.food.id === f.id)
      ).slice(0, 6)
    : [];

  // Live totals from ingredients
  const ingTotals = useMemo(() => ingredients.reduce(
    (acc, { food, grams }) => {
      const g = Math.max(0, parseFloat(grams) || 0);
      const scale = g / food.servingG;
      return {
        calories: acc.calories + Math.round(food.calories * scale),
        proteinG: acc.proteinG + food.proteinG * scale,
        carbsG:   acc.carbsG   + food.carbsG   * scale,
        fatG:     acc.fatG     + food.fatG     * scale,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  ), [ingredients]);

  const activeList: FoodItem[] = tab === "recent" ? recentItems
    : tab === "my" ? customItems
    : COMMON_FOODS;

  const filtered = search.trim()
    ? activeList.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : activeList;

  // For common tab, group by category when no search
  const grouped: { category: string; items: FoodItem[] }[] = useMemo(() => {
    if (tab !== "common" || search.trim()) return [{ category: "", items: filtered }];
    const map = new Map<string, FoodItem[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const f of filtered) {
      const arr = map.get(f.category);
      if (arr) arr.push(f);
    }
    return CATEGORY_ORDER
      .filter(cat => (map.get(cat)?.length ?? 0) > 0)
      .map(cat => ({ category: CATEGORY_LABELS[cat], items: map.get(cat)! }));
  }, [tab, filtered, search]);

  const selectedFood = activeList.find(f => f.id === selectedId) ?? null;
  const grams = Math.max(1, parseFloat(quantity) || 1);
  const scaled = selectedFood ? scaleMacros(selectedFood, grams) : null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const selectFood = (food: FoodItem) => {
    if (selectedId === food.id) { setSelectedId(null); return; }
    setSelectedId(food.id);
    setQuantity(String(food.servingG)); // default to 1 serving
  };

  const handleAdd = async () => {
    if (!userId || !selectedFood || !scaled) return;
    setSaving(true);
    try {
      await addEntry({
        userId, date,
        mealType: meal as any,
        name:     selectedFood.name,
        ...scaled,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdd = async () => {
    if (!userId || !cf.name.trim()) { Alert.alert("Enter a name"); return; }

    let macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
    let servingG: number;

    if (createMode === "build") {
      if (ingredients.length === 0) { Alert.alert("Add at least one ingredient"); return; }
      macros    = { ...ingTotals, proteinG: round1(ingTotals.proteinG), carbsG: round1(ingTotals.carbsG), fatG: round1(ingTotals.fatG) };
      servingG  = ingredients.reduce((s, { grams }) => s + (parseFloat(grams) || 0), 0);
    } else {
      if (!cf.calories) { Alert.alert("Enter calories"); return; }
      macros    = { calories: parseFloat(cf.calories)||0, proteinG: parseFloat(cf.proteinG)||0, carbsG: parseFloat(cf.carbsG)||0, fatG: parseFloat(cf.fatG)||0 };
      servingG  = 100;
    }

    const totalG = Math.round(servingG);
    setSaving(true);
    try {
      if (cf.saveToLib) {
        await saveCustom({
          userId,
          name:     cf.name.trim(),
          serving:  createMode === "build" ? `1 serving (${totalG}g)` : "100g",
          servingG: createMode === "build" ? totalG : 100,
          ...macros,
        });
      }
      await addEntry({ userId, date, mealType: meal as any, name: cf.name.trim(), ...macros });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCustom = (foodId: string) => {
    Alert.alert("Delete from library?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteCustom({ foodId: foodId as Id<"customFoods"> }) },
    ]);
  };

  // ── Render food row ───────────────────────────────────────────────────────
  const renderFood = (food: FoodItem) => {
    const isSelected = selectedId === food.id;
    return (
      <View key={food.id}>
        <TouchableOpacity
          style={[s.foodRow, isSelected && s.foodRowSelected]}
          onPress={() => selectFood(food)}
          activeOpacity={0.75}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.foodName}>{food.name}</Text>
            <Text style={s.foodServing}>{food.serving}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 3 }}>
            <Text style={s.foodCals}>{food.calories} kcal</Text>
            <Text style={s.foodMacroSmall}>
              P{food.proteinG} · C{food.carbsG} · F{food.fatG}
            </Text>
          </View>
          {tab === "my" && (
            <TouchableOpacity
              onPress={() => confirmDeleteCustom(food.id)}
              hitSlop={12}
              style={{ paddingLeft: 12 }}
            >
              <Text style={{ fontFamily: OUT_L, fontSize: 16, color: P.red }}>×</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* ── Quantity expander ─────────────────────────────────────────── */}
        {isSelected && (
          <Animated.View entering={FadeIn.duration(180)} style={s.expander}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Text style={[s.label, { flex: 1 }]}>QUANTITY (g)</Text>
              <TextInput
                style={s.qtyInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>

            {scaled && (
              <View style={s.scaledRow}>
                <View style={{ alignItems: "center" }}>
                  <Text style={[s.label, { marginBottom: 2 }]}>KCAL</Text>
                  <Text style={{ fontFamily: CG, fontSize: 26, color: P.gold }}>{scaled.calories}</Text>
                </View>
                <MacroChip label="PRO" val={scaled.proteinG} color={C_PROTEIN} />
                <MacroChip label="CARBS" val={scaled.carbsG} color={C_CARBS} />
                <MacroChip label="FAT" val={scaled.fatG} color={C_FAT} />
              </View>
            )}

            <TouchableOpacity
              style={[s.addBtn, saving && { opacity: 0.5 }]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={P.gold} />
                : <Text style={s.addBtnText}>ADD TO {meal.toUpperCase()}</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.closeBtn}>×</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>ADD TO {meal.toUpperCase()}</Text>
          <TouchableOpacity
            onPress={() => { setView(v => v === "list" ? "create" : "list"); setSelectedId(null); }}
            style={[s.createToggle, view === "create" && s.createToggleActive]}
          >
            <Text style={[s.createToggleText, view === "create" && { color: P.gold }]}>
              {view === "create" ? "← BACK" : "+ CREATE"}
            </Text>
          </TouchableOpacity>
        </View>

        {view === "list" ? (
          <>
            {/* ── Search ────────────────────────────────────────────────── */}
            <View style={s.searchWrap}>
              <Text style={s.searchIcon}>⊙</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Search foods..."
                placeholderTextColor={P.dim}
                value={search}
                onChangeText={v => { setSearch(v); setSelectedId(null); }}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Text style={{ fontFamily: OUT_L, fontSize: 16, color: P.mid }}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <View style={s.tabRow}>
              {(["recent", "common", "my"] as Tab[]).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => { setTab(t); setSelectedId(null); setSearch(""); }}
                  style={[s.tab, tab === t && s.tabActive]}
                >
                  <Text style={[s.tabText, tab === t && { color: P.gold }]}>
                    {t === "recent" ? "RECENT" : t === "common" ? "LIBRARY" : "MY FOODS"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Food list ─────────────────────────────────────────────── */}
            <ScrollView
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {tab === "recent" && recentItems.length === 0 && (
                <Animated.View entering={FadeInDown.springify()} style={s.emptyState}>
                  <Text style={s.emptyTitle}>No recent foods yet</Text>
                  <Text style={s.emptyDesc}>Foods you log will appear here for quick re-use.</Text>
                </Animated.View>
              )}

              {tab === "my" && customItems.length === 0 && (
                <Animated.View entering={FadeInDown.springify()} style={s.emptyState}>
                  <Text style={s.emptyTitle}>No saved foods yet</Text>
                  <Text style={s.emptyDesc}>
                    Tap <Text style={{ color: P.gold }}>+ CREATE</Text> to build your own food library.
                  </Text>
                </Animated.View>
              )}

              {/* Grouped for common / flat for others */}
              {grouped.map(group => (
                <View key={group.category}>
                  {group.category !== "" && (
                    <Text style={s.groupLabel}>{group.category}</Text>
                  )}
                  {group.items.map(renderFood)}
                </View>
              ))}

              <View style={{ height: 80 }} />
            </ScrollView>
          </>
        ) : (
          /* ── Create Food Form ─────────────────────────────────────────── */
          <ScrollView
            contentContainerStyle={s.createScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeInDown.springify()}>

              {/* Mode toggle */}
              <View style={s.modeRow}>
                {(["build", "manual"] as CreateMode[]).map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setCreateMode(m)}
                    style={[s.modeBtn, createMode === m && s.modeBtnActive]}
                  >
                    <Text style={[s.modeBtnText, createMode === m && { color: P.gold }]}>
                      {m === "build" ? "BUILD FROM INGREDIENTS" : "MANUAL ENTRY"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Name */}
              <Text style={[s.label, { marginBottom: 6 }]}>MEAL / FOOD NAME</Text>
              <TextInput
                style={s.input}
                placeholder={createMode === "build" ? "e.g. Chicken Bowl" : "e.g. Protein Shake"}
                placeholderTextColor={P.dim}
                value={cf.name}
                onChangeText={v => setCf(f => ({ ...f, name: v }))}
                autoCapitalize="words"
              />

              {createMode === "build" ? (
                /* ── Ingredient builder ───────────────────────────────── */
                <>
                  <Text style={[s.label, { marginBottom: 8 }]}>INGREDIENTS</Text>

                  {/* Ingredient list */}
                  {ingredients.map((ing, idx) => {
                    const g     = Math.max(0, parseFloat(ing.grams) || 0);
                    const scale = g / ing.food.servingG;
                    const cals  = Math.round(ing.food.calories * scale);
                    return (
                      <View key={ing.food.id} style={s.ingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.ingName}>{ing.food.name}</Text>
                          <Text style={s.ingMacros}>
                            {cals} kcal · P{round1(ing.food.proteinG * scale)}
                            g · C{round1(ing.food.carbsG * scale)}g · F{round1(ing.food.fatG * scale)}g
                          </Text>
                        </View>
                        <TextInput
                          style={s.ingGramsInput}
                          value={ing.grams}
                          onChangeText={v => setIngredients(prev =>
                            prev.map((x, i) => i === idx ? { ...x, grams: v } : x)
                          )}
                          keyboardType="numeric"
                          selectTextOnFocus
                        />
                        <Text style={s.ingUnit}>g</Text>
                        <TouchableOpacity
                          onPress={() => setIngredients(prev => prev.filter((_, i) => i !== idx))}
                          hitSlop={10}
                          style={{ paddingLeft: 8 }}
                        >
                          <Text style={{ fontFamily: OUT_L, fontSize: 18, color: P.red, lineHeight: 20 }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  {/* Ingredient search */}
                  <View style={s.ingSearchWrap}>
                    <Text style={s.searchIcon}>⊕</Text>
                    <TextInput
                      style={s.ingSearchInput}
                      placeholder="Add ingredient…"
                      placeholderTextColor={P.dim}
                      value={ingSearch}
                      onChangeText={setIngSearch}
                      autoCorrect={false}
                    />
                    {ingSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setIngSearch("")} hitSlop={8}>
                        <Text style={{ fontFamily: OUT_L, fontSize: 16, color: P.mid }}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Search results */}
                  {ingResults.map(food => (
                    <TouchableOpacity
                      key={food.id}
                      style={s.ingResult}
                      onPress={() => {
                        setIngredients(prev => [...prev, { food, grams: String(food.servingG) }]);
                        setIngSearch("");
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.ingResultName}>{food.name}</Text>
                        <Text style={s.ingResultServing}>{food.serving}</Text>
                      </View>
                      <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.gold, letterSpacing: 1 }}>
                        + ADD
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* Live totals */}
                  {ingredients.length > 0 && (
                    <Animated.View entering={FadeIn.duration(200)} style={s.totalsCard}>
                      <Text style={[s.label, { marginBottom: 10 }]}>TOTAL MACROS</Text>
                      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                        <View style={{ alignItems: "center" }}>
                          <Text style={[s.label, { marginBottom: 3 }]}>KCAL</Text>
                          <Text style={{ fontFamily: CG, fontSize: 28, color: P.gold }}>{ingTotals.calories}</Text>
                        </View>
                        <MacroChip label="PROTEIN" val={round1(ingTotals.proteinG)} color={C_PROTEIN} />
                        <MacroChip label="CARBS"   val={round1(ingTotals.carbsG)}   color={C_CARBS} />
                        <MacroChip label="FAT"     val={round1(ingTotals.fatG)}     color={C_FAT} />
                      </View>
                    </Animated.View>
                  )}
                </>
              ) : (
                /* ── Manual entry ─────────────────────────────────────── */
                <View style={s.macroGrid}>
                  {[
                    { key: "calories", label: "CALORIES", color: P.gold,    unit: "kcal" },
                    { key: "proteinG", label: "PROTEIN",  color: C_PROTEIN, unit: "g" },
                    { key: "carbsG",   label: "CARBS",    color: C_CARBS,   unit: "g" },
                    { key: "fatG",     label: "FAT",      color: C_FAT,     unit: "g" },
                  ].map(({ key, label, color, unit }) => (
                    <View key={key} style={s.macroCell}>
                      <Text style={[s.label, { color, marginBottom: 6 }]}>{label}</Text>
                      <View style={s.macroInputWrap}>
                        <TextInput
                          style={[s.input, { flex: 1, marginBottom: 0 }]}
                          placeholder="0"
                          placeholderTextColor={P.dim}
                          keyboardType="numeric"
                          value={cf[key as keyof typeof cf] as string}
                          onChangeText={v => setCf(f => ({ ...f, [key]: v }))}
                        />
                        <Text style={s.unit}>{unit}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Save to library toggle */}
              <View style={[s.toggleRow, { marginTop: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitle}>Save to My Foods</Text>
                  <Text style={s.toggleDesc}>Reuse this in future logs</Text>
                </View>
                <Switch
                  value={cf.saveToLib}
                  onValueChange={v => setCf(f => ({ ...f, saveToLib: v }))}
                  trackColor={{ false: P.border, true: P.gold + "60" }}
                  thumbColor={cf.saveToLib ? P.gold : P.mid}
                />
              </View>

              <TouchableOpacity
                style={[s.addBtn, { marginTop: 8 }, saving && { opacity: 0.5 }]}
                onPress={handleCreateAdd}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={P.gold} />
                  : <Text style={s.addBtnText}>ADD TO {meal.toUpperCase()}</Text>
                }
              </TouchableOpacity>

              <View style={{ height: 100 }} />
            </Animated.View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  closeBtn:          { fontFamily: OUT_L, fontSize: 24, color: P.mid, marginRight: 16, lineHeight: 26 },
  headerTitle:       { flex: 1, fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: P.ink },
  createToggle:      { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  createToggleActive:{ borderColor: P.gold },
  createToggleText:  { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },

  searchWrap:        { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 4, backgroundColor: P.s1 },
  searchIcon:        { fontFamily: OUT_L, fontSize: 14, color: P.dim },
  searchInput:       { flex: 1, fontFamily: OUT_L, fontSize: 14, color: P.ink, paddingVertical: 12 },

  tabRow:            { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tab:               { flex: 1, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.border, alignItems: "center" },
  tabActive:         { borderBottomColor: P.gold },
  tabText:           { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: P.dim },

  list:              { paddingHorizontal: 16, paddingTop: 8 },
  groupLabel:        { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: P.mid, marginTop: 20, marginBottom: 8 },

  foodRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  foodRowSelected:   { backgroundColor: P.goldDim },
  foodName:          { fontFamily: OUT, fontSize: 14, color: P.ink, marginBottom: 2 },
  foodServing:       { fontFamily: OUT_L, fontSize: 11, color: P.dim },
  foodCals:          { fontFamily: CG, fontSize: 16, color: P.gold },
  foodMacroSmall:    { fontFamily: OUT_L, fontSize: 10, color: P.mid },

  expander:          { backgroundColor: P.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "30", borderRadius: 4, padding: 16, marginBottom: 4 },
  scaledRow:         { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 12, marginBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },

  qtyInput:          { fontFamily: CG, fontSize: 22, color: P.ink, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 8, minWidth: 80, textAlign: "center", backgroundColor: P.bg },

  addBtn:            { height: 52, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, borderRadius: 4, alignItems: "center", justifyContent: "center", marginTop: 4 },
  addBtnText:        { fontFamily: OUT_L, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: P.gold, fontWeight: "700" },

  emptyState:        { alignItems: "center", paddingVertical: 48 },
  emptyTitle:        { fontFamily: OUT_L, fontSize: 14, color: P.mid, marginBottom: 8 },
  emptyDesc:         { fontFamily: OUT_L, fontSize: 12, color: P.dim, textAlign: "center", paddingHorizontal: 32 },

  // Create form
  createScroll:      { paddingHorizontal: 20, paddingTop: 20 },
  label:             { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: P.mid },
  input:             { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: P.ink, fontFamily: OUT_L, marginBottom: 16, backgroundColor: P.bg },
  macroGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  macroCell:         { width: "47%" },
  macroInputWrap:    { flexDirection: "row", alignItems: "center", gap: 8 },
  unit:              { fontFamily: OUT_L, fontSize: 11, color: P.dim, marginBottom: 16 },
  toggleRow:         { flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 4, padding: 16, marginBottom: 16 },
  toggleTitle:       { fontFamily: OUT_L, fontSize: 13, color: P.ink, marginBottom: 2 },
  toggleDesc:        { fontFamily: OUT_L, fontSize: 11, color: P.dim },

  // Mode toggle
  modeRow:           { flexDirection: "row", gap: 8, marginBottom: 20 },
  modeBtn:           { flex: 1, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 4, alignItems: "center" },
  modeBtnActive:     { borderColor: P.gold, backgroundColor: P.goldDim },
  modeBtnText:       { fontFamily: OUT_L, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", color: P.dim },

  // Ingredient builder
  ingRow:            { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  ingName:           { fontFamily: OUT, fontSize: 13, color: P.ink, marginBottom: 2 },
  ingMacros:         { fontFamily: OUT_L, fontSize: 10, color: P.mid },
  ingGramsInput:     { fontFamily: CG, fontSize: 18, color: P.ink, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6, minWidth: 60, textAlign: "center", backgroundColor: P.bg },
  ingUnit:           { fontFamily: OUT_L, fontSize: 11, color: P.dim },
  ingSearchWrap:     { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 4, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "60", borderRadius: 4, backgroundColor: P.s1 },
  ingSearchInput:    { flex: 1, fontFamily: OUT_L, fontSize: 14, color: P.ink, paddingVertical: 12 },
  ingResult:         { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  ingResultName:     { fontFamily: OUT, fontSize: 13, color: P.ink, marginBottom: 1 },
  ingResultServing:  { fontFamily: OUT_L, fontSize: 10, color: P.dim },
  totalsCard:        { borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold + "40", borderRadius: 4, padding: 16, marginTop: 16, backgroundColor: P.goldDim },
});
