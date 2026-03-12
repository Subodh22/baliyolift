import { View, Text, ScrollView, StyleSheet, Switch, Alert, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Row, RowGroup } from "@/components/ui/Row";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
const { useAuth, useUser } = Platform.OS === "web" ? require("@clerk/clerk-react") : require("@clerk/clerk-expo");

export default function ProfileScreen() {
  const { colors, typography } = useTheme();
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [notifications, setNotifications] = useState(true);
  const [resetting, setResetting] = useState(false);
  const { userId } = useCurrentUser();
  const { user } = useUser();
  const deleteAllData = useMutation(api.users.deleteAllUserData);
  const router = useRouter();
  const authHook = useAuth();

  const displayName = user?.fullName ?? user?.firstName ?? "Athlete";
  const imageUrl = user?.imageUrl ?? null;

  const handleResetData = () => {
    if (!userId) {
      Alert.alert("Error", `User not loaded yet (userId=${userId}). Please wait a moment and try again.`);
      return;
    }
    Alert.alert(
      "Reset All Data",
      "This will permanently delete all your workouts, mesocycles, training history, and progress photos. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delete Everything",
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              await deleteAllData({ userId });
              Alert.alert("Done", "All your data has been deleted.");
            } catch (e: any) {
              Alert.alert("Error", e.message ?? "Failed to delete data. Try again.");
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    await authHook.signOut();
    router.replace("/sign-in");
  };

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
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }]}>
              <Text style={[typography.title2, { color: "#FFF" }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[typography.title3, { color: colors.label }]}>{displayName}</Text>
            <Text style={[typography.subheadline, { color: colors.labelSecondary, marginTop: 2 }]}>
              {user?.primaryEmailAddress?.emailAddress ?? ""}
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
        <View style={{ marginTop: 24 }}>
          <Text style={[typography.footnote, { color: colors.labelSecondary, marginBottom: 8 }]}>
            ACCOUNT
          </Text>
          <RowGroup>
            <Row label="Sign Out" onPress={handleSignOut} showChevron={false} />
          </RowGroup>
          <TouchableOpacity
            onPress={handleResetData}
            disabled={resetting}
            activeOpacity={0.7}
            style={[styles.resetBtn, { backgroundColor: "#FF3B3022" }]}
          >
            {resetting ? (
              <ActivityIndicator color="#FF3B30" />
            ) : (
              <Text style={{ color: "#FF3B30", fontWeight: "600", fontSize: 16 }}>
                Reset All Data
              </Text>
            )}
          </TouchableOpacity>
        </View>

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
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  resetBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
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
