import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInRight,
  FadeInDown,
} from "react-native-reanimated";
import { impactLight, selectionAsync, notificationSuccess } from "@/utils/haptics";
import { router } from "expo-router";
import { useMutation } from "convex/react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import {
  ALL_MUSCLE_GROUPS,
  MUSCLE_DISPLAY_NAMES,
  VOLUME_DEFAULTS,
  type MuscleGroup,
} from "@/constants/muscles";
const TOTAL_STEPS = 4;

// ---- Template definitions (display only) ----
const TEMPLATES = [
  {
    id: "laxman",
    name: "Laxman",
    subtitle: "4 days · Shoulders/Biceps · Back · Triceps/Back · Legs",
    tag: "High Volume",
    tagColor: "#FF6B35",
    description: "Super-set heavy 4-day split with drop sets and pre-fatigue protocols.",
    weeks: 5,
  },
  {
    id: "ppl",
    name: "PPL Hypertrophy",
    subtitle: "6 days · Push · Pull · Legs × 2",
    tag: "RP-Style",
    tagColor: "#007AFF",
    description: "Classic Push/Pull/Legs twice per week. Maximum frequency for hypertrophy.",
    weeks: 5,
  },
  {
    id: "upper_lower",
    name: "Upper / Lower",
    subtitle: "4 days · Upper A · Lower A · Upper B · Lower B",
    tag: "Beginner–Intermediate",
    tagColor: "#34C759",
    description: "Balanced upper/lower split. Ideal if you're building your training base.",
    weeks: 5,
  },
  {
    id: "cbum",
    name: "CBum Classic Physique",
    subtitle: "5 days · Chest/Tri · Back/Bi · Shoulders/Arms · Legs · Arms Pump",
    tag: "Classic Physique",
    tagColor: "#C9A84C",
    description: "Chris Bumstead's 5-day split. High chest and arm volume with a dedicated legs day.",
    weeks: 5,
  },
  {
    id: "jeff_nippard",
    name: "Jeff Nippard Science-Based",
    subtitle: "4 days · Upper Horizontal · Lower Quad · Upper Vertical · Lower Hinge",
    tag: "Evidence-Based",
    tagColor: "#AF52DE",
    description: "Science-based upper/lower split emphasising compound movements and mechanical tension.",
    weeks: 5,
  },
  {
    id: "lean_beef_patty",
    name: "Lean Beef Patty Glute Build",
    subtitle: "5 days · Glutes/Hams · Upper Pull · Quads/Glutes · Upper Push · Full Legs",
    tag: "Glute Focus",
    tagColor: "#FF2D55",
    description: "Glute-dominant 5-day program with twice-weekly hip thrust and high posterior chain volume.",
    weeks: 5,
  },
];

// ---- Step 0: Template picker ----
function StepTemplates({ onSelectTemplate, onBuildCustom, colors, typography, loading }: any) {
  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.stepContainer}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Start with a template
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 28 }]}>
        Pick a proven program or build your own from scratch.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: 12 }}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => !loading && onSelectTemplate(t.id)}
              activeOpacity={0.8}
              style={[templateStyles.card, { backgroundColor: colors.backgroundSecondary }]}
            >
              <View style={templateStyles.cardHeader}>
                <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>{t.name}</Text>
                <View style={[templateStyles.tag, { backgroundColor: t.tagColor + "22" }]}>
                  <Text style={[typography.caption2, { color: t.tagColor, fontWeight: "700" }]}>{t.tag}</Text>
                </View>
              </View>
              <Text style={[typography.caption1, { color: colors.accent, marginBottom: 8, fontWeight: "600" }]}>
                {t.subtitle}
              </Text>
              <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>
                {t.description}
              </Text>
              {loading === t.id && (
                <ActivityIndicator style={{ marginTop: 10 }} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={!loading ? onBuildCustom : undefined}
          activeOpacity={0.7}
          style={{ alignItems: "center", paddingVertical: 20 }}
        >
          <Text style={[typography.body, { color: colors.accent }]}>Build custom mesocycle</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const templateStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 10,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});

// ---- Step 1: Name & Duration ----
function StepNameDuration({
  name,
  setName,
  weeks,
  setWeeks,
  colors,
  typography,
}: any) {
  const weekOptions = [4, 5, 6];

  return (
    <Animated.View entering={FadeInRight} style={styles.stepContainer}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Name your block
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 32 }]}>
        A mesocycle is a focused training block. 4–6 weeks is optimal for hypertrophy.
      </Text>

      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: colors.backgroundSecondary,
            color: colors.label,
            ...typography.body,
            borderColor: colors.separator,
          },
        ]}
        placeholder="e.g. Hypertrophy Block 1"
        placeholderTextColor={colors.labelTertiary}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={[typography.subheadline, { color: colors.labelSecondary, marginTop: 28, marginBottom: 12 }]}>
        DURATION
      </Text>
      <View style={styles.pillRow}>
        {weekOptions.map((w) => (
          <TouchableOpacity
            key={w}
            style={[
              styles.pill,
              {
                backgroundColor: weeks === w ? colors.accent : colors.backgroundSecondary,
                flex: 1,
              },
            ]}
            onPress={() => {
              selectionAsync();
              setWeeks(w);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                typography.headline,
                { color: weeks === w ? "#FFF" : colors.label },
              ]}
            >
              {w} weeks
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

// ---- Step 2: Training days ----
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

function StepDays({ selectedDays, setSelectedDays, colors, typography }: any) {
  const toggle = (day: number) => {
    selectionAsync();
    setSelectedDays((prev: number[]) =>
      prev.includes(day) ? prev.filter((d: number) => d !== day) : [...prev, day]
    );
  };

  return (
    <Animated.View entering={FadeInRight} style={styles.stepContainer}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Training days
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 32 }]}>
        Pick which days you train. You can name each session after.
      </Text>

      <View style={styles.daysGrid}>
        {DAY_LABELS.map((label, i) => {
          const dayVal = DAY_VALUES[i];
          const active = selectedDays.includes(dayVal);
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.dayPill,
                {
                  backgroundColor: active ? colors.accent : colors.backgroundSecondary,
                },
              ]}
              onPress={() => toggle(dayVal)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.subheadline,
                  { color: active ? "#FFF" : colors.labelSecondary, fontWeight: "600" },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[typography.footnote, { color: colors.labelTertiary, marginTop: 20, textAlign: "center" }]}>
        {selectedDays.length} days selected
      </Text>
    </Animated.View>
  );
}

// ---- Step 3: Muscle groups per session ----
function StepSessions({
  selectedDays,
  sessionMuscles,
  setSessionMuscles,
  colors,
  typography,
}: any) {
  const [activeDay, setActiveDay] = useState<number>(selectedDays[0]);

  const dayLabel = (d: number) => DAY_LABELS[DAY_VALUES.indexOf(d)];

  const toggleMuscle = (day: number, muscle: MuscleGroup) => {
    selectionAsync();
    setSessionMuscles((prev: Record<number, MuscleGroup[]>) => {
      const current = prev[day] ?? [];
      return {
        ...prev,
        [day]: current.includes(muscle)
          ? current.filter((m) => m !== muscle)
          : [...current, muscle],
      };
    });
  };

  return (
    <Animated.View entering={FadeInRight} style={[styles.stepContainer, { flex: 1 }]}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Session muscles
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 20 }]}>
        Which muscle groups does each day train?
      </Text>

      {/* Day tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={styles.pillRow}>
          {selectedDays.map((day: number) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.pill,
                {
                  backgroundColor:
                    activeDay === day ? colors.label : colors.backgroundSecondary,
                  paddingHorizontal: 16,
                },
              ]}
              onPress={() => setActiveDay(day)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.subheadline,
                  {
                    color: activeDay === day
                      ? colors.background
                      : colors.labelSecondary,
                    fontWeight: "600",
                  },
                ]}
              >
                {dayLabel(day)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Muscle toggles */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.muscleGrid}>
          {ALL_MUSCLE_GROUPS.map((muscle) => {
            const active = (sessionMuscles[activeDay] ?? []).includes(muscle);
            return (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.musclePill,
                  {
                    backgroundColor: active ? colors.accent : colors.backgroundSecondary,
                    borderColor: active ? colors.accent : colors.separator,
                  },
                ]}
                onPress={() => toggleMuscle(activeDay, muscle)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    typography.subheadline,
                    { color: active ? "#FFF" : colors.label, fontWeight: active ? "600" : "400" },
                  ]}
                >
                  {MUSCLE_DISPLAY_NAMES[muscle]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ---- Step 4: Volume targets ----
function StepVolume({
  sessionMuscles,
  volumeOverrides,
  setVolumeOverrides,
  experienceLevel,
  colors,
  typography,
}: any) {
  // Collect all unique muscles across all sessions
  const allMuscles = Array.from(
    new Set(Object.values(sessionMuscles).flat())
  ) as MuscleGroup[];

  const getDefaults = (m: MuscleGroup) =>
    VOLUME_DEFAULTS[m][experienceLevel as "beginner" | "intermediate" | "advanced"];

  return (
    <Animated.View entering={FadeInRight} style={[styles.stepContainer, { flex: 1 }]}>
      <Text style={[typography.largeTitle, { color: colors.label }]}>
        Volume targets
      </Text>
      <Text style={[typography.body, { color: colors.labelSecondary, marginTop: 8, marginBottom: 24 }]}>
        Sets per week per muscle. Defaults are based on your experience level — adjust freely.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {allMuscles.map((muscle) => {
          const defaults = getDefaults(muscle);
          const override = volumeOverrides[muscle];
          const mev = override?.mev ?? defaults.mev;
          const mav = override?.mav ?? defaults.mav;
          const mrv = override?.mrv ?? defaults.mrv;

          return (
            <View
              key={muscle}
              style={[styles.volumeCard, { backgroundColor: colors.backgroundSecondary }]}
            >
              <Text style={[typography.headline, { color: colors.label, marginBottom: 12 }]}>
                {MUSCLE_DISPLAY_NAMES[muscle]}
              </Text>
              <View style={styles.volumeRow}>
                {(["mev", "mav", "mrv"] as const).map((key, i) => {
                  const val = { mev, mav, mrv }[key];
                  const label = { mev: "MEV", mav: "MAV", mrv: "MRV" }[key];
                  const color = [colors.volumeLow, colors.accent, colors.volumeHigh][i];
                  return (
                    <View key={key} style={styles.volumeField}>
                      <Text style={[typography.caption1, { color, fontWeight: "700" }]}>
                        {label}
                      </Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          onPress={() => {
                            selectionAsync();
                            setVolumeOverrides((prev: any) => ({
                              ...prev,
                              [muscle]: { mev, mav, mrv, [key]: Math.max(0, val - 1) },
                            }));
                          }}
                          style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]}
                        >
                          <Text style={[typography.title3, { color: colors.label }]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[typography.numericMedium, { color: colors.label, minWidth: 30, textAlign: "center" }]}>
                          {val}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            selectionAsync();
                            setVolumeOverrides((prev: any) => ({
                              ...prev,
                              [muscle]: { mev, mav, mrv, [key]: val + 1 },
                            }));
                          }}
                          style={[styles.stepBtn, { backgroundColor: colors.fillSecondary }]}
                        >
                          <Text style={[typography.title3, { color: colors.label }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </Animated.View>
  );
}

// ---- Main Wizard ----
export default function MesoNew() {
  const { colors, typography } = useTheme();
  const { userId } = useCurrentUser();
  const createMeso = useMutation(api.mesocycles.createCustom);
  const createLaxman = useMutation(api.templates.createLaxmanTemplate);
  const createPPL = useMutation(api.templates.createPPLTemplate);
  const createUpperLower = useMutation(api.templates.createUpperLowerTemplate);
  const createCBum = useMutation(api.templates.createCBumTemplate);
  const createJeffNippard = useMutation(api.templates.createJeffNippardTemplate);
  const createLeanBeefPatty = useMutation(api.templates.createLeanBeefPattyTemplate);

  // -1 = template picker, 0–3 = custom wizard steps
  const [step, setStep] = useState(-1);
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(5);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [sessionMuscles, setSessionMuscles] = useState<Record<number, MuscleGroup[]>>({});
  const [volumeOverrides, setVolumeOverrides] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);

  const handleSelectTemplate = async (templateId: string) => {
    if (!userId) return;
    setTemplateLoading(templateId);
    try {
      if (templateId === "laxman") await createLaxman({ userId });
      else if (templateId === "ppl") await createPPL({ userId });
      else if (templateId === "upper_lower") await createUpperLower({ userId });
      else if (templateId === "cbum") await createCBum({ userId });
      else if (templateId === "jeff_nippard") await createJeffNippard({ userId });
      else if (templateId === "lean_beef_patty") await createLeanBeefPatty({ userId });
      notificationSuccess();
      router.back();
    } catch {
      setTemplateLoading(null);
    }
  };

  // TODO: pull from user profile
  const experienceLevel = "intermediate";

  const canAdvance = () => {
    if (step < 0) return false; // template picker handles its own actions
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return selectedDays.length > 0;
    if (step === 2) return selectedDays.every((d) => (sessionMuscles[d] ?? []).length > 0);
    return true;
  };

  const next = () => {
    if (!canAdvance() || creating) return;
    impactLight();
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleCreate();
    }
  };

  const back = () => {
    if (step === -1) {
      router.back();
    } else if (step === 0) {
      selectionAsync();
      setStep(-1);
    } else {
      selectionAsync();
      setStep((s) => s - 1);
    }
  };

  const buildVolumeTargets = () => {
    const allMuscles = Array.from(
      new Set(Object.values(sessionMuscles).flat())
    ) as MuscleGroup[];

    return allMuscles.map((muscle) => {
      const defaults = VOLUME_DEFAULTS[muscle][experienceLevel as "beginner" | "intermediate" | "advanced"];
      const override = volumeOverrides[muscle];
      return {
        muscleGroup: muscle,
        mev: override?.mev ?? defaults.mev,
        mav: override?.mav ?? defaults.mav,
        mrv: override?.mrv ?? defaults.mrv,
      };
    });
  };

  const buildSessions = () => {
    const MUSCLE_SHORT: Record<string, string> = {
      chest: "Chest", back: "Back", shoulders: "Shoulders",
      biceps: "Biceps", triceps: "Triceps", quads: "Quads",
      hamstrings: "Hams", glutes: "Glutes", calves: "Calves",
      abs: "Abs", forearms: "Forearms",
    };
    return selectedDays
      .sort((a, b) => a - b)
      .map((day, i) => {
        const muscles = (sessionMuscles[day] ?? []) as string[];
        const name = muscles.length > 0
          ? muscles.slice(0, 3).map((m) => MUSCLE_SHORT[m] ?? m).join(" / ")
          : `Session ${i + 1}`;
        return { dayOfWeek: day, name, muscleGroups: muscles, order: i };
      });
  };

  const handleCreate = async () => {
    if (!userId) return;
    setCreating(true);
    try {
      await createMeso({
        userId,
        name,
        weeks,
        volumeTargets: buildVolumeTargets(),
        sessions: buildSessions(),
      });
      notificationSuccess();
      router.back();
    } catch (e) {
      setCreating(false);
    }
  };

  const stepProps = { colors, typography };

  const isTemplatePicker = step === -1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[typography.body, { color: colors.accent }]}>
            {step <= 0 ? "Cancel" : "Back"}
          </Text>
        </TouchableOpacity>

        {/* Progress dots — only show during custom wizard */}
        {!isTemplatePicker ? (
          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i <= step ? colors.label : colors.fillSecondary,
                    width: i === step ? 20 : 6,
                  },
                ]}
              />
            ))}
          </View>
        ) : (
          <View />
        )}

        <View style={{ width: 60 }} />
      </View>

      {/* Step content */}
      <View style={styles.content}>
        {isTemplatePicker && (
          <StepTemplates
            onSelectTemplate={handleSelectTemplate}
            onBuildCustom={() => { impactLight(); setStep(0); }}
            loading={templateLoading}
            {...stepProps}
          />
        )}
        {step === 0 && (
          <StepNameDuration
            name={name}
            setName={setName}
            weeks={weeks}
            setWeeks={setWeeks}
            {...stepProps}
          />
        )}
        {step === 1 && (
          <StepDays
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
            {...stepProps}
          />
        )}
        {step === 2 && (
          <StepSessions
            selectedDays={selectedDays}
            sessionMuscles={sessionMuscles}
            setSessionMuscles={setSessionMuscles}
            {...stepProps}
          />
        )}
        {step === 3 && (
          <StepVolume
            sessionMuscles={sessionMuscles}
            volumeOverrides={volumeOverrides}
            setVolumeOverrides={setVolumeOverrides}
            experienceLevel={experienceLevel}
            {...stepProps}
          />
        )}
      </View>

      {/* Bottom CTA — only show during custom wizard */}
      {!isTemplatePicker && (
        <View style={styles.footer}>
          <Button
            label={step === TOTAL_STEPS - 1 ? "Create Mesocycle" : "Continue"}
            onPress={next}
            disabled={!canAdvance()}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { width: 60 },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  content: { flex: 1, paddingHorizontal: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: 8, paddingTop: 12 },

  stepContainer: { flex: 1 },
  textInput: {
    borderWidth: 0.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  pillRow: { flexDirection: "row", gap: 10 },
  pill: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dayPill: {
    width: "13%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexGrow: 1,
  },
  muscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  musclePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  volumeCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  volumeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  volumeField: { alignItems: "center", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
