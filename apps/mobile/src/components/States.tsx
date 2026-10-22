import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { Button } from "./Button";
import { Card } from "./Card";

export function OfflineBanner() {
  return (
    <View style={styles.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.offlineText}>You’re offline – showing saved data</Text>
    </View>
  );
}

function SkeletonBlock({ width, height }: { width: number | `${number}%`; height: number }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { width, height, opacity }]} />;
}

export function LoanListSkeleton() {
  return (
    <View style={styles.skeletonList} accessibilityLabel="Loading entries" accessibilityRole="progressbar">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} style={styles.skeletonRow}>
          <SkeletonBlock width={44} height={44} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <SkeletonBlock width="55%" height={14} />
            <SkeletonBlock width="35%" height={12} />
          </View>
          <SkeletonBlock width={64} height={16} />
        </Card>
      ))}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.heading}>Couldn’t load your entries</Text>
      <Text style={styles.muted}>{message}</Text>
      <Button label="Retry" onPress={onRetry} style={{ alignSelf: "stretch" }} />
    </View>
  );
}

export function EmptyState({ filtered, onAdd }: { filtered: boolean; onAdd: () => void }) {
  return (
    <View style={styles.center}>
      <View style={styles.illustration}>
        <Text style={styles.illustrationEmoji}>📒</Text>
      </View>
      <Text style={styles.heading}>{filtered ? "Nothing here" : "No entries yet"}</Text>
      <Text style={styles.muted}>
        {filtered
          ? "No entries match this filter."
          : "Keep track of money you’ve lent to friends, and never forget who owes you."}
      </Text>
      {!filtered && <Button label="Add your first entry" onPress={onAdd} style={{ alignSelf: "stretch" }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  offline: { backgroundColor: colors.warningBg, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  offlineText: { ...typography.captionStrong, color: colors.warning, textAlign: "center" },
  skeleton: { backgroundColor: colors.border, borderRadius: radius.sm },
  skeletonList: { gap: spacing.md },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  center: { alignItems: "center", gap: spacing.md, padding: spacing.xl, paddingTop: spacing.xxl },
  emoji: { fontSize: 40 },
  heading: { ...typography.heading, color: colors.text, textAlign: "center" },
  muted: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationEmoji: { fontSize: 56 },
});
