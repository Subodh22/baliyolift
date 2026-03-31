import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInRight, FadeIn } from "react-native-reanimated";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { P } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";

// ── Types ───────────────────────────────────────────────────���────────────────

type GoalType = "cut" | "bulk" | "maintain";

type Prefs = {
  proteinSources:      string[];
  carbSources:         string[];
  fatSources:          string[];
  excludedIngredients: string[];
  plannedMealTypes:    string[];
  varietyLevel:        number;
};

// ── Goal-based defaults ─────────────────────���────────────────────────────────

const DEFAULTS_BY_GOAL: Record<GoalType, Prefs> = {
  cut: {
    proteinSources:      ["chicken", "eggs", "fish"],
    carbSources:         ["rice", "oats"],
    fatSources:          ["oliveOil"],
    excludedIngredients: [],
    plannedMealTypes:    ["breakfast", "lunch", "dinner", "snack"],
    varietyLevel:        2,
  },
  bulk: {
    proteinSources:      ["chicken", "beef", "eggs"],
    carbSources:         ["rice", "pasta", "oats"],
    fatSources:          ["oliveOil", "nuts", "dairy"],
    excludedIngredients: [],
    plannedMealTypes:    ["breakfast", "lunch", "dinner", "snack"],
    varietyLevel:        2,
  },
  maintain: {
    proteinSources:      ["chicken", "eggs", "fish"],
    carbSources:         ["rice", "potato", "oats"],
    fatSources:          ["oliveOil", "avocado"],
    excludedIngredients: [],
    plannedMealTypes:    ["breakfast", "lunch", "dinner", "snack"],
    varietyLevel:        2,
  },
};

// ── Option definitions ─────────────────────���────────────────────────────��─────

const PROTEIN_OPTIONS = [
  { key: "chicken",  label: "Chicken" },
  { key: "beef",     label: "Beef" },
  { key: "fish",     label: "Fish / Tuna" },
  { key: "eggs",     label: "Eggs" },
  { key: "turkey",   label: "Turkey" },
  { key: "plant",    label: "Plant-based" },
];

const CARB_OPTIONS = [
  { key: "rice",        label: "Rice" },
  { key: "oats",        label: "Oats" },
  { key: "pasta",       label: "Pasta" },
  { key: "potato",      label: "Potato" },
  { key: "sweetPotato", label: "Sweet Potato" },
  { key: "bread",       label: "Bread / Wrap" },
];

const FAT_OPTIONS = [
  { key: "oliveOil", label: "Olive Oil" },
  { key: "avocado",  label: "Avocado" },
  { key: "nuts",     label: "Nuts / PB" },
  { key: "dairy",    label: "Dairy" },
];

const EXCLUDE_OPTIONS = [
  { key: "dairy",     label: "Dairy" },
  { key: "gluten",    label: "Gluten" },
  { key: "red meat",  label: "Red Meat" },
  { key: "fish",      label: "Fish" },
  { key: "pork",      label: "Pork" },
  { key: "egg",       label: "Eggs" },
];

const MEAL_TYPE_OPTIONS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch" },
  { key: "dinner",    label: "Dinner" },
  { key: "snack",     label: "Snacks" },
];

const VARIETY_OPTIONS = [
  { value: 1, label: "REPEAT",   note: "Reuse meals across the week" },
  { value: 2, label: "BALANCED", note: "Mix of familiar and new" },
  { value: 3, label: "VARIETY",  note: "Different meal every day" },
];

// ── Chip component ─────────────────��──────────────────────────────────���───────

function ChipGrid({
  options,
  selected,
  onChange,
}: {
  options: { key: string; label: string }[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const toggle = (key: string) => {
    onChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
    );
  };
  return (
    <View style={ch.grid}>
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => toggle(opt.key)}
            activeOpacity={0.75}
            style={[ch.chip, active && ch.chipActive]}
          >
            <Text style={[ch.chipText, active && ch.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const ch = StyleSheet.create({
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border },
  chipActive:   { borderColor: P.gold, backgroundColor: P.goldDim },
  chipText:     { fontFamily: OUT_L, fontSize: 13, color: P.mid },
  chipTextActive:{ fontFamily: OUT_L, fontSize: 13, color: P.gold },
});

// ── Progress bar ────────────────────────���─────────────────────────────��───────

const STEP_COUNT = 4; // steps 0–3

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 4, marginBottom: 32 }}>
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
        <View
          key={i}
          style={[
            pb.seg,
            { flex: 1 },
            i < step && pb.done,
            i === step && pb.active,
          ]}
        />
      ))}
    </View>
  );
}
const pb = StyleSheet.create({
  seg:    { height: 2, backgroundColor: P.s3 },
  done:   { backgroundColor: P.gold + "60" },
  active: { backgroundColor: P.gold },
});

// ── Main screen ────────────────────────────��────────────────────────────���─────

export default function FoodPreferencesOnboarding() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const targets   = useQuery(api.nutrition.getFoodTarget, userId ? { userId } : "skip");
  const existing  = useQuery(api.foodPreferences.get,    userId ? { userId } : "skip");
  const savePrefs = useMutation(api.foodPreferences.save);

  // -1 = intro, 0–3 = steps
  const [step, setStep] = useState(-1);
  const [saving, setSaving] = useState(false);

  const goal: GoalType = (targets?.goal as GoalType) ?? "maintain";
  const defaults = DEFAULTS_BY_GOAL[goal];

  const [proteinSources,      setProteinSources]      = useState<string[]>(existing?.proteinSources      ?? defaults.proteinSources);
  const [carbSources,         setCarbSources]         = useState<string[]>(existing?.carbSources         ?? defaults.carbSources);
  const [fatSources,          setFatSources]          = useState<string[]>(existing?.fatSources          ?? defaults.fatSources);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>(existing?.excludedIngredients ?? []);
  const [plannedMealTypes,    setPlannedMealTypes]    = useState<string[]>(existing?.plannedMealTypes    ?? defaults.plannedMealTypes);
  const [varietyLevel,        setVarietyLevel]        = useState<number>(  existing?.varietyLevel        ?? 2);

  const handleSave = async (prefs: Prefs) => {
    if (!userId) return;
    setSaving(true);
    try {
      await savePrefs({ userId, ...prefs });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleSelectForMe = () => handleSave(defaults);

  const handleDone = () =>
    handleSave({ proteinSources, carbSources, fatSources, excludedIngredients, plannedMealTypes, varietyLevel });

  const next = () => setStep((s) => s + 1);
  const back = () => {
    if (step === -1) router.back();
    else if (step === 0) setStep(-1);
    else setStep((s) => s - 1);
  };

  const canContinue = () => {
    if (step === 0) return proteinSources.length > 0;
    if (step === 1) return carbSources.length > 0;
    if (step === 2) return fatSources.length > 0;
    return true;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={back} hitSlop={12}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>NUTRITION</Text>
            <Text style={s.heroItalic}>Meal Preferences.</Text>
          </View>
        </View>

        <Animated.View key={step} entering={FadeInRight.springify().damping(22)}>

          {/* ── INTRO (step -1) ──────────────────────────────────────────── */}
          {step === -1 && (
            <View style={s.introWrap}>
              <Text style={s.introTitle}>Let's personalise your plan.</Text>
              <Text style={s.introBody}>
                Tell us what you like to eat and we'll auto-fill your week with matching recipes — then build your grocery list automatically.
              </Text>

              {/* SELECT FOR ME */}
              <TouchableOpacity
                style={[s.bigBtn, s.bigBtnGold, saving && { opacity: 0.5 }]}
                onPress={handleSelectForMe}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={P.gold} />
                ) : (
                  <>
                    <Text style={s.bigBtnGoldText}>SELECT FOR ME</Text>
                    <Text style={s.bigBtnNote}>
                      Based on your {goal.toUpperCase()} goal — picks sensible defaults instantly
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* CUSTOMISE */}
              <TouchableOpacity
                style={s.bigBtn}
                onPress={() => setStep(0)}
                activeOpacity={0.85}
              >
                <Text style={s.bigBtnText}>I'LL CHOOSE</Text>
                <Text style={s.bigBtnNote}>4 quick steps — tweak to your taste</Text>
              </TouchableOpacity>

              {/* Goal indicator */}
              <View style={s.goalBadgeRow}>
                <Text style={s.goalBadgeLabel}>YOUR GOAL</Text>
                <View style={[s.goalBadge, goalColor(goal)]}>
                  <Text style={[s.goalBadgeText, { color: goalTextColor(goal) }]}>{goal.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── STEP 0: Protein ──────────────────────────────────────────── */}
          {step === 0 && (
            <View style={s.stepWrap}>
              <ProgressBar step={0} />
              <Text style={s.stepEyebrow}>STEP 1 OF 4</Text>
              <Text style={s.stepTitle}>Protein Sources</Text>
              <Text style={s.stepBody}>Which proteins do you regularly eat? Select all that apply.</Text>
              <ChipGrid options={PROTEIN_OPTIONS} selected={proteinSources} onChange={setProteinSources} />
              <TouchableOpacity onPress={() => setProteinSources(PROTEIN_OPTIONS.map(o => o.key))} style={s.selectAllBtn}>
                <Text style={s.selectAllText}>SELECT ALL</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 1: Carbs ─────────────────────────���──────────────────── */}
          {step === 1 && (
            <View style={s.stepWrap}>
              <ProgressBar step={1} />
              <Text style={s.stepEyebrow}>STEP 2 OF 4</Text>
              <Text style={s.stepTitle}>Carb Sources</Text>
              <Text style={s.stepBody}>Where do you prefer your carbs from?</Text>
              <ChipGrid options={CARB_OPTIONS} selected={carbSources} onChange={setCarbSources} />
              <TouchableOpacity onPress={() => setCarbSources(CARB_OPTIONS.map(o => o.key))} style={s.selectAllBtn}>
                <Text style={s.selectAllText}>SELECT ALL</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: Fats + Exclusions ──────────────��─────────────────── */}
          {step === 2 && (
            <View style={s.stepWrap}>
              <ProgressBar step={2} />
              <Text style={s.stepEyebrow}>STEP 3 OF 4</Text>
              <Text style={s.stepTitle}>Fats & Exclusions</Text>
              <Text style={s.stepBody}>Preferred fat sources:</Text>
              <ChipGrid options={FAT_OPTIONS} selected={fatSources} onChange={setFatSources} />
              <Text style={[s.stepBody, { marginTop: 24 }]}>Anything you want to avoid?</Text>
              <ChipGrid options={EXCLUDE_OPTIONS} selected={excludedIngredients} onChange={setExcludedIngredients} />
            </View>
          )}

          {/* ── STEP 3: Meal types + Variety ────────────��────────────────── */}
          {step === 3 && (
            <View style={s.stepWrap}>
              <ProgressBar step={3} />
              <Text style={s.stepEyebrow}>STEP 4 OF 4</Text>
              <Text style={s.stepTitle}>Plan Style</Text>
              <Text style={s.stepBody}>Which meals should be auto-filled?</Text>
              <ChipGrid options={MEAL_TYPE_OPTIONS} selected={plannedMealTypes} onChange={setPlannedMealTypes} />

              <Text style={[s.stepBody, { marginTop: 28 }]}>Recipe variety across the week:</Text>
              <View style={s.varietyRow}>
                {VARIETY_OPTIONS.map((opt) => {
                  const active = varietyLevel === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setVarietyLevel(opt.value)}
                      activeOpacity={0.8}
                      style={[s.varietyBtn, active && s.varietyBtnActive]}
                    >
                      <Text style={[s.varietyLabel, active && s.varietyLabelActive]}>{opt.label}</Text>
                      <Text style={s.varietyNote}>{opt.note}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* Footer */}
      {step >= 0 && (
        <View style={s.footer}>
          <TouchableOpacity style={s.footerBack} onPress={back}>
            <Text style={s.footerBackText}>BACK</Text>
          </TouchableOpacity>
          {step < 3 ? (
            <TouchableOpacity
              style={[s.footerNext, !canContinue() && { opacity: 0.35 }]}
              onPress={next}
              disabled={!canContinue()}
            >
              <Text style={s.footerNextText}>CONTINUE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.footerNext, saving && { opacity: 0.5 }]}
              onPress={handleDone}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={P.gold} />
                : <Text style={s.footerNextText}>SAVE PREFERENCES</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Goal colour helpers ─────────────���──────────────────────────────────────────

function goalColor(goal: GoalType) {
  const map = {
    cut:      { backgroundColor: "rgba(184,48,48,0.15)",  borderColor: "rgba(184,48,48,0.4)" },
    bulk:     { backgroundColor: "rgba(58,125,90,0.15)",  borderColor: "rgba(58,125,90,0.4)" },
    maintain: { backgroundColor: "rgba(90,159,212,0.15)", borderColor: "rgba(90,159,212,0.4)" },
  };
  return { ...map[goal], borderWidth: StyleSheet.hairlineWidth };
}

function goalTextColor(goal: GoalType) {
  return { cut: "#E05555", bulk: "#4DAA7A", maintain: "#6AAED6" }[goal];
}

// ── Styles ─────────────────────��──────────────────────────────────────────────

const s = StyleSheet.create({
  scroll:        { paddingHorizontal: 24, paddingBottom: 32 },

  header:        { flexDirection: "row", alignItems: "flex-end", paddingTop: 16, paddingBottom: 24, gap: 12 },
  backText:      { fontFamily: OUT_L, fontSize: 22, color: P.mid, lineHeight: 28, marginBottom: 4 },
  eyebrow:       { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:    { fontFamily: CG_ITALIC, fontSize: 36, letterSpacing: -0.5, lineHeight: 42, color: P.ink },

  // Intro
  introWrap:     { gap: 16 },
  introTitle:    { fontFamily: CG, fontSize: 26, color: P.ink, letterSpacing: -0.3, marginBottom: 4 },
  introBody:     { fontFamily: OUT_L, fontSize: 14, color: P.mid, lineHeight: 22 },

  bigBtn:        { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 20, gap: 6, marginTop: 4 },
  bigBtnGold:    { borderColor: P.gold, backgroundColor: P.goldDim },
  bigBtnText:    { fontFamily: OUT_L, fontSize: 12, letterSpacing: 3, color: P.mid, textTransform: "uppercase" },
  bigBtnGoldText:{ fontFamily: OUT_L, fontSize: 12, letterSpacing: 3, color: P.gold, textTransform: "uppercase" },
  bigBtnNote:    { fontFamily: OUT_L, fontSize: 12, color: P.mid, lineHeight: 18 },

  goalBadgeRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  goalBadgeLabel:{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.dim, textTransform: "uppercase" },
  goalBadge:     { paddingHorizontal: 8, paddingVertical: 4 },
  goalBadgeText: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2 },

  // Steps
  stepWrap:      { gap: 0 },
  stepEyebrow:   { fontFamily: OUT_L, fontSize: 9, letterSpacing: 3, color: P.dim, textTransform: "uppercase", marginBottom: 8 },
  stepTitle:     { fontFamily: CG, fontSize: 28, color: P.ink, letterSpacing: -0.3, marginBottom: 8 },
  stepBody:      { fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20, marginBottom: 16 },

  selectAllBtn:  { alignSelf: "flex-start", marginTop: 16, paddingVertical: 6 },
  selectAllText: { fontFamily: OUT_L, fontSize: 9, letterSpacing: 2, color: P.dim, textDecorationLine: "underline" },

  // Variety
  varietyRow:    { gap: 8 },
  varietyBtn:    { borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, padding: 14, gap: 4 },
  varietyBtnActive: { borderColor: P.gold, backgroundColor: P.goldDim },
  varietyLabel:  { fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid, textTransform: "uppercase" },
  varietyLabelActive: { color: P.gold },
  varietyNote:   { fontFamily: OUT_L, fontSize: 12, color: P.dim, lineHeight: 18 },

  // Footer
  footer:        { flexDirection: "row", gap: 10, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: P.border },
  footerBack:    { flex: 1, height: 52, borderWidth: StyleSheet.hairlineWidth, borderColor: P.border, alignItems: "center", justifyContent: "center" },
  footerBackText:{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid },
  footerNext:    { flex: 2, height: 52, borderWidth: StyleSheet.hairlineWidth, borderColor: P.gold, backgroundColor: P.goldDim, alignItems: "center", justifyContent: "center" },
  footerNextText:{ fontFamily: OUT_L, fontSize: 11, letterSpacing: 3, color: P.gold, textTransform: "uppercase" },
});
