import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

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
        { backgroundColor: inactive && variant === "primary" ? colors.disabled : v.bg },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.label, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

// "Secondary" is the iOS tinted button: soft blue fill, blue text.
const variants = {
  primary: { bg: colors.primary, fg: colors.primaryText },
  secondary: { bg: colors.primarySoft, fg: colors.primary },
  danger: { bg: colors.danger, fg: colors.primaryText },
  ghost: { bg: "transparent", fg: colors.primary },
} as const;

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { ...typography.bodyStrong },
});
