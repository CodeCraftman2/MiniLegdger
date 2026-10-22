import { formatRupees, type Loan } from "@miniledger/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../components/Badge";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../../theme/tokens";
import { isPendingSync } from "./cache";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDueDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function LoanRow({ loan, onRepay }: { loan: Loan; onRepay: (loan: Loan) => void }) {
  const repaid = loan.repaidAt !== null;
  const pending = isPendingSync(loan);
  const days = loan.daysOverdue;

  return (
    <View
      style={[styles.row, loan.overdue && styles.rowOverdue]}
      accessible
      accessibilityLabel={`${loan.friendName}, ${formatRupees(loan.amountPaise)}, due ${formatDueDate(loan.dueDate)}${
        loan.overdue ? `, overdue by ${days} ${days === 1 ? "day" : "days"}` : repaid ? ", repaid" : ""
      }`}
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
        {loan.overdue && <Badge tone="danger" label={`Overdue by ${days} ${days === 1 ? "day" : "days"}`} />}
        {repaid && <Badge tone="success" label="Repaid" />}
        {pending && <Badge tone="warning" label="Waiting to sync" />}
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, repaid && { color: colors.textMuted }]}>{formatRupees(loan.amountPaise)}</Text>
        {!repaid && !pending && (
          <Pressable
            onPress={() => onRepay(loan)}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${loan.friendName}'s ${formatRupees(loan.amountPaise)} as repaid`}
            style={({ pressed }) => [styles.repayBtn, pressed && { opacity: 0.7 }]}
            hitSlop={6}
          >
            <Text style={styles.repayText}>Mark repaid</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    padding: spacing.lg,
  },
  rowOverdue: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBg, borderLeftColor: colors.dangerBorder },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.heading, color: colors.primary },
  body: { flex: 1, gap: spacing.xs },
  name: { ...typography.bodyStrong, color: colors.text },
  due: { ...typography.caption, color: colors.textMuted },
  right: { alignItems: "flex-end", gap: spacing.xs },
  amount: { ...typography.bodyStrong, color: colors.text },
  repayBtn: {
    minHeight: MIN_TOUCH - 8,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  repayText: { ...typography.captionStrong, color: colors.primary },
});
