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
    if (bf < 6)  return { label: "Essential", color: "#5AC8FA" };
    if (bf < 14) return { label: "Athletic",  color: "#34C759" };
    if (bf < 18) return { label: "Fitness",   color: "#FFD60A" };
    if (bf < 25) return { label: "Average",   color: "#FF9F0A" };
    return { label: "Obese", color: "#FF3B30" };
  } else {
    if (bf < 14) return { label: "Essential", color: "#5AC8FA" };
    if (bf < 21) return { label: "Athletic",  color: "#34C759" };
    if (bf < 25) return { label: "Fitness",   color: "#FFD60A" };
    if (bf < 32) return { label: "Average",   color: "#FF9F0A" };
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

// ── Reusable numeric input ────────────────────────────────────────────────────
function NumInput({
  label, hint, value, onChange, colors, typography, unit,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  colors: any; typography: any; unit?: string;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.labelSecondary, marginBottom: 8 }}>
        {label}
      </Text>
      {hint && (
        <Text style={[typography.caption1, { color: colors.labelTertiary, marginBottom: 8 }]}>{hint}</Text>
      )}
      <View style={[inputStyles.row, { borderColor: colors.separator }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          style={[inputStyles.field, { color: colors.label }]}
          placeholderTextColor={colors.labelTertiary}
          placeholder="0"
        />
        {unit && (
          <Text style={{ color: colors.labelSecondary, fontSize: 11, letterSpacing: 1, paddingRight: 14 }}>{unit}</Text>
        )}
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", borderRadius: 4, borderWidth: 1 },
  field: { flex: 1, fontSize: 17, paddingHorizontal: 14, paddingVertical: 14 },
});

// ── BF Zone Bar ──────────────────────────────────────────────────────────────
function BfZoneBar({ sex, current, target, colors, typography }: any) {
  const minBf = sex === "male" ? 3 : 10;
  const maxBf = 40;
  const range = maxBf - minBf;
  const currentPct = Math.min(Math.max((current - minBf) / range, 0), 1);
  const targetPct  = Math.min(Math.max((target  - minBf) / range, 0), 1);

  const zones = sex === "male"
    ? [
        { end: 6,  color: "#5AC8FA", label: "Ess." },
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
      {/* Flat zone bar */}
      <View style={{ height: 10, flexDirection: "row", overflow: "hidden", marginBottom: 24 }}>
        {zones.map((z, i) => {
          const start = i === 0 ? minBf : zones[i - 1].end;
          return (
            <View key={i} style={{ flex: (z.end - start) / range, backgroundColor: z.color, opacity: 0.8 }} />
          );
        })}
      </View>

      {/* Markers */}
      <View style={{ position: "relative", height: 40 }}>
        <View style={[markerStyles.flag, { left: `${targetPct * 100}%` as any }]}>
          <View style={[markerStyles.flagLine, { backgroundColor: colors.accent }]} />
          <Text style={{ fontSize: 10, color: colors.accent, fontWeight: "700", marginTop: 2, letterSpacing: 0.5 }}>
            Goal {target}%
          </Text>
        </View>
        <View style={[markerStyles.flag, { left: `${currentPct * 100}%` as any }]}>
          <View style={[markerStyles.flagLine, { backgroundColor: colors.label }]} />
          <Text style={{ fontSize: 10, color: colors.label, fontWeight: "700", marginTop: 2 }}>
            {current}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  flag:     { position: "absolute", alignItems: "center", transform: [{ translateX: -16 }] },
  flagLine: { width: 1, height: 16 },
});

// ── Segmented selector ────────────────────────────────────────────────────────
function SegmentControl({
  options, value, onChange, colors,
}: {
  options: { label: string; value: any }[];
  value: any;
  onChange: (v: any) => void;
  colors: any;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            style={[segStyles.btn, {
              borderColor: active ? colors.accent : colors.separator,
            }]}
          >
            <Text style={{
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: active ? colors.accent : colors.labelSecondary,
              fontWeight: active ? "700" : "400",
            }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  btn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 4, borderWidth: 1 },
});

// ── Main screen ──────────────────────────────────────────────────────────────
const WEEKLY_OPTIONS = [3, 4, 5];

export default function OnboardingScreen() {
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();
  const saveProfile = useMutation(api.userProfile.saveProfile);

  const [step, setSt] = useState(0);
  const [saving, setSaving] = useState(false);

  const [sex, setSex]       = useState<"male" | "female">("male");
  const [age, setAge]       = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const [manualMode, setManualMode]         = useState(false);
  const [manualBfInput, setManualBfInput]   = useState("");
  const [neck, setNeck]   = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip]     = useState("");

  const [targetBf, setTargetBf]     = useState<number | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(4);

  const formulaBf = calcBf(
    sex,
    parseFloat(height) || 0,
    parseFloat(waist)  || 0,
    parseFloat(neck)   || 0,
    sex === "female" ? (parseFloat(hip) || 0) : undefined
  );
  const manualBf  = manualBfInput ? parseFloat(manualBfInput) : null;
  const currentBf = manualMode
    ? (manualBf && manualBf > 2 && manualBf < 60 ? Math.round(manualBf * 10) / 10 : null)
    : formulaBf;

  const step1Valid = age && height && weight;
  const step2Valid = manualMode
    ? currentBf !== null
    : neck && waist && (sex === "male" || hip) && currentBf !== null;
  const step3Valid = targetBf !== null;

  const canContinue = () => {
    if (step === 1) return !!step1Valid;
    if (step === 2) return !!step2Valid;
    if (step === 3) return !!step3Valid;
    return true;
  };

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
        neckCm:  manualMode ? undefined : parseFloat(neck),
        waistCm: manualMode ? undefined : parseFloat(waist),
        hipCm:   (!manualMode && sex === "female") ? parseFloat(hip) : undefined,
        currentBf,
        targetBf,
        weeklyGoal,
      });
      router.replace("/(tabs)");
    } finally {
      setSaving(false);
    }
  };

  const targetPresets = sex === "male"
    ? [{ label: "Athletic", value: 12 }, { label: "Fitness", value: 16 }, { label: "Healthy", value: 20 }]
    : [{ label: "Athletic", value: 18 }, { label: "Fitness", value: 22 }, { label: "Healthy", value: 26 }];

  const STEP_COUNT = 4;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressSegment, {
              backgroundColor: i <= step ? colors.accent : colors.fillSecondary,
            }]}
          />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <Animated.View entering={FadeInRight.springify()} style={{ paddingTop: 20 }}>
              <Text style={[typography.largeTitle, { color: colors.label, marginBottom: 8 }]}>
                Set Your Goal
              </Text>
              <Text style={[typography.body, { color: colors.labelSecondary, lineHeight: 24, marginBottom: 40 }]}>
                We'll calculate your body fat percentage and build a personalised roadmap to your target physique.
              </Text>

              {/* Feature list */}
              <View style={[styles.card, { borderColor: colors.separator }]}>
                {[
                  { icon: "📐", text: "Calculate your body fat with 3 measurements" },
                  { icon: "🎯", text: "Set a realistic target and timeline" },
                  { icon: "📈", text: "Track your progress every workout" },
                ].map((item, i) => (
                  <View
                    key={i}
                    style={[styles.featureRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}
                  >
                    <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                    <Text style={[typography.subheadline, { color: colors.labelSecondary, flex: 1 }]}>{item.text}</Text>
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

              <Text style={styles.sectionLabel(colors)}>Sex</Text>
              <SegmentControl
                options={[{ label: "Male", value: "male" }, { label: "Female", value: "female" }]}
                value={sex}
                onChange={setSex}
                colors={colors}
              />

              <NumInput label="Age"    value={age}    onChange={setAge}    colors={colors} typography={typography} unit="yrs" />
              <NumInput label="Height" value={height} onChange={setHeight} colors={colors} typography={typography} unit="cm"  />
              <NumInput label="Weight" value={weight} onChange={setWeight} colors={colors} typography={typography} unit="kg"  />
            </Animated.View>
          )}

          {/* ── Step 2: Body Fat ── */}
          {step === 2 && (
            <Animated.View entering={FadeInRight.springify()}>
              <Text style={[typography.largeTitle, { color: colors.label, marginBottom: 6 }]}>Body Fat</Text>
              <Text style={[typography.body, { color: colors.labelSecondary, marginBottom: 24 }]}>
                Use a soft tape measure. Breathe normally — don't suck in.
              </Text>

              <SegmentControl
                options={[{ label: "Calculate", value: "calculate" }, { label: "I know mine", value: "manual" }]}
                value={manualMode ? "manual" : "calculate"}
                onChange={(v: string) => setManualMode(v === "manual")}
                colors={colors}
              />

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
                  <NumInput label="Neck"  hint="Just below the adam's apple, perpendicular to neck axis" value={neck}  onChange={setNeck}  colors={colors} typography={typography} unit="cm" />
                  <NumInput label="Waist" hint={sex === "male" ? "At the navel (belly button level)" : "At the narrowest point"} value={waist} onChange={setWaist} colors={colors} typography={typography} unit="cm" />
                  {sex === "female" && (
                    <NumInput label="Hips" hint="At the widest point around the buttocks" value={hip} onChange={setHip} colors={colors} typography={typography} unit="cm" />
                  )}
                </>
              )}

              {currentBf !== null && (
                <Animated.View
                  entering={FadeInUp.springify()}
                  style={[styles.card, { borderColor: colors.separator, alignItems: "center", marginTop: 8 }]}
                >
                  <Text style={{ fontSize: 10, color: colors.labelSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                    {manualMode ? "Your Body Fat" : "Estimated Body Fat ±3%"}
                  </Text>
                  <Text style={{ fontSize: 64, fontWeight: "800", color: bfCategory(sex, currentBf).color }}>
                    {currentBf}%
                  </Text>
                  <View style={[styles.badge, { borderColor: bfCategory(sex, currentBf).color }]}>
                    <Text style={{ fontSize: 10, color: bfCategory(sex, currentBf).color, fontWeight: "700", letterSpacing: 1 }}>
                      {bfCategory(sex, currentBf).label.toUpperCase()}
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

              <Text style={styles.sectionLabel(colors)}>Target body fat</Text>
              <View style={{ gap: 8, marginBottom: 28 }}>
                {targetPresets.map((p) => {
                  const cat      = bfCategory(sex, p.value);
                  const selected = targetBf === p.value;
                  return (
                    <TouchableOpacity
                      key={p.value}
                      onPress={() => setTargetBf(p.value)}
                      style={[styles.goalRow, {
                        borderColor: selected ? colors.accent : colors.separator,
                      }]}
                      activeOpacity={0.8}
                    >
                      <View>
                        <Text style={[typography.headline, { color: selected ? colors.accent : colors.label }]}>
                          {p.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.labelSecondary, marginTop: 2 }}>
                          {p.value}% body fat
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: cat.color, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel(colors)}>Workouts per week</Text>
              <SegmentControl
                options={WEEKLY_OPTIONS.map((n) => ({ label: `${n}×`, value: n }))}
                value={weeklyGoal}
                onChange={setWeeklyGoal}
                colors={colors}
              />

              {targetBf !== null && (
                <Animated.View
                  entering={FadeInUp.springify()}
                  style={[styles.card, { borderColor: colors.separator }]}
                >
                  <Text style={styles.sectionLabel(colors)}>Your Journey</Text>
                  <BfZoneBar
                    sex={sex}
                    current={currentBf}
                    target={targetBf}
                    colors={colors}
                    typography={typography}
                  />
                  <View style={[styles.timeRow, { borderTopColor: colors.separator }]}>
                    <Text style={{ fontSize: 10, color: colors.labelSecondary, letterSpacing: 1.2, textTransform: "uppercase" }}>
                      Estimated time
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.accent, fontWeight: "700", letterSpacing: 0.5 }}>
                      {estimateMonths(currentBf, targetBf, weeklyGoal)}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.separator }]}>
          {step > 0 && (
            <TouchableOpacity
              onPress={() => setSt(step - 1)}
              style={[styles.backBtn, { borderColor: colors.separator }]}
            >
              <Text style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: colors.labelSecondary }}>
                Back
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => { if (step === 3) handleSave(); else setSt(step + 1); }}
            disabled={!canContinue() || saving}
            style={[styles.nextBtn, {
              borderColor: colors.accent,
              opacity: !canContinue() ? 0.4 : 1,
            }]}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: colors.accent, fontWeight: "700" }}>
                {step === 3 ? "Start Training" : "Continue"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  progressBar:     { flexDirection: "row", gap: 4, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 10 },
  progressSegment: { flex: 1, height: 2, borderRadius: 1 },
  scroll:          { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },

  card: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 10,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 4,
    borderWidth: 1,
    padding: 16,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  nextBtn: {
    flex: 2,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  sectionLabel: (colors: any) => ({
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: colors.labelSecondary,
    marginBottom: 12,
  }),
});
