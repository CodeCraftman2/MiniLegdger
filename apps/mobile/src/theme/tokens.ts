// Single source of truth for the look of the app. Components read from here and never
// hard-code colours or spacing (same idea as Razorpay's Blade design tokens).

export const colors = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  border: "#E3E8EF",
  text: "#101828",
  textMuted: "#586274",
  primary: "#2457F5",
  primaryText: "#FFFFFF",
  primarySoft: "#E8EEFF",
  danger: "#B42318",
  dangerBg: "#FEF3F2",
  dangerBorder: "#D92D20",
  success: "#0B7A4B",
  successBg: "#E7F6EE",
  warningBg: "#FFF4DB",
  warning: "#8A5A00",
  disabled: "#C7CEDA",
  overlay: "rgba(16,24,40,0.45)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const typography = {
  title: { fontSize: 24, fontWeight: "700" as const, lineHeight: 30 },
  heading: { fontSize: 18, fontWeight: "700" as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  captionStrong: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  amount: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
} as const;

export const MIN_TOUCH = 48; // dp, recommended minimum tap target
