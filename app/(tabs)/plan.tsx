import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import { router } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { notificationSuccess } from "@/utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/Button";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { api } from "@/convex/_generated/api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PlanScreen() {
  const { colors } = useTheme();
  const { userId, loading: userLoading } = useCurrentUser();
  const meso = useQuery(api.mesocycles.getActiveWithDetails, userId ? { userId } : "skip");
  const completeMeso = useMutation(api.mesocycles.complete);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const isLoading = userLoading || meso === undefined;

  const handleEndMeso = async () => {
    if (!meso || ending) return;
    setEnding(true);
    try { notificationSuccess(); await completeMeso({ mesocycleId: meso._id }); }
    finally { setEnding(false); setConfirmEnd(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={[s.screenLabel, { color: colors.labelSecondary }]}>Your program</Text>
            <Text style={[s.heroItalic, { color: colors.label }]}>Mesocycle plan.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/meso/new")} activeOpacity={0.7}
            style={[s.newBtn, { backgroundColor: colors.fillSecondary, borderColor: colors.separator }]}
          >
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.accent }}>+ New</Text>
          </TouchableOpacity>
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {/* Empty */}
        {!isLoading && !meso && (
          <Animated.View entering={FadeInDown.springify()}
            style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
          >
            <Text style={[s.cardTitle, { color: colors.label }]}>No active mesocycle</Text>
            <Text style={{ fontFamily: "Inter_300Light", fontSize: 14, color: colors.labelSecondary, marginTop: 8, lineHeight: 22 }}>
              A mesocycle is a structured training block designed to progressively overload your muscles over 4–6 weeks.
            </Text>
            <View style={{ marginTop: 20 }}>
              <Button label="Create Mesocycle" onPress={() => router.push("/meso/new")} />
            </View>
          </Animated.View>
        )}

        {/* Active meso */}
        {!isLoading && meso && (
          <>
            {/* Meso overview card */}
            <Animated.View entering={FadeInDown.springify()}
              style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={[s.activePill, { backgroundColor: colors.accentLight }]}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.accent, letterSpacing: 0.8 }}>ACTIVE</Text>
                  </View>
                  <Text style={[s.cardTitle, { color: colors.label, marginTop: 10 }]}>{meso.name}</Text>
                  <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.labelSecondary, marginTop: 4 }}>
                    Week {meso.weekNumber} of {meso.weeks}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 32, color: colors.label, letterSpacing: -1 }}>
                  {meso.weekNumber}/{meso.weeks}
                </Text>
              </View>

              {/* Week progress bar */}
              <View style={{ marginTop: 16 }}>
                <View style={{ height: 2, borderRadius: 1, backgroundColor: colors.fillSecondary }}>
                  <View style={{ height: 2, borderRadius: 1, backgroundColor: colors.accent, width: `${((meso.weekNumber - 1) / meso.weeks) * 100}%` }} />
                </View>
              </View>
            </Animated.View>

            {/* Sessions */}
            <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginTop: 28 }}>
              <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>All sessions</Text>
              <View style={{ gap: 8, marginTop: 12 }}>
                {meso.sessions.map((session) => (
                  <View key={session._id}
                    style={[s.sessionCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
                  >
                    <View style={s.sessionRow}>
                      <View style={[s.dayBadge, { backgroundColor: colors.fillSecondary }]}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.labelSecondary }}>
                          {DAY_LABELS[session.dayOfWeek]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: colors.label }}>{session.name}</Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelSecondary, marginTop: 2 }}>
                          {session.muscleGroups.map(m => MUSCLE_DISPLAY_NAMES[m as keyof typeof MUSCLE_DISPLAY_NAMES] ?? m).join(" · ")}
                        </Text>
                      </View>
                    </View>
                    {session.exercises && session.exercises.length > 0 && (
                      <View style={[s.exerciseList, { borderTopColor: colors.separator }]}>
                        {session.exercises.map((ex: any, i: number) => (
                          <View key={ex.id ?? i} style={s.exRow}>
                            <View style={[s.exDot, { backgroundColor: colors.accent }]} />
                            <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.label, flex: 1 }}>{ex.name}</Text>
                            <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelTertiary }}>
                              {MUSCLE_DISPLAY_NAMES[ex.muscleGroup as keyof typeof MUSCLE_DISPLAY_NAMES] ?? ex.muscleGroup}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Volume landmarks */}
            {meso.volumeTargets.length > 0 && (
              <Animated.View entering={FadeInDown.delay(160).springify()} style={{ marginTop: 28 }}>
                <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Volume landmarks</Text>
                <View style={[s.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator, marginTop: 12, gap: 14 }]}>
                  {meso.volumeTargets.map((vt) => (
                    <View key={vt.muscleGroup} style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ fontFamily: "Inter_300Light", fontSize: 14, color: colors.label, flex: 1 }}>
                        {MUSCLE_DISPLAY_NAMES[vt.muscleGroup as keyof typeof MUSCLE_DISPLAY_NAMES] ?? vt.muscleGroup}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.volumeLow }}>{vt.mev}</Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelTertiary }}> / </Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.accent }}>{vt.mav}</Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.labelTertiary }}> / </Text>
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 12, color: colors.volumeHigh }}>{vt.mrv}</Text>
                      </View>
                    </View>
                  ))}
                  <View style={{ flexDirection: "row", gap: 16, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
                    {[{ c: colors.volumeLow, l: "MEV" }, { c: colors.accent, l: "MAV" }, { c: colors.volumeHigh, l: "MRV" }].map(({ c, l }) => (
                      <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <View style={{ width: 8, height: 2, borderRadius: 1, backgroundColor: c }} />
                        <Text style={{ fontFamily: "Inter_300Light", fontSize: 11, color: colors.labelSecondary }}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* End meso */}
            <Animated.View entering={FadeInDown.delay(240).springify()} style={{ marginTop: 28 }}>
              {confirmEnd ? (
                <View style={[s.confirmBox, { backgroundColor: "#B8303010", borderColor: "#B8303040" }]}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: colors.label, marginBottom: 4 }}>End this mesocycle?</Text>
                  <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.labelSecondary, marginBottom: 16, lineHeight: 20 }}>
                    Your training history is saved. You can start a new mesocycle after.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable onPress={() => setConfirmEnd(false)}
                      style={[s.confirmBtn, { backgroundColor: colors.fillSecondary, flex: 1 }]}
                    >
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.label }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleEndMeso} style={[s.confirmBtn, { backgroundColor: "#B83030", flex: 1 }]}>
                      {ending ? <ActivityIndicator color="#fff" /> : (
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#fff" }}>End</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Button label="End Mesocycle" onPress={() => setConfirmEnd(true)} variant="secondary" />
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:      { paddingHorizontal: 20, paddingBottom: 100 },
  header:      { marginTop: 16, marginBottom: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  screenLabel: { fontFamily: "Inter_300Light", fontSize: 13, letterSpacing: 0.1 },
  heroItalic:  { fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 34, fontWeight: "400", letterSpacing: -0.3, lineHeight: 42, marginTop: 6 },
  newBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  sectionLabel:{ fontFamily: "Inter_400Regular", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  card:        { borderRadius: 20, padding: 20, borderWidth: 1 },
  cardTitle:   { fontFamily: "Inter_500Medium", fontSize: 18, letterSpacing: -0.2 },
  activePill:  { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  sessionCard: { borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  sessionRow:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  dayBadge:    { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  exerciseList:{ borderTopWidth: 0.5, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 8 },
  exRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  exDot:       { width: 4, height: 4, borderRadius: 2 },
  confirmBox:  { borderRadius: 16, borderWidth: 1, padding: 20 },
  confirmBtn:  { borderRadius: 100, paddingVertical: 13, alignItems: "center" },
});
