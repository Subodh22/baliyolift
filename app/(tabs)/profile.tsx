import { View, Text, ScrollView, StyleSheet, Switch, ActivityIndicator, TouchableOpacity, Image, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import { Row, RowGroup } from "@/components/ui/Row";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "expo-router";
import { P } from "@/constants/colors";
import { CG_ITALIC, OUT_L, OUT } from "@/constants/typography";

const { useAuth, useUser } = Platform.OS === "web"
  ? require("@clerk/clerk-react")
  : require("@clerk/clerk-expo");

export default function ProfileScreen() {
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

        {/* Nutrition */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <Text style={s.sectionLabel}>NUTRITION</Text>
          <RowGroup>
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

        <Text style={{ fontFamily: OUT_L, fontSize: 11, letterSpacing: 2, color: P.dim, textAlign: "center", marginTop: 32 }}>
          BALIYO v1.0.0
        </Text>
      </ScrollView>
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
});
