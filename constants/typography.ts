// Pulse typography system — Dark Luxury
// Cormorant Garamond 300 (display/numbers/hero) + Outfit 200–400 (UI/labels only)
// NEVER use bold. Section labels: 10px Outfit, 4px tracking, UPPERCASE.

export const CG        = "CormorantGaramond_300Light";
export const CG_ITALIC = "CormorantGaramond_300Light_Italic";
export const OUT_EL    = "Outfit_200ExtraLight";
export const OUT_L     = "Outfit_300Light";
export const OUT       = "Outfit_400Regular";

// Legacy aliases (some screens still import these)
export const DM_SERIF        = CG;
export const DM_SERIF_ITALIC = CG_ITALIC;

export const Typography = {
  heroItalic:    { fontFamily: CG_ITALIC, fontSize: 52, fontWeight: "300" as const, letterSpacing: -0.5, lineHeight: 58 },
  heroRoman:     { fontFamily: CG,        fontSize: 52, fontWeight: "300" as const, letterSpacing: -0.5, lineHeight: 58 },
  displayLarge:  { fontFamily: CG,        fontSize: 88, fontWeight: "300" as const, letterSpacing: -2 },
  displayMedium: { fontFamily: CG,        fontSize: 48, fontWeight: "300" as const, letterSpacing: -1 },
  displaySmall:  { fontFamily: CG,        fontSize: 32, fontWeight: "300" as const, letterSpacing: -0.5 },
  title1:        { fontFamily: OUT,       fontSize: 18, letterSpacing: -0.2 },
  title2:        { fontFamily: OUT,       fontSize: 15, letterSpacing: -0.1 },
  body:          { fontFamily: OUT_L,     fontSize: 14, letterSpacing: 0 },
  callout:       { fontFamily: OUT_L,     fontSize: 13, letterSpacing: 0 },
  subheadline:   { fontFamily: OUT_L,     fontSize: 13, letterSpacing: 0 },
  footnote:      { fontFamily: OUT_EL,    fontSize: 12, letterSpacing: 0 },
  caption1:      { fontFamily: OUT_EL,    fontSize: 11, letterSpacing: 0.2 },
  sectionLabel:  { fontFamily: OUT_L,     fontSize: 10, letterSpacing: 4, textTransform: "uppercase" as const },
  numericHero:   { fontFamily: CG,        fontSize: 88, fontWeight: "300" as const, letterSpacing: -2 },
  numericLarge:  { fontFamily: CG,        fontSize: 48, fontWeight: "300" as const, letterSpacing: -1 },
  numericMedium: { fontFamily: CG,        fontSize: 32, fontWeight: "300" as const, letterSpacing: -0.5 },
} as const;
