import { View, Text, ScrollView, StyleSheet, Switch, ActivityIndicator, TouchableOpacity, Image, Pressable, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMemo, useState } from "react";
import { Row, RowGroup } from "@/components/ui/Row";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "expo-router";
import { P } from "@/constants/colors";
import { CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import { calcTargetsForGoal, GOAL_LABEL, type Goal } from "@/utils/nutritionTargets";
import { usePostHog } from "posthog-react-native";
import { captureError, sentryEnabled } from "@/utils/monitoring";

const GOAL_OPTIONS: { goal: Goal; blurb: string }[] = [
  { goal: "cut",      blurb: "Lose fat — calories set below maintenance." },
  { goal: "maintain", blurb: "Hold weight — calories at maintenance." },
  { goal: "bulk",     blurb: "Build muscle — calories above maintenance." },
];

const { useAuth, useUser } = Platform.OS === "web"
  ? require("@clerk/clerk-react")
  : require("@clerk/clerk-expo");

export default function ProfileScreen() {
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [notifications, setNotifications] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const { userId } = useCurrentUser();
  const { user } = useUser();
  const deleteAllData = useMutation(api.users.deleteAllUserData);
  const saveFoodTarget = useMutation(api.nutrition.saveFoodTarget);
  const profile = useQuery(api.userProfile.getByUser, userId ? { userId } : "skip");
  const foodTarget = useQuery(api.nutrition.getFoodTarget, userId ? { userId } : "skip");
  const latestWeight = useQuery(api.weightTracking.getLatestWeight, userId ? { userId } : "skip");
  const router = useRouter();
  const authHook = useAuth();
  const posthog = usePostHog();
  const [monitorMsg, setMonitorMsg] = useState<string | null>(null);

  const handleTestError = () => {
    captureError(new Error("Baliyo test error — from Profile → Developer"), {
      source: "profile.dev.testButton",
      userId: userId ?? "anonymous",
    });
    setMonitorMsg(
      sentryEnabled
        ? "Sent test error to Sentry ✓"
        : "Sentry has no DSN — logged to console only."
    );
  };

  const handleTestEvent = () => {
    posthog?.capture("dev_test_event", { source: "profile.dev.testButton" });
    setMonitorMsg(
      posthog
        ? "Sent 'dev_test_event' to PostHog ✓ (may take ~1 min to appear)"
        : "PostHog not configured."
    );
  };

  const currentGoal: Goal = foodTarget?.goal ?? "maintain";
  const targetProfile = useMemo(
    () => profile ? { ...profile, weightKg: latestWeight?.weightKg ?? profile.weightKg } : null,
    [profile, latestWeight?.weightKg]
  );

  const handleSelectGoal = async (goal: Goal) => {
    if (!userId || !targetProfile) { setGoalPickerOpen(false); return; }
    setSavingGoal(true);
    try {
      const targets = calcTargetsForGoal(targetProfile, goal);
      await saveFoodTarget({ userId, ...targets });
    } catch (e: any) {
      console.log("Goal update error:", e.message);
    } finally {
      setSavingGoal(false);
      setGoalPickerOpen(false);
    }
  };

  const displayName = user?.fullName ?? user?.firstName ?? "Athlete";
  const imageUrl    = user?.imageUrl ?? null;

  const goalValue = profile
    ? profile.targetDate
      ? `${profile.targetBf}% · ${new Date(profile.targetDate).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`
      : `${profile.targetBf}%`
    : "—";

  const handleConfirmReset = async () => {
    if (!userId) return;
    setResetting(true);
    setConfirmReset(false);
    try { await deleteAllData({ userId }); }
    catch (e: any) { console.log("Reset error:", e.message); }
    finally { setResetting(false); }
  };

  const handleSignOut = async () => {
    await authHook.signOut();
    router.replace("/sign-in");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>YOUR ACCOUNT</Text>
          <Text style={s.heroItalic}>Profile.</Text>
        </View>

        {/* User card */}
        <Animated.View entering={FadeInDown.springify()} style={s.userCard}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: P.goldDim, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ fontFamily: OUT, fontSize: 20, color: P.gold }}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: OUT, fontSize: 17, color: P.ink }}>{displayName}</Text>
            <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid, marginTop: 2 }}>
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </Text>
          </View>
        </Animated.View>

        {/* Training */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <Text style={s.sectionLabel}>TRAINING</Text>
          <RowGroup>
            <Row label="Experience Level" value="Intermediate" onPress={() => {}} />
            <Row label="Training Goal" value="Hypertrophy" onPress={() => {}} />
            <Row label="Weight Unit" value={unit.toUpperCase()} onPress={() => setUnit(u => u === "kg" ? "lbs" : "kg")} />
          </RowGroup>
        </Animated.View>

        {/* Volume defaults */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Text style={s.sectionLabel}>VOLUME DEFAULTS</Text>
          <RowGroup>
            <Row label="Muscle Volume Targets" onPress={() => {}} />
            <Row label="Auto-suggest deload" value="On" onPress={() => {}} />
          </RowGroup>
        </Animated.View>

        {/* Notifications */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
          <View style={s.switchRow}>
            <Text style={{ fontFamily: OUT, fontSize: 15, color: P.ink }}>Workout reminders</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ true: P.gold, false: P.s2 }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Animated.View>

        {/* Goal & Roadmap */}
        <Animated.View entering={FadeInDown.delay(210).springify()}>
          <Text style={s.sectionLabel}>GOAL</Text>
          <RowGroup>
            <Row
              label="Goal & Roadmap"
              value={goalValue}
              onPress={() => router.push("/onboarding")}
            />
            <Row
              label="Restart Onboarding"
              onPress={() => router.push("/onboarding")}
            />
          </RowGroup>
        </Animated.View>

        {/* Nutrition */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <Text style={s.sectionLabel}>NUTRITION</Text>
          <RowGroup>
            <Row
              label="Nutrition Goal"
              value={foodTarget ? GOAL_LABEL[currentGoal] : "—"}
              onPress={() => setGoalPickerOpen(true)}
            />
            <Row label="Meal Plans" value="25 recipes" onPress={() => router.push("/meal-plans")} />
          </RowGroup>
        </Animated.View>

        {/* Data */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={s.sectionLabel}>DATA</Text>
          <RowGroup>
            <Row label="Export to CSV" onPress={() => {}} />
            <Row label="Backup & Sync" value="Convex" onPress={() => {}} />
          </RowGroup>
        </Animated.View>

        {/* Account */}
        <Animated.View entering={FadeInDown.delay(360).springify()}>
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <RowGroup>
            <Row label="Sign Out" onPress={handleSignOut} showChevron={false} />
          </RowGroup>

          {confirmReset ? (
            <View style={s.confirmBox}>
              <Text style={{ fontFamily: OUT, fontSize: 15, color: P.ink, marginBottom: 6 }}>Delete all data?</Text>
              <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid, marginBottom: 20, lineHeight: 20 }}>
                This permanently deletes all workouts, mesocycles, and progress photos. Cannot be undone.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => setConfirmReset(false)}
                  style={[s.confirmBtn, { backgroundColor: P.s2, flex: 1 }]}
                >
                  <Text style={{ fontFamily: OUT, fontSize: 14, color: P.ink }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleConfirmReset} style={[s.confirmBtn, { backgroundColor: P.red, flex: 1 }]}>
                  {resetting ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ fontFamily: OUT, fontSize: 14, color: "#FFF" }}>Delete forever</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmReset(true)}
              style={({ pressed }) => [s.resetBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ fontFamily: OUT, fontSize: 15, color: P.red }}>Reset all data</Text>
            </Pressable>
          )}
        </Animated.View>

        {__DEV__ && (
          <Animated.View entering={FadeInDown.delay(420).springify()}>
            <Text style={s.sectionLabel}>DEVELOPER</Text>
            <RowGroup>
              <Row label="Send test error (Sentry)" onPress={handleTestError} showChevron={false} />
              <Row label="Send test event (PostHog)" onPress={handleTestEvent} showChevron={false} />
            </RowGroup>
            {!!monitorMsg && (
              <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid, marginTop: 10, lineHeight: 18 }}>
                {monitorMsg}
              </Text>
            )}
          </Animated.View>
        )}

        <Text style={{ fontFamily: OUT_L, fontSize: 11, letterSpacing: 2, color: P.dim, textAlign: "center", marginTop: 32 }}>
          BALIYO v1.0.0
        </Text>
      </ScrollView>

      {/* Nutrition goal picker */}
      <Modal visible={goalPickerOpen} transparent animationType="slide" onRequestClose={() => setGoalPickerOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setGoalPickerOpen(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>NUTRITION GOAL</Text>
          <Text style={s.sheetDesc}>
            Pick what you're doing right now. Your daily calories and macros recalculate from your profile.
          </Text>
          {GOAL_OPTIONS.map(({ goal, blurb }) => {
            const active = goal === currentGoal;
            return (
              <TouchableOpacity
                key={goal}
                onPress={() => handleSelectGoal(goal)}
                disabled={savingGoal || !profile}
                activeOpacity={0.7}
                style={[s.goalOption, active && s.goalOptionActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.goalOptionLabel, active && { color: P.gold }]}>{GOAL_LABEL[goal]}</Text>
                  <Text style={s.goalOptionBlurb}>{blurb}</Text>
                </View>
                {active && <Text style={s.goalCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
          {!profile && (
            <Text style={s.goalHint}>Complete onboarding first to set your targets.</Text>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:      { paddingHorizontal: 24, paddingBottom: 100, gap: 24 },
  header:      { marginTop: 16 },
  eyebrow:     { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:  { fontFamily: CG_ITALIC, fontSize: 52, letterSpacing: -0.5, lineHeight: 58, marginTop: 10, color: P.ink },
  sectionLabel:{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, textTransform: "uppercase", marginBottom: 10 },
  userCard:    { backgroundColor: P.s1, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, borderWidth: 1, borderColor: P.border },
  avatar:      { width: 52, height: 52, borderWidth: 1, borderColor: P.border, overflow: "hidden" },
  switchRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: P.s1, borderWidth: 1, borderColor: P.border },
  confirmBox:  { borderWidth: 1, borderColor: P.red + "40", backgroundColor: P.red + "10", padding: 20, marginTop: 8 },
  confirmBtn:  { paddingVertical: 13, alignItems: "center" },
  resetBtn:    { borderWidth: 1, borderColor: P.red + "30", paddingVertical: 16, alignItems: "center", marginTop: 8 },

  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:           { backgroundColor: P.s1, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: P.border },
  sheetHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: P.border, alignSelf: "center", marginBottom: 20 },
  sheetTitle:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, marginBottom: 8 },
  sheetDesc:       { fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 19, marginBottom: 20 },
  goalOption:      { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: P.border, borderRadius: 10, marginBottom: 10, backgroundColor: P.s2 },
  goalOptionActive:{ borderColor: P.gold, backgroundColor: "rgba(201,168,76,0.10)" },
  goalOptionLabel: { fontFamily: OUT, fontSize: 16, color: P.ink },
  goalOptionBlurb: { fontFamily: OUT_L, fontSize: 12, color: P.mid, marginTop: 3, lineHeight: 17 },
  goalCheck:       { fontFamily: OUT, fontSize: 16, color: P.gold, marginLeft: 12 },
  goalHint:        { fontFamily: OUT_L, fontSize: 12, color: P.dim, textAlign: "center", marginTop: 4 },
});
