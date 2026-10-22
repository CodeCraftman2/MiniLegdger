import { forwardRef, type ComponentRef } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../theme/tokens";

type Props = TextInputProps & {
  label: string;
  error?: string;
  prefix?: string;
};

export const Input = forwardRef<ComponentRef<typeof TextInput>, Props>(function Input({ label, error, prefix, style, ...rest }, ref) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.captionStrong, color: colors.text },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldError: { borderColor: colors.dangerBorder },
  prefix: { ...typography.bodyStrong, color: colors.text, marginRight: spacing.sm },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  error: { ...typography.caption, color: colors.danger },
});
