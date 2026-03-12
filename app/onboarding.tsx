import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInRight, FadeInUp } from "react-native-reanimated";
import { useState } from "react";
import { router } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";

// ── US Navy body fat formula ─────────────────────────────────────────────────
function calcBf(
  sex: "male" | "female",
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number
): number | null {
  if (waistCm <= neckCm) return null;
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;
  if (sex === "male") {
    const bf =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450;
    return Math.min(Math.max(Math.round(bf * 10) / 10, 2), 60);
  } else {
    if (!hipCm || hipCm <= 0) return null;
    const bf =
      495 /
        (1.29579 -
          0.35004 * Math.log10(waistCm + hipCm - neckCm) +
          0.221 * Math.log10(heightCm)) -
      450;
    return Math.min(Math.max(Math.round(bf * 10) / 10, 10), 60);
  }
}

function bfCategory(sex: "male" | "female", bf: number): { label: string; color: string } {
  if (sex === "male") {
    if (bf < 6) return { label: "Essential", color: "#5AC8FA" };
    if (bf < 14) return { label: "Athletic", color: "#34C759" };
    if (bf < 18) return { label: "Fitness", color: "#FFD60A" };
    if (bf < 25) return { label: "Average", color: "#FF9F0A" };
    return { label: "Obese", color: "#FF3B30" };
  } else {
    if (bf < 14) return { label: "Essential", color: "#5AC8FA" };
    if (bf < 21) return { label: "Athletic", color: "#34C759" };
    if (bf < 25) return { label: "Fitness", color: "#FFD60A" };
    if (bf < 32) return { label: "Average", color: "#FF9F0A" };
    return { label: "Obese", color: "#FF3B30" };
  }
}

function estimateMonths(currentBf: number, targetBf: number, weeklyGoal: number): string {
  if (currentBf <= targetBf) return "You're already there!";
  const weeksPerPercent = 1 / (weeklyGoal * 0.125);
  const weeks = (currentBf - targetBf) * weeksPerPercent;
  const months = Math.ceil(weeks / 4.3);
  if (months <= 1) return "~1 month";
  return `~${months} months`;
}

// ── Reusable input ───────────────────────────────────────────────────────────
function NumInput({
  label,
  hint,
  value,
  onChange,
  colors,
  typography,
  unit,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  colors: any;
  typography: any;
  unit?: string;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[typography.subheadline, { color: colors.label, marginBottom: 6, fontWeight: "600" }]}>
        {label}
      </Text>
      {hint && (
        <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 8 }]}>{hint}</Text>
      )}
      <View style={[inputStyles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          style={[inputStyles.field, { color: colors.label }]}
          placeholderTextColor={colors.labelTertiary}
          placeholder="0"
        />
        {unit && (
          <Text style={[typography.body, { color: colors.labelSecondary, paddingRight: 14 }]}>{unit}</Text>
        )}
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  field: {
    flex: 1,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});

// ── BF Zone Bar ──────────────────────────────────────────────────────────────
function BfZoneBar({ sex, current, target, colors, typography }: any) {
  const minBf = sex === "male" ? 3 : 10;
  const maxBf = 40;
  const range = maxBf - minBf;
  const currentPct = Math.min(Math.max((current - minBf) / range, 0), 1);
  const targetPct = Math.min(Math.max((target - minBf) / range, 0), 1);

  const zones = sex === "male"
    ? [
        { end: 6, color: "#5AC8FA", label: "Ess." },
        { end: 14, color: "#34C759", label: "Athletic" },
        { end: 18, color: "#FFD60A", label: "Fitness" },
        { end: 25, color: "#FF9F0A", label: "Avg" },
        { end: 40, color: "#FF3B30", label: "Obese" },
      ]
    : [
        { end: 14, color: "#5AC8FA", label: "Ess." },
        { end: 21, color: "#34C759", label: "Athletic" },
        { end: 25, color: "#FFD60A", label: "Fitness" },
        { end: 32, color: "#FF9F0A", label: "Avg" },
        { end: 40, color: "#FF3B30", label: "Obese" },
      ];

  return (
    <View style={{ marginVertical: 8 }}>
      {/* Zone bar */}
      <View style={{ height: 12, borderRadius: 6, flexDirection: "row", overflow: "hidden", marginBottom: 24 }}>
        {zones.map((z, i) => {
          const start = i === 0 ? minBf : zones[i - 1].end;
          return (
            <View key={i} style={{ flex: (z.end - start) / range, backgroundColor: z.color, opacity: 0.85 }} />
          );
        })}
      </View>

      {/* Markers */}
      <View style={{ position: "relative", height: 40 }}>
        {/* Target marker */}
        <View style={[markerStyles.flag, { left: `${targetPct * 100}%` as any }]}>
          <View style={[markerStyles.flagLine, { backgroundColor: colors.accent }]} />
          <Text style={[typography.caption2, { color: colors.accent, fontWeight: "700", marginTop: 2 }]}>
            Goal {target}%
          </Text>
        </View>
        {/* Current marker */}
        <View style={[markerStyles.flag, { left: `${currentPct * 100}%` as any }]}>
          <View style={[markerStyles.flagLine, { backgroundColor: colors.label }]} />
          <Text style={[typography.caption2, { color: colors.label, fontWeight: "700", marginTop: 2 }]}>
            {current}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  flag: {
    position: "absolute",
    alignItems: "center",
    transform: [{ translateX: -16 }],
  },
  flagLine: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
});

// ── Main screen ──────────────────────────────────────────────────────────────
const WEEKLY_OPTIONS = [3, 4, 5];

export default function OnboardingScreen() {
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();
  const saveProfile = useMutation(api.userProfile.saveProfile);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // Step 2 state
  const [manualMode, setManualMode] = useState(false);
  const [manualBfInput, setManualBfInput] = useState("");
  const [neck, setNeck] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");

  // Step 3 state
  const [targetBf, setTargetBf] = useState<number | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(4);

  const formulaBf = calcBf(
    sex,
    parseFloat(height) || 0,
    parseFloat(waist) || 0,
    parseFloat(neck) || 0,
    sex === "female" ? (parseFloat(hip) || 0) : undefined
  );
  const manualBf = manualBfInput ? parseFloat(manualBfInput) : null;
  const currentBf = manualMode ? (manualBf && manualBf > 2 && manualBf < 60 ? Math.round(manualBf * 10) / 10 : null) : formulaBf;

  const step1Valid = age && height && weight;
  const step2Valid = manualMode
    ? currentBf !== null
    : neck && waist && (sex === "male" || hip) && currentBf !== null;
  const step3Valid = targetBf !== null;

  const handleSave = async () => {
    if (!userId || !currentBf || targetBf === null) return;
    setSaving(true);
    try {
      await saveProfile({
        userId,
        sex,
        age: parseInt(age),
        heightCm: parseFloat(height),
        weightKg: parseFloat(weight),
        neckCm: manualMode ? undefined : parseFloat(neck),
        waistCm: manualMode ? undefined : parseFloat(waist),
        hipCm: (!manualMode && sex === "female") ? parseFloat(hip) : undefined,
        currentBf,
        targetBf,
        weeklyGoal,
      });
      router.replace("/(tabs)");
    } finally {
      setSaving(false);
    }
  };

  const bg = colors.background;
  const card = colors.backgroundSecondary;

  // Target presets by sex
  const targetPresets = sex === "male"
    ? [{ label: "Athletic", value: 12 }, { label: "Fitness", value: 16 }, { label: "Healthy", value: 20 }]
    : [{ label: "Athletic", value: 18 }, { label: "Fitness", value: 22 }, { label: "Healthy", value: 26 }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top", "bottom"]}>
      {/* Progress dots */}
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === step ? colors.accent : colors.fillSecondary,
                width: i === step ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <Animated.View entering={FadeInRight.springify()} style={{ flex: 1, alignItems: "center", paddingTop: 40 }}>
              <Text style={[typography.largeTitle, { color: colors.label, textAlign: "center", marginBottom: 16 }]}>
                Set Your Goal
              </Text>
              <Text style={[typography.body, { color: colors.labelSecondary, textAlign: "center", lineHeight: 24, paddingHorizontal: 20, marginBottom: 40 }]}>
                We'll calculate your body fat percentage and build a personalised roadmap to your target physique.
              </Text>

              <View style={[styles.card, { backgroundColor: card, width: "100%" }]}>
                {[
                  { icon: "📐", text: "Calculate your body fat with 3 measurements" },
                  { icon: "🎯", text: "Set a realistic target and timeline" },
                  { icon: "📈", text: "Track your progress every workout" },
                ].map((item, i) => (
                  <View key={i} style={[styles.featureRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.separator }]}>
                    <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                    <Text style={[typography.subheadline, { color: colors.label, flex: 1 }]}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ── Step 1: About You ── */}
          {step === 1 && (
            <Animated.View entering={FadeInRight.springify()}>
              <Text style={[typography.largeTitle, { color: colors.label, marginBottom: 6 }]}>About You</Text>
              <Text style={[typography.body, { color: colors.labelSecondary, marginBottom: 32 }]}>
                Used to calculate your body fat accurately.
              </Text>

              {/* Sex toggle */}
              <Text style={[typography.subheadline, { color: colors.label, marginBottom: 10, fontWeight: "600" }]}>Sex</Text>
              <View style={[styles.segmentRow, { backgroundColor: colors.backgroundSecondary, marginBottom: 24 }]}>
                {(["male", "female"] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSex(s)}
                    style={[
                      styles.segment,
                      sex === s && { backgroundColor: colors.accent },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[typography.subheadline, { color: sex === s ? "#fff" : colors.label, fontWeight: "600" }]}>
                      {s === "male" ? "Male" : "Female"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <NumInput label="Age" value={age} onChange={setAge} colors={colors} typography={typography} unit="yrs" />
              <NumInput label="Height" value={height} onChange={setHeight} colors={colors} typography={typography} unit="cm" />
              <NumInput label="Weight" value={weight} onChange={setWeight} colors={colors} typography={typography} unit="kg" />
            </Animated.View>
          )}

          {/* ── Step 2: Measurements ── */}
          {step === 2 && (
            <Animated.View entering={FadeInRight.springify()}>
              <Text style={[typography.largeTitle, { color: colors.label, marginBottom: 6 }]}>Body Fat</Text>
              <Text style={[typography.body, { color: colors.labelSecondary, marginBottom: 20 }]}>
                Use a soft tape measure. Breathe normally — don't suck in.
              </Text>

              {/* Mode toggle */}
              <View style={[styles.segmentRow, { backgroundColor: card, marginBottom: 24 }]}>
                {(["calculate", "manual"] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setManualMode(m === "manual")}
                    style={[styles.segment, manualMode === (m === "manual") && { backgroundColor: colors.accent }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[typography.subheadline, { color: manualMode === (m === "manual") ? "#fff" : colors.label, fontWeight: "600" }]}>
                      {m === "calculate" ? "Calculate" : "I know mine"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {manualMode ? (
                <NumInput
                  label="Your body fat %"
                  hint="From DEXA, calipers, or another method"
                  value={manualBfInput}
                  onChange={setManualBfInput}
                  colors={colors}
                  typography={typography}
                  unit="%"
                />
              ) : (
                <>
                  <NumInput
                    label="Neck"
                    hint="Just below the adam's apple, perpendicular to neck axis"
                    value={neck}
                    onChange={setNeck}
                    colors={colors}
                    typography={typography}
                    unit="cm"
                  />
                  <NumInput
                    label="Waist"
                    hint={sex === "male" ? "At the navel (belly button level)" : "At the narrowest point"}
                    value={waist}
                    onChange={setWaist}
                    colors={colors}
                    typography={typography}
                    unit="cm"
                  />
                  {sex === "female" && (
                    <NumInput
                      label="Hips"
                      hint="At the widest point around the buttocks"
                      value={hip}
                      onChange={setHip}
                      colors={colors}
                      typography={typography}
                      unit="cm"
                    />
                  )}
                </>
              )}

              {/* Live BF% preview */}
              {currentBf !== null && (
                <Animated.View
                  entering={FadeInUp.springify()}
                  style={[styles.card, { backgroundColor: card, alignItems: "center", marginTop: 8 }]}
                >
                  <Text style={[typography.caption1, { color: colors.labelSecondary, marginBottom: 4 }]}>
                    {manualMode ? "YOUR BODY FAT" : "ESTIMATED BODY FAT ±3%"}
                  </Text>
                  <Text style={{ fontSize: 64, fontWeight: "800", color: bfCategory(sex, currentBf).color }}>
                    {currentBf}%
                  </Text>
                  <View style={[styles.badge, { backgroundColor: bfCategory(sex, currentBf).color + "22" }]}>
                    <Text style={[typography.caption1, { color: bfCategory(sex, currentBf).color, fontWeight: "700" }]}>
                      {bfCategory(sex, currentBf).label}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* ── Step 3: Goal ── */}
          {step === 3 && currentBf !== null && (
            <Animated.View entering={FadeInRight.springify()}>
              <Text style={[typography.largeTitle, { color: colors.label, marginBottom: 6 }]}>Your Goal</Text>
              <Text style={[typography.body, { color: colors.labelSecondary, marginBottom: 28 }]}>
                You're at {currentBf}% — where do you want to be?
              </Text>

              {/* Target presets */}
              <Text style={[typography.subheadline, { color: colors.label, fontWeight: "600", marginBottom: 12 }]}>
                Target body fat
              </Text>
              <View style={{ gap: 10, marginBottom: 28 }}>
                {targetPresets.map((p) => {
                  const cat = bfCategory(sex, p.value);
                  const selected = targetBf === p.value;
                  return (
                    <TouchableOpacity
                      key={p.value}
                      onPress={() => setTargetBf(p.value)}
                      style={[
                        styles.goalRow,
                        {
                          backgroundColor: selected ? colors.accent + "18" : card,
                          borderColor: selected ? colors.accent : "transparent",
                          borderWidth: 1.5,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <View>
                        <Text style={[typography.headline, { color: colors.label }]}>{p.label}</Text>
                        <Text style={[typography.caption1, { color: colors.labelSecondary }]}>
                          {p.value}% body fat
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: cat.color + "22" }]}>
                        <Text style={[typography.caption1, { color: cat.color, fontWeight: "700" }]}>{cat.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Weekly commitment */}
              <Text style={[typography.subheadline, { color: colors.label, fontWeight: "600", marginBottom: 12 }]}>
                Workouts per week
              </Text>
              <View style={[styles.segmentRow, { backgroundColor: card, marginBottom: 28 }]}>
                {WEEKLY_OPTIONS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setWeeklyGoal(n)}
                    style={[styles.segment, weeklyGoal === n && { backgroundColor: colors.accent }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[typography.headline, { color: weeklyGoal === n ? "#fff" : colors.label, fontWeight: "700" }]}>
                      {n}×
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Journey preview */}
              {targetBf !== null && (
                <Animated.View
                  entering={FadeInUp.springify()}
                  style={[styles.card, { backgroundColor: card }]}
                >
                  <Text style={[typography.headline, { color: colors.label, marginBottom: 16 }]}>
                    Your Journey
                  </Text>
                  <BfZoneBar
                    sex={sex}
                    current={currentBf}
                    target={targetBf}
                    colors={colors}
                    typography={typography}
                  />
                  <View style={[styles.timeRow, { borderTopColor: colors.separator }]}>
                    <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>Estimated time</Text>
                    <Text style={[typography.headline, { color: colors.accent, fontWeight: "700" }]}>
                      {estimateMonths(currentBf, targetBf, weeklyGoal)}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.footer, { borderTopColor: colors.separator }]}>
          {step > 0 && (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              style={[styles.backBtn, { backgroundColor: colors.fillSecondary }]}
            >
              <Text style={[typography.body, { color: colors.label, fontWeight: "600" }]}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              if (step === 3) handleSave();
              else setStep(step + 1);
            }}
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid) ||
              (step === 3 && !step3Valid) ||
              saving
            }
            style={[
              styles.nextBtn,
              {
                backgroundColor: colors.accent,
                opacity:
                  (step === 1 && !step1Valid) ||
                  (step === 2 && !step2Valid) ||
                  (step === 3 && !step3Valid)
                    ? 0.45
                    : 1,
              },
            ]}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                {step === 3 ? "Start Training" : "Continue"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    paddingBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  segmentRow: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 11,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 16,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 0.5,
  },
  backBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
  nextBtn: {
    flex: 2,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
});
