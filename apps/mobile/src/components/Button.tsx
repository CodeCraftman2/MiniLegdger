import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../theme/tokens";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = "primary", loading, disabled, style, accessibilityLabel }: Props) {
  const inactive = disabled || loading;
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: inactive && variant === "primary" ? colors.disabled : v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.label, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const variants = {
  primary: { bg: colors.primary, fg: colors.primaryText, border: "transparent" },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  danger: { bg: colors.danger, fg: colors.primaryText, border: "transparent" },
  ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
} as const;

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { ...typography.bodyStrong },
});
