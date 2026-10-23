// Single source of truth for the look of the app. Components read from here and never
// hard-code colours or spacing. The palette follows iOS conventions: a light grouped
// background, white rounded cards without borders, system blue as the accent, and
// semibold type with generous spacing.

export const colors = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  border: "#E5E5EA",
  text: "#1C1C1E",
  textMuted: "#6C6C70",
  primary: "#0A63DB",
  primaryText: "#FFFFFF",
  primarySoft: "#E6F0FF",
  danger: "#C9141F",
  dangerBg: "#FFEDEE",
  dangerBorder: "#FF3B30",
  success: "#1B7F3B",
  successBg: "#E6F5EA",
  warningBg: "#FFF4DB",
  warning: "#8A5A00",
  disabled: "#C7C7CC",
  segmentTrack: "#E3E3E8",
  overlay: "rgba(0,0,0,0.4)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: "700" as const, lineHeight: 41, letterSpacing: 0.3 },
  title: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34, letterSpacing: 0.3 },
  heading: { fontSize: 20, fontWeight: "600" as const, lineHeight: 25 },
  body: { fontSize: 17, fontWeight: "400" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 17, fontWeight: "600" as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  captionStrong: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  amount: { fontSize: 36, fontWeight: "700" as const, lineHeight: 42, letterSpacing: 0.3 },
} as const;

/** Soft, low-contrast elevation instead of borders. */
export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const MIN_TOUCH = 48; // dp, recommended minimum tap target
