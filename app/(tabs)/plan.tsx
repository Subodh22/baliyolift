import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/Button";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { api } from "@/convex/_generated/api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WeekProgress({ current, total, colors }: any) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            weekStyles.segment,
            {
              backgroundColor:
                i < current - 1
                  ? colors.accent
                  : i === current - 1
                  ? colors.label
                  : colors.fillSecondary,
              flex: 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

const weekStyles = StyleSheet.create({
  segment: { height: 4, borderRadius: 2 },
});

export default function PlanScreen() {
  const { colors, typography } = useTheme();
  const { userId, loading: userLoading } = useCurrentUser();

  const meso = useQuery(
    api.mesocycles.getActiveWithDetails,
    userId ? { userId } : "skip"
  );

  const completeMeso = useMutation(api.mesocycles.complete);
  const deleteAllMesos = useMutation(api.mesocycles.deleteAllForUser);

  const isLoading = userLoading || meso === undefined;

  const handleEndMeso = async () => {
    if (!meso) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await completeMeso({ mesocycleId: meso._id });
  };

  const handleReset = async () => {
    if (!userId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteAllMesos({ userId });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[typography.largeTitle, { color: colors.label }]}>Plan</Text>
          <TouchableOpacity onPress={() => router.push("/meso/new")} activeOpacity={0.7}>
            <Text style={[typography.body, { color: colors.accent }]}>New meso</Text>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {/* No active meso */}
        {!isLoading && !meso && (
          <Animated.View
            entering={FadeInDown.springify()}
            style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
          >
            <Text style={[typography.title3, { color: colors.label, marginBottom: 8 }]}>
              No active mesocycle
            </Text>
            <Text style={[typography.body, { color: colors.labelSecondary, marginBottom: 20 }]}>
              A mesocycle is a structured training block designed to progressively overload your muscles over 4–6 weeks.
            </Text>
            <Button label="Create Mesocycle" onPress={() => router.push("/meso/new")} />
          </Animated.View>
        )}

        {/* Active meso */}
        {!isLoading && meso && (
          <>
            {/* Meso card */}
            <Animated.View
              entering={FadeInDown.springify()}
              style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
            >
              <View style={styles.mesoHeader}>
                <View style={[styles.activeBadge, { backgroundColor: colors.accentGreen + "22" }]}>
                  <Text style={[typography.caption2, { color: colors.accentGreen, fontWeight: "700" }]}>
                    ACTIVE
                  </Text>
                </View>
              </View>

              <Text style={[typography.title2, { color: colors.label, marginBottom: 4 }]}>
                {meso.name}
              </Text>
              <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>
                Week {meso.weekNumber} of {meso.weeks}
              </Text>

              <WeekProgress
                current={meso.weekNumber}
                total={meso.weeks}
                colors={colors}
              />
            </Animated.View>

            {/* Sessions — full exercise list */}
            <Animated.View entering={FadeInDown.delay(80).springify()}>
              <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 24, marginBottom: 12 }]}>
                ALL SESSIONS
              </Text>
              <View style={{ gap: 10 }}>
                {meso.sessions.map((session) => (
                  <View
                    key={session._id}
                    style={[styles.sessionCard, { backgroundColor: colors.backgroundSecondary }]}
                  >
                    {/* Session header */}
                    <View style={styles.sessionRow}>
                      <View style={[styles.dayBadge, { backgroundColor: colors.fillSecondary }]}>
                        <Text style={[typography.caption1, { color: colors.label, fontWeight: "700" }]}>
                          {DAY_LABELS[session.dayOfWeek]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.headline, { color: colors.label }]}>
                          {session.name}
                        </Text>
                        <Text style={[typography.caption1, { color: colors.labelSecondary, marginTop: 2 }]}>
                          {session.muscleGroups
                            .map((m) => MUSCLE_DISPLAY_NAMES[m as keyof typeof MUSCLE_DISPLAY_NAMES] ?? m)
                            .join(" · ")}
                        </Text>
                      </View>
                    </View>

                    {/* Exercise list */}
                    {session.exercises && session.exercises.length > 0 && (
                      <View style={[styles.exerciseList, { borderTopColor: colors.separator }]}>
                        {session.exercises.map((ex: any, i: number) => (
                          <View key={ex.id ?? i} style={styles.exRow}>
                            <View style={[styles.exDot, { backgroundColor: colors.accent }]} />
                            <Text style={[typography.subheadline, { color: colors.label, flex: 1 }]}>
                              {ex.name}
                            </Text>
                            <Text style={[typography.caption1, { color: colors.labelTertiary }]}>
                              {MUSCLE_DISPLAY_NAMES[ex.muscleGroup as keyof typeof MUSCLE_DISPLAY_NAMES] ?? ex.muscleGroup}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {meso.sessions.length === 0 && (
                  <Text style={[typography.body, { color: colors.labelSecondary }]}>
                    No sessions set up yet.
                  </Text>
                )}
              </View>
            </Animated.View>

            {/* Volume targets */}
            {meso.volumeTargets.length > 0 && (
              <Animated.View entering={FadeInDown.delay(160).springify()}>
                <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 28, marginBottom: 12 }]}>
                  VOLUME LANDMARKS
                </Text>
                <View style={[styles.card, { backgroundColor: colors.backgroundSecondary, gap: 14 }]}>
                  {meso.volumeTargets.map((vt) => (
                    <View key={vt.muscleGroup} style={styles.vtRow}>
                      <Text style={[typography.subheadline, { color: colors.label, flex: 1 }]}>
                        {MUSCLE_DISPLAY_NAMES[vt.muscleGroup as keyof typeof MUSCLE_DISPLAY_NAMES] ?? vt.muscleGroup}
                      </Text>
                      <View style={styles.vtNumbers}>
                        <Text style={[typography.caption1, { color: colors.volumeLow }]}>{vt.mev}</Text>
                        <Text style={[typography.caption1, { color: colors.labelTertiary }]}> / </Text>
                        <Text style={[typography.caption1, { color: colors.accent }]}>{vt.mav}</Text>
                        <Text style={[typography.caption1, { color: colors.labelTertiary }]}> / </Text>
                        <Text style={[typography.caption1, { color: colors.volumeHigh }]}>{vt.mrv}</Text>
                      </View>
                    </View>
                  ))}
                  <View style={{ flexDirection: "row", gap: 16, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
                    {[
                      { color: colors.volumeLow, label: "MEV" },
                      { color: colors.accent, label: "MAV" },
                      { color: colors.volumeHigh, label: "MRV" },
                    ].map(({ color, label }) => (
                      <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                        <Text style={[typography.caption2, { color: colors.labelSecondary }]}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Actions */}
            <Animated.View entering={FadeInDown.delay(240).springify()} style={{ marginTop: 24, gap: 10 }}>
              <Button label="End Mesocycle" onPress={handleEndMeso} variant="secondary" />
              <TouchableOpacity
                onPress={handleReset}
                style={{ alignItems: "center", paddingVertical: 12 }}
                activeOpacity={0.7}
              >
                <Text style={[typography.caption1, { color: colors.labelTertiary }]}>
                  Delete & start over with a template
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 8,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  card: {
    borderRadius: 20,
    padding: 20,
  },
  mesoHeader: { flexDirection: "row", marginBottom: 12 },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionCard: {
    borderRadius: 14,
    overflow: "hidden",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  exerciseList: {
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  exRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  vtRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  vtNumbers: { flexDirection: "row", alignItems: "center" },
});
