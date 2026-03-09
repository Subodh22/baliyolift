import { View, Text, ScrollView, StyleSheet, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Row, RowGroup } from "@/components/ui/Row";

export default function ProfileScreen() {
  const { colors, typography } = useTheme();
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [notifications, setNotifications] = useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 8, marginBottom: 28 }}>
          <Text style={[typography.largeTitle, { color: colors.label }]}>Profile</Text>
        </View>

        {/* User card */}
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.userCard, { backgroundColor: colors.backgroundSecondary }]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[typography.title2, { color: "#FFF" }]}>A</Text>
          </View>
          <View>
            <Text style={[typography.title3, { color: colors.label }]}>Athlete</Text>
            <Text style={[typography.subheadline, { color: colors.labelSecondary }]}>
              Intermediate · 2 years
            </Text>
          </View>
        </Animated.View>

        {/* Training preferences */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 28, marginBottom: 8 }]}>
            TRAINING
          </Text>
          <RowGroup>
            <Row label="Experience Level" value="Intermediate" onPress={() => {}} />
            <Row label="Training Goal" value="Hypertrophy" onPress={() => {}} />
            <Row
              label="Weight Unit"
              value={unit.toUpperCase()}
              onPress={() => setUnit((u) => (u === "kg" ? "lbs" : "kg"))}
            />
          </RowGroup>
        </Animated.View>

        {/* Volume defaults */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 24, marginBottom: 8 }]}>
            VOLUME DEFAULTS
          </Text>
          <RowGroup>
            <Row label="Muscle Volume Targets" onPress={() => {}} />
            <Row label="Auto-suggest deload" value="On" onPress={() => {}} />
          </RowGroup>
        </Animated.View>

        {/* Notifications */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 24, marginBottom: 8 }]}>
            NOTIFICATIONS
          </Text>
          <View style={[styles.switchRow, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[typography.body, { color: colors.label }]}>Workout reminders</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ true: colors.accent, false: colors.fillSecondary }}
              thumbColor="#FFF"
            />
          </View>
        </Animated.View>

        {/* Data */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 24, marginBottom: 8 }]}>
            DATA
          </Text>
          <RowGroup>
            <Row label="Export to CSV" onPress={() => {}} />
            <Row label="Backup & Sync" value="Convex" onPress={() => {}} />
          </RowGroup>
        </Animated.View>

        {/* Danger zone */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[typography.footnote, { color: colors.labelSecondary, marginTop: 24, marginBottom: 8 }]}>
            ACCOUNT
          </Text>
          <RowGroup>
            <Row label="Reset All Data" destructive onPress={() => {}} showChevron={false} />
          </RowGroup>
        </Animated.View>

        {/* Version */}
        <Text style={[typography.caption2, { color: colors.labelQuaternary, textAlign: "center", marginTop: 32 }]}>
          BaliYoLift v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  userCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
});
