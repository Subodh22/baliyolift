// Inter (300/400/500/600) + Playfair Display Italic for hero headline
// Loaded in app/_layout.tsx via useFonts

const EL = "Inter_200ExtraLight";
const L  = "Inter_300Light";
const R  = "Inter_400Regular";
const M  = "Inter_500Medium";
const SB = "Inter_600SemiBold";
export const PLAYFAIR_ITALIC = "PlayfairDisplay_400Regular_Italic";

export const Typography = {
  // ── Screen hero headline (Playfair italic — use ONCE per screen) ──────────
  heroItalic: {
    fontFamily: PLAYFAIR_ITALIC,
    fontSize: 34,
    fontWeight: "400" as const,
    fontStyle: "italic" as const,
    letterSpacing: -0.3,
    lineHeight: 42,
  },

  // ── Display ───────────────────────────────────────────────────────────────
  largeTitle: {
    fontFamily: M,
    fontSize: 30,
    fontWeight: "500" as const,
    letterSpacing: -0.5,
  },
  title1: {
    fontFamily: M,
    fontSize: 26,
    fontWeight: "500" as const,
    letterSpacing: -0.4,
  },
  title2: {
    fontFamily: M,
    fontSize: 22,
    fontWeight: "500" as const,
    letterSpacing: -0.3,
  },
  title3: {
    fontFamily: M,
    fontSize: 18,
    fontWeight: "500" as const,
    letterSpacing: -0.2,
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  headline: {
    fontFamily: M,
    fontSize: 16,
    fontWeight: "500" as const,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: R,
    fontSize: 16,
    fontWeight: "400" as const,
    letterSpacing: -0.2,
  },
  callout: {
    fontFamily: L,
    fontSize: 15,
    fontWeight: "300" as const,
    letterSpacing: -0.1,
  },
  subheadline: {
    fontFamily: L,
    fontSize: 14,
    fontWeight: "300" as const,
    letterSpacing: 0,
  },
  footnote: {
    fontFamily: L,
    fontSize: 13,
    fontWeight: "300" as const,
    letterSpacing: 0,
  },
  caption1: {
    fontFamily: L,
    fontSize: 12,
    fontWeight: "300" as const,
    letterSpacing: 0,
  },
  caption2: {
    fontFamily: L,
    fontSize: 11,
    fontWeight: "300" as const,
    letterSpacing: 0.2,
  },

  // ── Section label (ALL CAPS, spaced) ─────────────────────────────────────
  sectionLabel: {
    fontFamily: R,
    fontSize: 11,
    fontWeight: "400" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },

  // ── Numeric — stats and workout numbers ───────────────────────────────────
  numericHero: {
    fontFamily: SB,
    fontSize: 60,
    fontWeight: "600" as const,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  },
  numericLarge: {
    fontFamily: SB,
    fontSize: 38,
    fontWeight: "600" as const,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  },
  numericMedium: {
    fontFamily: SB,
    fontSize: 26,
    fontWeight: "600" as const,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  },
} as const;
