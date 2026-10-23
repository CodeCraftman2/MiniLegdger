import { addDays, createLoanSchema, parseRupeesToPaise, todayIST } from "@miniledger/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { onlineManager } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { newIdempotencyKey, useAddLoan } from "../../src/features/loans/hooks";
import { InterestPlanner, type InterestValue } from "../../src/features/loans/InterestPlanner";
import { formatDueDate } from "../../src/features/loans/LoanRow";
import { ApiError } from "../../src/lib/api";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

// Reuses the exact field rules the API enforces; only the amount differs (typed in rupees here, sent as paise).
const formSchema = z.object({
  friendName: createLoanSchema.shape.friendName,
  amount: z.string().superRefine((value, ctx) => {
    const paise = parseRupeesToPaise(value);
    if (paise === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 1500 or 1500.50" });
      return;
    }
    const result = createLoanSchema.shape.amountPaise.safeParse(paise);
    if (!result.success) ctx.addIssue({ code: "custom", message: result.error.issues[0]?.message ?? "Invalid amount" });
  }),
  dueDate: createLoanSchema.shape.dueDate,
});
type FormValues = z.infer<typeof formSchema>;

/** The picker works in device-local dates; our API works in plain YYYY-MM-DD strings. */
const toLocalDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const fromLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AddEntryScreen() {
  const router = useRouter();
  const add = useAddLoan();
  const [submitting, setSubmitting] = useState(false);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [interest, setInterest] = useState<InterestValue>(null);
  const [interestIncomplete, setInterestIncomplete] = useState(false);
  // One key per form session: a double tap or a retry on a flaky network reuses it, so the server dedupes.
  const idempotencyKey = useRef(newIdempotencyKey()).current;

  const { control, handleSubmit, setError, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { friendName: "", amount: "", dueDate: addDays(todayIST(), 7) },
    mode: "onTouched",
  });

  const amountText = watch("amount");
  const dueDateValue = watch("dueDate");
  const amountPaise = parseRupeesToPaise(amountText);

  function openDatePicker(value: string, onChange: (v: string) => void) {
    const minimumDate = toLocalDate(todayIST());
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: toLocalDate(value),
        mode: "date",
        minimumDate,
        onValueChange: (_e, date) => onChange(fromLocalDate(date)),
      });
    } else {
      setIosPickerOpen((o) => !o);
    }
  }

  async function onSubmit(values: FormValues) {
    if (submitting) return;
    if (interestIncomplete) {
      setError("root", { message: "Finish the interest details, or switch interest off." });
      return;
    }
    const vars = {
      input: {
        friendName: values.friendName.trim(),
        amountPaise: parseRupeesToPaise(values.amount)!,
        dueDate: values.dueDate,
        ...(interest && { interestRateBps: interest.rateBps, interestPeriod: interest.period }),
      },
      idempotencyKey,
    };

    if (!onlineManager.isOnline()) {
      // Queue it: shows instantly as "Waiting to sync" and is sent (once) when the connection returns.
      add.mutate(vars);
      router.back();
      return;
    }

    setSubmitting(true);
    try {
      await add.mutateAsync(vars);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.field && e.field in formSchema.shape) {
        setError(e.field as keyof FormValues, { message: e.message });
      } else if (e instanceof ApiError && e.field === "amountPaise") {
        setError("amount", { message: e.message });
      } else {
        setError("root", { message: e instanceof Error ? e.message : "Couldn’t save. Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.header}>
            <Text style={styles.title}>Add entry</Text>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
              <Text style={styles.close}>Cancel</Text>
            </Pressable>
          </View>

          <Controller
            control={control}
            name="friendName"
            render={({ field }) => (
              <Input
                label="Friend’s name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Rahul"
                autoCapitalize="words"
                autoFocus
                maxLength={60}
                error={errors.friendName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Input
                label="Amount"
                prefix="₹"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="1,500"
                keyboardType="decimal-pad"
                error={errors.amount?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <View style={{ gap: spacing.xs }}>
                <Text style={styles.label}>Due date</Text>
                <Pressable
                  onPress={() => openDatePicker(field.value, field.onChange)}
                  accessibilityRole="button"
                  accessibilityLabel={`Due date, ${formatDueDate(field.value)}. Tap to change`}
                  style={[styles.dateField, errors.dueDate && { borderColor: colors.dangerBorder }]}
                >
                  <Text style={styles.dateText}>{formatDueDate(field.value)}</Text>
                </Pressable>
                {Platform.OS === "ios" && iosPickerOpen && (
                  <DateTimePicker
                    value={toLocalDate(field.value)}
                    mode="date"
                    display="inline"
                    minimumDate={toLocalDate(todayIST())}
                    onValueChange={(_e, d) => field.onChange(fromLocalDate(d))}
                  />
                )}
                {errors.dueDate && (
                  <Text style={styles.error} accessibilityRole="alert">
                    {errors.dueDate.message}
                  </Text>
                )}
              </View>
            )}
          />

          <InterestPlanner
            principalPaise={amountPaise}
            dueDate={dueDateValue}
            onChange={(value, incomplete) => {
              setInterest(value);
              setInterestIncomplete(incomplete);
            }}
          />

          {errors.root?.message && (
            <Text style={styles.error} accessibilityRole="alert">
              {errors.root.message}
            </Text>
          )}

          <Button label="Save entry" onPress={handleSubmit(onSubmit)} loading={submitting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl, paddingBottom: 120, gap: spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...typography.title, color: colors.text },
  close: { ...typography.bodyStrong, color: colors.primary },
  label: { ...typography.captionStrong, color: colors.textMuted, marginLeft: spacing.xs },
  dateField: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dateText: { ...typography.body, color: colors.text },
  error: { ...typography.caption, color: colors.danger },
});
