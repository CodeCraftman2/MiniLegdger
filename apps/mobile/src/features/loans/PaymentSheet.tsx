import { formatRupees, parseRupeesToPaise, type CreatePaymentInput, type Loan } from "@miniledger/shared";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ResizableSheet } from "../../components/ResizableSheet";
import { colors, spacing, typography } from "../../theme/tokens";

type Props = {
  loan: Loan | null;
  offline?: boolean;
  onClose: () => void;
  onSubmit: (loan: Loan, input: CreatePaymentInput) => void;
};

/** Resizable bottom sheet for recording money received: any amount up to what is owed, or the whole balance in one tap. */
export function PaymentSheet({ loan, offline, onClose, onSubmit }: Props) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setAmount("");
    setError(undefined);
  }, [loan?.id]);

  if (!loan) return null;
  const owed = loan.balance.owedPaise;
  const hasInterest = loan.balance.interestDuePaise > 0;

  function submitAmount() {
    const paise = parseRupeesToPaise(amount);
    if (paise === null) return setError("Enter an amount like 100 or 100.50");
    if (paise < 100) return setError("Minimum payment is ₹1");
    if (paise > owed) return setError(`That is more than the ${formatRupees(owed, { alwaysShowPaise: true })} still owed`);
    onSubmit(loan!, { amountPaise: paise });
  }

  return (
    <ResizableSheet title={`Payment from ${loan.friendName}`} onClose={onClose} initialRatio={0.5}>
      <Text style={styles.message}>
        Still owed {formatRupees(owed, { alwaysShowPaise: true })}
        {hasInterest
          ? ` (${formatRupees(loan.balance.principalDuePaise, { alwaysShowPaise: true })} lent + ${formatRupees(
              loan.balance.interestDuePaise,
              { alwaysShowPaise: true },
            )} interest). Interest is cleared first.`
          : "."}
      </Text>

      <Input
        label="Amount received"
        prefix="₹"
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          setError(undefined);
        }}
        placeholder="e.g. 100"
        keyboardType="decimal-pad"
        autoFocus
        error={error}
        returnKeyType="done"
        onSubmitEditing={submitAmount}
      />
      {offline && <Text style={styles.hint}>You’re offline, so this will sync when you’re back online.</Text>}

      <View style={styles.actions}>
        <Button
          label={`Received in full`}
          accessibilityLabel={`Mark everything, ${formatRupees(owed, { alwaysShowPaise: true })}, as received`}
          variant="secondary"
          onPress={() => onSubmit(loan, { full: true })}
          style={{ flex: 1 }}
        />
        <Button label="Record payment" onPress={submitAmount} style={{ flex: 1 }} />
      </View>
    </ResizableSheet>
  );
}

const styles = StyleSheet.create({
  message: { ...typography.body, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
});
