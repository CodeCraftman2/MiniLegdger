import {
  MAX_RATE_BPS,
  daysBetween,
  formatRate,
  formatRupees,
  interestFor,
  parseRupeesToPaise,
  rateForTargetInterest,
  todayIST,
  type InterestPeriod,
} from "@miniledger/shared";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Input } from "../../components/Input";
import { Segmented } from "../../components/Segmented";
import { colors, radius, shadow, spacing, typography } from "../../theme/tokens";

export type InterestValue = { rateBps: number; period: InterestPeriod } | null;

type Props = {
  /** Amount being lent, in paise (null while the amount field isn't a valid number yet). */
  principalPaise: number | null;
  dueDate: string;
  /** `incomplete` is true while interest is switched on but the rate can't be used yet. */
  onChange: (value: InterestValue, incomplete: boolean) => void;
};

type Mode = "rate" | "earn";

const parsePercentToBps = (input: string): number | null => {
  const cleaned = input.replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
};

/**
 * Optional interest for a new loan. Either type the rate and see what it earns, or type what you
 * want to earn and get the rate to charge. Whatever is shown here is exactly what gets saved.
 */
export function InterestPlanner({ principalPaise, dueDate, onChange }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("rate");
  const [period, setPeriod] = useState<InterestPeriod>("MONTH");
  const [rateText, setRateText] = useState("");
  const [earnText, setEarnText] = useState("");

  const days = Math.max(0, daysBetween(todayIST(), dueDate));
  const targetPaise = parseRupeesToPaise(earnText);

  const rateBps = useMemo(() => {
    if (!enabled) return null;
    if (mode === "rate") return parsePercentToBps(rateText);
    if (principalPaise === null || targetPaise === null) return null;
    return rateForTargetInterest(principalPaise, targetPaise, days, period);
  }, [enabled, mode, rateText, principalPaise, targetPaise, days, period]);

  const tooHigh = rateBps !== null && rateBps > MAX_RATE_BPS;
  const valid = rateBps !== null && rateBps > 0 && !tooHigh;

  useEffect(() => {
    onChange(valid ? { rateBps: rateBps!, period } : null, enabled && !valid);
    // onChange is deliberately left out of the deps: the parent passes a new function every render.
  }, [valid, rateBps, period, enabled]);

  const earned = valid && principalPaise !== null ? interestFor(principalPaise, rateBps!, period, days) : null;
  const perYear = valid ? (period === "YEAR" ? rateBps! : Math.round((rateBps! * 365) / 30)) : null;
  const perMonth = valid ? (period === "MONTH" ? rateBps! : Math.round((rateBps! * 30) / 365)) : null;

  return (
    <View style={styles.box}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Charge interest</Text>
          <Text style={styles.muted}>Simple interest on what is still owed.</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          accessibilityLabel="Charge interest"
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      {enabled && (
        <View style={{ gap: spacing.md }}>
          <Segmented
            options={[
              { value: "rate", label: "I know the rate" },
              { value: "earn", label: "I want to earn…" },
            ]}
            value={mode}
            onChange={setMode}
          />

          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Rate is per</Text>
            <Segmented
              options={[
                { value: "MONTH", label: "Month" },
                { value: "YEAR", label: "Year" },
              ]}
              value={period}
              onChange={setPeriod}
            />
          </View>

          {mode === "rate" ? (
            <Input
              label={`Interest rate (% per ${period === "MONTH" ? "month" : "year"})`}
              value={rateText}
              onChangeText={setRateText}
              placeholder={period === "MONTH" ? "e.g. 2" : "e.g. 24"}
              keyboardType="decimal-pad"
              error={tooHigh ? "Rate can't be more than 100%" : undefined}
            />
          ) : (
            <Input
              label="Interest I want to earn"
              prefix="₹"
              value={earnText}
              onChangeText={setEarnText}
              placeholder="e.g. 500"
              keyboardType="decimal-pad"
            />
          )}

          {mode === "earn" && days === 0 && (
            <Text style={styles.hint}>Pick a due date after today so the interest has time to build up.</Text>
          )}
          {mode === "earn" && tooHigh && (
            <Text style={styles.hint}>That would need more than 100% interest. Try a longer due date or a smaller amount.</Text>
          )}
          {mode === "earn" && principalPaise === null && (
            <Text style={styles.hint}>Enter the amount above first.</Text>
          )}

          {valid && (
            <View style={styles.result} accessibilityLiveRegion="polite">
              <Text style={styles.resultTitle}>
                {formatRate(rateBps!)} per {period === "MONTH" ? "month" : "year"}
              </Text>
              <Text style={styles.resultLine}>
                That is about {formatRate(period === "MONTH" ? perYear! : perMonth!)} per{" "}
                {period === "MONTH" ? "year" : "month"}.
              </Text>
              {earned !== null && days > 0 && (
                <Text style={styles.resultLine}>
                  By the due date ({days} {days === 1 ? "day" : "days"}) you earn {formatRupees(earned, { alwaysShowPaise: true })} interest, so{" "}
                  {formatRupees((principalPaise ?? 0) + earned, { alwaysShowPaise: true })} in total.
                </Text>
              )}
              {earned !== null && days === 0 && (
                <Text style={styles.resultLine}>Interest builds up every day after today.</Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heading: { ...typography.bodyStrong, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.captionStrong, color: colors.textMuted, marginLeft: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted },
  result: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.successBg },
  resultTitle: { ...typography.bodyStrong, color: colors.success },
  resultLine: { ...typography.caption, color: colors.text },
});
