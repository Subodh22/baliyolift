import { Platform } from "react-native";

// SF Pro is the system font on iOS — no import needed, it's free and already there
const SF_PRO = Platform.select({ ios: "System", android: "Roboto" });

export const Typography = {
  // Display — hero numbers, large titles
  largeTitle: {
    fontFamily: SF_PRO,
    fontSize: 34,
    fontWeight: "700" as const,
    letterSpacing: 0.37,
  },
  title1: {
    fontFamily: SF_PRO,
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: 0.36,
  },
  title2: {
    fontFamily: SF_PRO,
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: 0.35,
  },
  title3: {
    fontFamily: SF_PRO,
    fontSize: 20,
    fontWeight: "600" as const,
    letterSpacing: 0.38,
  },

  // Body text
  headline: {
    fontFamily: SF_PRO,
    fontSize: 17,
    fontWeight: "600" as const,
    letterSpacing: -0.41,
  },
  body: {
    fontFamily: SF_PRO,
    fontSize: 17,
    fontWeight: "400" as const,
    letterSpacing: -0.41,
  },
  callout: {
    fontFamily: SF_PRO,
    fontSize: 16,
    fontWeight: "400" as const,
    letterSpacing: -0.32,
  },
  subheadline: {
    fontFamily: SF_PRO,
    fontSize: 15,
    fontWeight: "400" as const,
    letterSpacing: -0.24,
  },
  footnote: {
    fontFamily: SF_PRO,
    fontSize: 13,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
  },
  caption1: {
    fontFamily: SF_PRO,
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  caption2: {
    fontFamily: SF_PRO,
    fontSize: 11,
    fontWeight: "400" as const,
    letterSpacing: 0.07,
  },

  // Numeric — tabular figures for workout numbers
  numericHero: {
    fontFamily: SF_PRO,
    fontSize: 64,
    fontWeight: "700" as const,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  },
  numericLarge: {
    fontFamily: SF_PRO,
    fontSize: 40,
    fontWeight: "700" as const,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  },
  numericMedium: {
    fontFamily: SF_PRO,
    fontSize: 28,
    fontWeight: "600" as const,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  },
} as const;
