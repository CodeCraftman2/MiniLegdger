import { formatRate, formatRupees, type Loan } from "@miniledger/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../components/Badge";
import { MIN_TOUCH, colors, radius, shadow, spacing, typography } from "../../theme/tokens";
import { isPendingSync } from "./cache";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDueDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** "2% / month" style label for a loan's interest terms. */
export const interestLabel = (loan: Pick<Loan, "interestRateBps" | "interestPeriod">) =>
  `${formatRate(loan.interestRateBps)} / ${loan.interestPeriod === "MONTH" ? "month" : "year"}`;

export function LoanRow({
  loan,
  onOpen,
  onPay,
}: {
  loan: Loan;
  onOpen: (loan: Loan) => void;
  onPay: (loan: Loan) => void;
}) {
  const repaid = loan.repaidAt !== null;
  const pending = isPendingSync(loan);
  const days = loan.daysOverdue;
  const { balance } = loan;
  const partlyPaid = balance.paidPaise > 0 && !repaid;
  const hasInterest = loan.interestRateBps > 0;
  // Settled loans show what was lent; open ones show what is still owed (interest included).
  const headline = repaid ? loan.amountPaise : balance.owedPaise;

  return (
    <Pressable
      onPress={() => !pending && onOpen(loan)}
      accessibilityRole="button"
      accessibilityLabel={`${loan.friendName}, ${
        repaid ? `${formatRupees(loan.amountPaise)} repaid` : `${formatRupees(balance.owedPaise)} owed`
      }, due ${formatDueDate(loan.dueDate)}${loan.overdue ? `, overdue by ${days} ${days === 1 ? "day" : "days"}` : ""}. Opens details`}
      style={({ pressed }) => [styles.row, loan.overdue && styles.rowOverdue, pressed && { opacity: 0.9 }]}
    >
      <View style={[styles.avatar, loan.overdue && { backgroundColor: colors.dangerBg }]}>
        <Text style={[styles.avatarText, loan.overdue && { color: colors.danger }]}>
          {loan.friendName.trim().charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {loan.friendName}
        </Text>
        <Text style={styles.due}>Due {formatDueDate(loan.dueDate)}</Text>
        {partlyPaid && (
          <Text style={styles.due}>
            Lent {formatRupees(loan.amountPaise)} · received {formatRupees(balance.paidPaise)}
          </Text>
        )}
        <View style={styles.badges}>
          {loan.overdue && <Badge tone="danger" label={`Overdue by ${days} ${days === 1 ? "day" : "days"}`} />}
          {repaid && <Badge tone="success" label="Repaid" />}
          {partlyPaid && <Badge tone="neutral" label="Part paid" />}
          {hasInterest && !repaid && <Badge tone="neutral" label={interestLabel(loan)} />}
          {pending && <Badge tone="warning" label="Waiting to sync" />}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, repaid && { color: colors.textMuted }]}>{formatRupees(headline)}</Text>
        {hasInterest && !repaid && balance.interestDuePaise > 0 && (
          <Text style={styles.interest}>incl. {formatRupees(balance.interestDuePaise)} interest</Text>
        )}
        {!repaid && !pending && (
          <Pressable
            onPress={() => onPay(loan)}
            accessibilityRole="button"
            accessibilityLabel={`Record a payment from ${loan.friendName}`}
            style={({ pressed }) => [styles.repayBtn, pressed && { opacity: 0.7 }]}
            hitSlop={6}
          >
            <Text style={styles.repayText}>Receive</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  rowOverdue: { backgroundColor: colors.dangerBg },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.heading, color: colors.primary },
  body: { flex: 1, gap: spacing.xs },
  name: { ...typography.bodyStrong, color: colors.text },
  due: { ...typography.caption, color: colors.textMuted },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  right: { alignItems: "flex-end", gap: spacing.xs },
  amount: { ...typography.bodyStrong, color: colors.text },
  interest: { ...typography.caption, color: colors.textMuted },
  repayBtn: {
    minHeight: MIN_TOUCH - 8,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  repayText: { ...typography.captionStrong, color: colors.primary },
});
