// Forest Green design system
// bg #F2EFE9 · card #FAFAF7 · charcoal #2C2C2A · mid #8A8880 · faint #C8C5BE · accent #2D5A3D · accent-light #EAF0EB

export const Colors = {
  light: {
    background:          "#F2EFE9",
    backgroundSecondary: "#FAFAF7",
    backgroundTertiary:  "#F5F2EC",

    label:          "#2C2C2A",
    labelSecondary: "#8A8880",
    labelTertiary:  "#C8C5BE",
    labelQuaternary:"#DDD9D1",

    separator:      "#E8E4DC",
    separatorOpaque:"#E0DCD4",

    fillPrimary:    "#2C2C2A14",
    fillSecondary:  "#EDE9E2",
    fillTertiary:   "#F2EFE9",

    accent:       "#2D5A3D",
    accentGreen:  "#2D5A3D",
    accentLight:  "#EAF0EB",
    accentRed:    "#B83030",
    accentOrange: "#C87820",

    volumeLow:  "#2D5A3D",
    volumeMid:  "#C87820",
    volumeHigh: "#B83030",

    headerBg:       "#2C2C2A",
    repRangeBg:     "#EAF0EB",
    repRangeFg:     "#2D5A3D",
    loggedCheckBg:  "#2D5A3D",
    setRowBg:       "#FAFAF7",
    setRowAlt:      "#F5F2EC",
  },
  dark: {
    background:          "#141412",
    backgroundSecondary: "#1C1B18",
    backgroundTertiary:  "#232220",

    label:          "#F0EDE8",
    labelSecondary: "#9A9790",
    labelTertiary:  "#605E58",
    labelQuaternary:"#3A3830",

    separator:      "#2C2A25",
    separatorOpaque:"#333028",

    fillPrimary:    "#F0EDE840",
    fillSecondary:  "#252320",
    fillTertiary:   "#1E1D1A",

    accent:       "#4A8A60",
    accentGreen:  "#4A8A60",
    accentLight:  "#1A3028",
    accentRed:    "#CC4040",
    accentOrange: "#D08830",

    volumeLow:  "#4A8A60",
    volumeMid:  "#D08830",
    volumeHigh: "#CC4040",

    headerBg:       "#0A0A08",
    repRangeBg:     "#1A3028",
    repRangeFg:     "#4A8A60",
    loggedCheckBg:  "#4A8A60",
    setRowBg:       "#1C1B18",
    setRowAlt:      "#232220",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorToken = keyof typeof Colors.light;

export const MUSCLE_BADGE_COLORS: Record<string, string> = {
  chest:      "#A03820",
  back:       "#205090",
  shoulders:  "#6A30A0",
  biceps:     "#A06020",
  triceps:    "#1A8878",
  quads:      "#A02020",
  hamstrings: "#1A7040",
  glutes:     "#A02860",
  calves:     "#507020",
  abs:        "#A08820",
  forearms:   "#785028",
};
