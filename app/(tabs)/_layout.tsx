import { Tabs } from "expo-router";
import { useColorScheme, Platform, Text } from "react-native";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

// Simple emoji icons — no native modules, always works in Expo Go
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index:    { active: "🏋️", inactive: "🏋️" },
  plan:     { active: "📅", inactive: "📅" },
  progress: { active: "📈", inactive: "📈" },
  profile:  { active: "👤", inactive: "👤" },
};

export default function TabLayout() {
  const rawScheme = useColorScheme();
  const scheme: "light" | "dark" = rawScheme === "light" ? "light" : "dark";
  const colors = Colors[scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.labelTertiary,
        tabBarStyle: {
          backgroundColor: colors.backgroundSecondary,
          borderTopColor: colors.separator,
          borderTopWidth: 0.5,
          paddingBottom: Platform.OS === "ios" ? 0 : 8,
        },
        tabBarLabelStyle: {
          ...Typography.caption2,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20 }}>{focused ? "🏋️" : "🏋️"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20 }}>{focused ? "📅" : "📅"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20 }}>{focused ? "📈" : "📈"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20 }}>{focused ? "🗂️" : "🗂️"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20 }}>{focused ? "👤" : "👤"}</Text>
          ),
        }}
      />
    </Tabs>
  );
}
