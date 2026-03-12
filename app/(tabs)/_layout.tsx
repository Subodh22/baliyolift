import { Tabs } from "expo-router";
import { useColorScheme, Platform, View } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

const TABS = [
  { name: "index",    title: "Today",    icon: "sun"        },
  { name: "plan",     title: "Plan",     icon: "calendar"   },
  { name: "progress", title: "Progress", icon: "trending-up"},
  { name: "history",  title: "History",  icon: "clock"      },
  { name: "profile",  title: "Profile",  icon: "user"       },
] as const;

export default function TabLayout() {
  const rawScheme = useColorScheme();
  const scheme: "light" | "dark" = rawScheme === "light" ? "light" : "dark";
  const colors = Colors[scheme];
  const isDark = scheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.labelTertiary,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "ios" ? 80 : 68,
          backgroundColor: "transparent",
        },
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={{
              flex: 1,
              borderTopWidth: 0.5,
              borderTopColor: colors.separator,
            }}
          />
        ),
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused, color }) => (
              <View style={{ alignItems: "center", gap: 5 }}>
                <Feather
                  name={icon}
                  size={22}
                  color={color}
                  strokeWidth={focused ? 2 : 1.5}
                />
                {/* Accent dot for active tab only */}
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: focused ? colors.accent : "transparent",
                  }}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
