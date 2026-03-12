import { Tabs } from "expo-router";
import { Platform, View, Text } from "react-native";
import { BlurView } from "expo-blur";
import { P } from "@/constants/colors";

const TABS = [
  { name: "index",    label: "HOME",    symbol: "⌂" },
  { name: "plan",     label: "TRAIN",   symbol: "◫" },
  { name: "progress", label: "STATS",   symbol: "◈" },
  { name: "history",  label: "LOG",     symbol: "◷" },
  { name: "profile",  label: "PROFILE", symbol: "◎" },
] as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 1,
          borderTopColor: P.border,
          elevation: 0,
          height: Platform.OS === "ios" ? 72 : 60,
          backgroundColor: "transparent",
        },
        tabBarBackground: () => (
          <BlurView
            intensity={60}
            tint="dark"
            style={{ flex: 1, backgroundColor: "rgba(10,10,11,0.92)" }}
          />
        ),
      }}
    >
      {TABS.map(({ name, label, symbol }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarIcon: ({ focused }) => (
              <View style={{ alignItems: "center", gap: 4, paddingTop: 8 }}>
                <Text style={{
                  fontSize: 14,
                  color: focused ? P.gold : P.mid,
                  fontFamily: "Outfit_300Light",
                }}>
                  {symbol}
                </Text>
                <Text style={{
                  fontFamily: "Outfit_300Light",
                  fontSize: 9,
                  letterSpacing: 2.5,
                  color: focused ? P.gold : P.mid,
                }}>
                  {label}
                </Text>
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
