import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 40 - 32; // full width minus padding and card padding

// Mock progression data — replace with useQuery(api.sets.getProgressionHistory)
const MOCK_HISTORY = [
  { week: "W1", weight: 70, volume: 280 },
  { week: "W2", weight: 72.5, volume: 304 },
  { week: "W3", weight: 75, volume: 330 },
  { week: "W4", weight: 77.5, volume: 310 },
  { week: "W5", weight: 80, volume: 360 },
];

const MOCK_PRS = [
  { exercise: "Incline Barbell Press", weight: 80, reps: 10, e1rm: 107 },
  { exercise: "Lateral Raise", weight: 18, reps: 15, e1rm: 27 },
  { exercise: "Cable Row", weight: 70, reps: 12, e1rm: 98 },
];

// Simple SVG-free bar chart using View widths
function ProgressChart({
  data,
  colors,
  typography,
}: {
  data: typeof MOCK_HISTORY;
  colors: any;
  typography: any;
}) {
  const maxWeight = Math.max(...data.map((d) => d.weight));
  const minWeight = Math.min(...data.map((d) => d.weight));
  const range = maxWeight - minWeight || 1;

  const barWidth = (CHART_WIDTH - (data.length - 1) * 8) / data.length;
  const chartHeight = 80;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartHeight, gap: 8 }}>
        {data.map((d, i) => {
          const heightPct = 0.3 + ((d.weight - minWeight) / range) * 0.7;
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
              <View
                style={{
                  width: "100%",
                  height: chartHeight * heightPct,
                  backgroundColor: isLast ? colors.accent : colors.fillPrimary,
                  borderRadius: 4,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={[
              typography.caption2,
              { color: colors.labelTertiary, flex: 1, textAlign: "center" },
            ]}
          >
            {d.week}
          </Text>
        ))}
      </View>
    </View>
  );
}

function PRCard({
  pr,
  colors,
  typography,
}: {
  pr: (typeof MOCK_PRS)[0];
  colors: any;
  typography: any;
}) {
  return (
    <View style={[prStyles.card, { backgroundColor: colors.backgroundSecondary }]}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
          {pr.exercise}
        </Text>
        <Text style={[typography.caption1, { color: colors.labelSecondary, marginTop: 2 }]}>
          {pr.weight} kg × {pr.reps} reps
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[typography.numericMedium, { color: colors.accent }]}>
          {pr.e1rm}
        </Text>
        <Text style={[typography.caption2, { color: colors.labelTertiary }]}>
          est. 1RM
        </Text>
      </View>
    </View>
  );
}

const prStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
});

export default function ProgressScreen() {
  const { colors, typography } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 8, marginBottom: 24 }}>
          <Text style={[typography.largeTitle, { color: colors.label }]}>Progress</Text>
        </View>

        {/* Strength chart */}
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={[typography.headline, { color: colors.label }]}>
              Incline Press
            </Text>
            <Text style={[typography.caption1, { color: colors.labelSecondary }]}>
              Weight (kg)
            </Text>
          </View>
          <ProgressChart data={MOCK_HISTORY} colors={colors} typography={typography} />

          <View style={[styles.statRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: colors.separator }]}>
            <View style={styles.stat}>
              <Text style={[typography.numericMedium, { color: colors.label }]}>+10</Text>
              <Text style={[typography.caption2, { color: colors.labelSecondary }]}>kg this meso</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[typography.numericMedium, { color: colors.label }]}>107</Text>
              <Text style={[typography.caption2, { color: colors.labelSecondary }]}>est. 1RM</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[typography.numericMedium, { color: colors.accent }]}>80</Text>
              <Text style={[typography.caption2, { color: colors.labelSecondary }]}>top set</Text>
            </View>
          </View>
        </Animated.View>

        {/* Personal Records */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 28, marginBottom: 12 }]}>
            PERSONAL RECORDS
          </Text>
          {MOCK_PRS.map((pr, i) => (
            <PRCard key={i} pr={pr} colors={colors} typography={typography} />
          ))}
        </Animated.View>

        {/* Total volume this meso */}
        <Animated.View
          entering={FadeInDown.delay(160).springify()}
          style={[styles.card, { backgroundColor: colors.backgroundSecondary, marginTop: 16 }]}
        >
          <Text style={[typography.headline, { color: colors.label, marginBottom: 16 }]}>
            Meso Summary
          </Text>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={[typography.numericMedium, { color: colors.label }]}>9</Text>
              <Text style={[typography.caption2, { color: colors.labelSecondary }]}>workouts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[typography.numericMedium, { color: colors.label }]}>164</Text>
              <Text style={[typography.caption2, { color: colors.labelSecondary }]}>total sets</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[typography.numericMedium, { color: colors.label }]}>24k</Text>
              <Text style={[typography.caption2, { color: colors.labelSecondary }]}>kg volume</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 20 },
  statRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 4 },
});
