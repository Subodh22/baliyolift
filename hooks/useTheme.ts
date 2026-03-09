import { useColorScheme } from "react-native";
import { Colors, ColorToken } from "@/constants/colors";
import { Typography } from "@/constants/typography";

export function useTheme() {
  const rawScheme = useColorScheme();
  const scheme: "light" | "dark" =
    rawScheme === "light" ? "light" : "dark";
  const colors = Colors[scheme];

  return {
    colors,
    typography: Typography,
    scheme,
    isDark: scheme === "dark",
  };
}
