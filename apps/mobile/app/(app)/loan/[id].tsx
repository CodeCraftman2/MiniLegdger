import { formatRupees, type CreatePaymentInput, type Loan } from "@miniledger/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../../../src/components/Badge";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { PENDING_PREFIX, isPendingSync } from "../../../src/features/loans/cache";
import { newIdempotencyKey, useAddPayment, useIsOnline, useLoan } from "../../../src/features/loans/hooks";
import { formatDueDate, interestLabel } from "../../../src/features/loans/LoanRow";
import { PaymentSheet } from "../../../src/features/loans/PaymentSheet";
import { RequestPaymentSheet } from "../../../src/features/loans/RequestPaymentSheet";
import { ApiError } from "../../../src/lib/api";
import { colors, radius, spacing, typography } from "../../../src/theme/tokens";

const money = (paise: number) => formatRupees(paise, { alwaysShowPaise: true });

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong, tone === "success" && { color: colors.success }]}>
        {value}
      </Text>
    </View>
  );
}

export default function LoanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const online = useIsOnline();
  const { loan, loading } = useLoan(id);
  const addPayment = useAddPayment();
  const [paying, setPaying] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string>();

  function submit(target: Loan, input: CreatePaymentInput) {
    setError(undefined);
    addPayment.mutate(
      { loanId: target.id, input, idempotencyKey: newIdempotencyKey() },
      {
        onError: (e) =>
          setError(e instanceof ApiError ? `Couldn’t record the payment: ${e.message}` : "Couldn’t record the payment. It was rolled back."),
      },
    );
    setPaying(false);
  }

  const back = (
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
      <Text style={styles.back}>‹ Back</Text>
    </Pressable>
  );

  if (!loan) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {back}
          {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.muted}>This entry couldn’t be found.</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const repaid = loan.repaidAt !== null;
  const pending = isPendingSync(loan);
  const { balance } = loan;
  const hasInterest = loan.interestRateBps > 0;
  const interestTotal = balance.interestPaidPaise + balance.interestDuePaise;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {back}

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.title}>{loan.friendName}</Text>
          <View style={styles.badges}>
            {repaid && <Badge tone="success" label="Repaid" />}
            {loan.overdue && (
              <Badge tone="danger" label={`Overdue by ${loan.daysOverdue} ${loan.daysOverdue === 1 ? "day" : "days"}`} />
            )}
            {pending && <Badge tone="warning" label="Waiting to sync" />}
            {!repaid && !loan.overdue && <Badge tone="neutral" label={`Due ${formatDueDate(loan.dueDate)}`} />}
          </View>
        </View>

        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.muted}>{repaid ? "Fully repaid" : "Still owed"}</Text>
          <Text style={styles.big}>{money(balance.owedPaise)}</Text>
          <View style={styles.divider} />
          <Row label={`Lent on ${formatDueDate(loan.lentOn)}`} value={money(loan.amountPaise)} />
          {hasInterest && <Row label={`Interest (${interestLabel(loan)})`} value={money(interestTotal)} />}
          <Row label="Received so far" value={money(balance.paidPaise)} tone={balance.paidPaise > 0 ? "success" : undefined} />
          <View style={styles.divider} />
          <Row label={repaid ? "Settled" : "Owed today"} value={money(balance.owedPaise)} strong />
          {hasInterest && !repaid && balance.interestDuePaise > 0 && (
            <Text style={styles.muted}>
              Includes {money(balance.interestDuePaise)} interest. It grows each day until it is paid, and payments clear
              interest first.
            </Text>
          )}
          {!repaid && <Text style={styles.muted}>Due {formatDueDate(loan.dueDate)}</Text>}
        </Card>

        {error && (
          <Pressable onPress={() => setError(undefined)} accessibilityRole="alert">
            <Text style={styles.error}>{error} (tap to dismiss)</Text>
          </Pressable>
        )}

        {!repaid && !pending && (
          <View style={{ gap: spacing.sm }}>
            <Button label="Ask for payment (UPI)" onPress={() => setRequesting(true)} />
            <Button label="Record a payment" variant="secondary" onPress={() => setPaying(true)} />
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.heading}>Payments received</Text>
          {loan.payments.length === 0 ? (
            <Text style={styles.muted}>Nothing received yet.</Text>
          ) : (
            loan.payments.map((p) => (
              <Card key={p.id} style={styles.payment}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowStrong}>{money(p.amountPaise)}</Text>
                  <Text style={styles.muted}>
                    {formatDueDate(p.paidOn)}
                    {p.note ? ` · ${p.note}` : ""}
                  </Text>
                </View>
                {p.id.startsWith(PENDING_PREFIX) && <Badge tone="warning" label="Waiting to sync" />}
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      <RequestPaymentSheet
        loan={requesting ? loan : null}
        onClose={() => setRequesting(false)}
        onPaid={() => {
          setRequesting(false);
          setPaying(true);
        }}
      />
      <PaymentSheet loan={paying ? loan : null} offline={!online} onClose={() => setPaying(false)} onSubmit={submit} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl, gap: spacing.lg },
  back: { ...typography.bodyStrong, color: colors.primary },
  title: { ...typography.title, color: colors.text },
  heading: { ...typography.heading, color: colors.text },
  big: { ...typography.amount, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  rowLabel: { ...typography.body, color: colors.textMuted, flexShrink: 1 },
  rowValue: { ...typography.body, color: colors.text },
  rowStrong: { ...typography.bodyStrong, color: colors.text },
  payment: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md },
});
