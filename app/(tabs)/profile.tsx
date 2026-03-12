import { View, Text, ScrollView, StyleSheet, Switch, ActivityIndicator, TouchableOpacity, Image, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Row, RowGroup } from "@/components/ui/Row";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "expo-router";

const { useAuth, useUser } = Platform.OS === "web"
  ? require("@clerk/clerk-react")
  : require("@clerk/clerk-expo");

export default function ProfileScreen() {
  const { colors } = useTheme();
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [notifications, setNotifications] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { userId } = useCurrentUser();
  const { user } = useUser();
  const deleteAllData = useMutation(api.users.deleteAllUserData);
  const router = useRouter();
  const authHook = useAuth();

  const displayName = user?.fullName ?? user?.firstName ?? "Athlete";
  const imageUrl    = user?.imageUrl ?? null;

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={[s.screenLabel, { color: colors.labelSecondary }]}>Your account</Text>
          <Text style={[s.heroItalic, { color: colors.label }]}>Profile.</Text>
        </View>

        {/* User card */}
        <Animated.View entering={FadeInDown.springify()}
          style={[s.userCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 20, color: colors.accent }}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 17, color: colors.label }}>{displayName}</Text>
            <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.labelSecondary, marginTop: 2 }}>
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </Text>
          </View>
        </Animated.View>

        {/* Training */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Training</Text>
          <RowGroup>
            <Row label="Experience Level" value="Intermediate" onPress={() => {}} />
            <Row label="Training Goal" value="Hypertrophy" onPress={() => {}} />
            <Row label="Weight Unit" value={unit.toUpperCase()} onPress={() => setUnit(u => u === "kg" ? "lbs" : "kg")} />
          </RowGroup>
        </Animated.View>

        {/* Volume defaults */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Volume defaults</Text>
          <RowGroup>
            <Row label="Muscle Volume Targets" onPress={() => {}} />
            <Row label="Auto-suggest deload" value="On" onPress={() => {}} />
          </RowGroup>
        </Animated.View>

        {/* Notifications */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Notifications</Text>
          <View style={[s.switchRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: colors.label }}>Workout reminders</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ true: colors.accent, false: colors.fillSecondary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Animated.View>

        {/* Data */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Data</Text>
          <RowGroup>
            <Row label="Export to CSV" onPress={() => {}} />
            <Row label="Backup & Sync" value="Convex" onPress={() => {}} />
          </RowGroup>
        </Animated.View>

        {/* Account */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[s.sectionLabel, { color: colors.labelSecondary }]}>Account</Text>
          <RowGroup>
            <Row label="Sign Out" onPress={handleSignOut} showChevron={false} />
          </RowGroup>

          {confirmReset ? (
            <View style={[s.confirmBox, { backgroundColor: "#B8303010", borderColor: "#B8303040" }]}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: colors.label, marginBottom: 6 }}>Delete all data?</Text>
              <Text style={{ fontFamily: "Inter_300Light", fontSize: 13, color: colors.labelSecondary, marginBottom: 20, lineHeight: 20 }}>
                This permanently deletes all workouts, mesocycles, and progress photos. Cannot be undone.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => setConfirmReset(false)}
                  style={[s.confirmBtn, { backgroundColor: colors.fillSecondary, flex: 1 }]}
                >
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.label }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleConfirmReset} style={[s.confirmBtn, { backgroundColor: "#B83030", flex: 1 }]}>
                  {resetting ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#fff" }}>Delete forever</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmReset(true)}
              style={({ pressed }) => [s.resetBtn, { backgroundColor: pressed ? "#B8303030" : "#B8303015" }]}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#B83030" }}>Reset all data</Text>
            </Pressable>
          )}
        </Animated.View>

        <Text style={{ fontFamily: "Inter_300Light", fontSize: 11, color: colors.labelQuaternary, textAlign: "center", marginTop: 32 }}>
          BaliYoLift v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:      { paddingHorizontal: 20, paddingBottom: 100, gap: 24 },
  header:      { marginTop: 16 },
  screenLabel: { fontFamily: "Inter_300Light", fontSize: 13, letterSpacing: 0.1 },
  heroItalic:  { fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 34, fontWeight: "400", letterSpacing: -0.3, lineHeight: 42, marginTop: 6 },
  sectionLabel:{ fontFamily: "Inter_400Regular", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 },
  userCard:    { borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, borderWidth: 1 },
  avatar:      { width: 52, height: 52, borderRadius: 26, overflow: "hidden" },
  switchRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1 },
  confirmBox:  { borderRadius: 16, borderWidth: 1, padding: 20 },
  confirmBtn:  { borderRadius: 100, paddingVertical: 13, alignItems: "center" },
  resetBtn:    { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 },
});
