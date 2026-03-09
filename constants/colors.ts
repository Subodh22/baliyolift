// RP Hypertrophy color system — deep red accent, light theme primary
// Never hardcode hex in components — use these tokens via useTheme()

export const Colors = {
  light: {
    // Backgrounds
    background: "#FFFFFF",
    backgroundSecondary: "#F2F2F2",
    backgroundTertiary: "#E8E8E8",

    // Labels
    label: "#111111",
    labelSecondary: "#555555",
    labelTertiary: "#999999",
    labelQuaternary: "#BBBBBB",

    // Separators
    separator: "#E0E0E0",
    separatorOpaque: "#D0D0D0",

    // Fills
    fillPrimary: "#78788033",
    fillSecondary: "#EBEBEB",
    fillTertiary: "#F5F5F5",

    // RP Brand — deep red primary, green for success
    accent: "#CC2020",
    accentGreen: "#26A870",
    accentRed: "#CC2020",
    accentOrange: "#E8A020",

    // Volume zones (MEV → MAV → MRV)
    volumeLow: "#26A870",
    volumeMid: "#E8A020",
    volumeHigh: "#CC2020",

    // Workout runner tokens
    headerBg: "#1A1A1A",
    repRangeBg: "#EDE0C8",
    repRangeFg: "#5A4525",
    loggedCheckBg: "#26A870",
    setRowBg: "#FFFFFF",
    setRowAlt: "#F9F9F9",
  },
  dark: {
    background: "#111111",
    backgroundSecondary: "#1E1E1E",
    backgroundTertiary: "#2A2A2A",

    label: "#FFFFFF",
    labelSecondary: "#ABABAB",
    labelTertiary: "#707070",
    labelQuaternary: "#444444",

    separator: "#333333",
    separatorOpaque: "#3A3A3A",

    fillPrimary: "#7878805C",
    fillSecondary: "#2C2C2C",
    fillTertiary: "#242424",

    accent: "#E03030",
    accentGreen: "#26A870",
    accentRed: "#E03030",
    accentOrange: "#E8A020",

    volumeLow: "#26A870",
    volumeMid: "#E8A020",
    volumeHigh: "#E03030",

    headerBg: "#0A0A0A",
    repRangeBg: "#3A3020",
    repRangeFg: "#C8A870",
    loggedCheckBg: "#26A870",
    setRowBg: "#1E1E1E",
    setRowAlt: "#242424",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorToken = keyof typeof Colors.light;

// ─── Muscle badge colors ─────────────────────────────────────────────────────
// Used directly (not via useTheme) so muscle pills are consistent everywhere.

export const MUSCLE_BADGE_COLORS: Record<string, string> = {
  chest:       "#CC4020",
  back:        "#2060CC",
  shoulders:   "#8040C0",
  biceps:      "#C07020",
  triceps:     "#20A090",
  quads:       "#CC2020",
  hamstrings:  "#208040",
  glutes:      "#C03070",
  calves:      "#608020",
  abs:         "#C0A020",
  forearms:    "#906030",
};
