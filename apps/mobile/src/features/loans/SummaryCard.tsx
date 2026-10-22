import { formatRupees, type Summary } from "@miniledger/shared";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { colors, radius, spacing, typography } from "../../theme/tokens";

export function SummaryCard({ summary }: { summary: Summary | undefined }) {
  const lent = summary?.totalLentPaise ?? 0;
  const repaid = summary?.totalRepaidPaise ?? 0;
  const overdue = summary?.overduePaise ?? 0;
  const pct = lent > 0 ? Math.min(100, Math.round((repaid / lent) * 100)) : 0;

  return (
    <Card style={{ gap: spacing.md }}>
      <View>
        <Text style={styles.label}>Total lent</Text>
        <Text style={styles.big}>{formatRupees(lent)}</Text>
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${pct} percent repaid`}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.caption}>{pct}% repaid</Text>
      </View>

      <View style={styles.split}>
        <View style={styles.cell}>
          <Text style={styles.label}>Repaid</Text>
          <Text style={[styles.value, { color: colors.success }]}>{formatRupees(repaid)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Overdue{summary && summary.overdueCount > 0 ? ` (${summary.overdueCount})` : ""}</Text>
          <Text style={[styles.value, overdue > 0 && { color: colors.danger }]}>{formatRupees(overdue)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textMuted },
  big: { ...typography.amount, color: colors.text },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.success },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  split: { flexDirection: "row", gap: spacing.lg },
  cell: { flex: 1 },
  value: { ...typography.heading, color: colors.text },
});
