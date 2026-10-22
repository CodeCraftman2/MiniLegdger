import type { Loan, LoanStatus } from "@miniledger/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmSheet } from "../../src/components/ConfirmSheet";
import { EmptyState, ErrorState, LoanListSkeleton, OfflineBanner } from "../../src/components/States";
import { useIsOnline, useLoans, useRepayLoan, useSummary } from "../../src/features/loans/hooks";
import { LoanRow } from "../../src/features/loans/LoanRow";
import { SummaryCard } from "../../src/features/loans/SummaryCard";
import { ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { formatRupees } from "@miniledger/shared";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../../src/theme/tokens";

const FILTERS: { value: LoanStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "repaid", label: "Repaid" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const online = useIsOnline();

  const [status, setStatus] = useState<LoanStatus>("all");
  const [toRepay, setToRepay] = useState<Loan | null>(null);
  const [repayError, setRepayError] = useState<string>();

  const loans = useLoans(status);
  const summary = useSummary();
  const repay = useRepayLoan();

  const items = loans.data ?? [];
  const showSkeleton = loans.isPending && !loans.data;
  const showError = loans.isError && !loans.data;

  function confirmRepay() {
    if (!toRepay) return;
    setRepayError(undefined);
    repay.mutate(
      { id: toRepay.id },
      {
        onError: (e) =>
          setRepayError(
            e instanceof ApiError ? `Couldn’t mark as repaid: ${e.message}` : "Couldn’t mark as repaid. It was rolled back.",
          ),
      },
    );
    setToRepay(null);
  }

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
      <SummaryCard summary={summary.data} />
      <View style={styles.chips} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const selected = f.value === status;
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatus(f.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {repayError && (
        <Pressable onPress={() => setRepayError(undefined)} accessibilityRole="alert">
          <Text style={styles.repayError}>{repayError} (tap to dismiss)</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {!online && <OfflineBanner />}
      <View style={styles.topBar}>
        <Text style={styles.title}>MiniLedger</Text>
        <Pressable onPress={signOut} accessibilityRole="button" hitSlop={8} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <FlatList
        data={showSkeleton || showError ? [] : items}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={header}
        renderItem={({ item }) => <LoanRow loan={item} onRepay={setToRepay} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => loans.hasNextPage && !loans.isFetchingNextPage && loans.fetchNextPage()}
        refreshControl={
          <RefreshControl
            refreshing={loans.isRefetching && !loans.isFetchingNextPage}
            onRefresh={() => {
              void loans.refetch();
              void summary.refetch();
            }}
          />
        }
        ListEmptyComponent={
          showSkeleton ? (
            <LoanListSkeleton />
          ) : showError ? (
            <ErrorState
              message={loans.error instanceof ApiError ? loans.error.message : "Something went wrong."}
              onRetry={() => void loans.refetch()}
            />
          ) : (
            <EmptyState filtered={status !== "all"} onAdd={() => router.push("/add")} />
          )
        }
      />

      <Pressable
        onPress={() => router.push("/add")}
        accessibilityRole="button"
        accessibilityLabel="Add entry"
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <ConfirmSheet
        visible={toRepay !== null}
        title="Mark as repaid?"
        message={
          toRepay
            ? `${toRepay.friendName} has paid back ${formatRupees(toRepay.amountPaise)}. ${
                online ? "" : "You’re offline, so this will sync when you’re back online."
              }`
            : ""
        }
        confirmLabel="Mark repaid"
        onConfirm={confirmRepay}
        onCancel={() => setToRepay(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { ...typography.title, color: colors.text },
  signOut: { minHeight: MIN_TOUCH - 8, justifyContent: "center" },
  signOutText: { ...typography.bodyStrong, color: colors.primary },
  list: { padding: spacing.lg, paddingBottom: 120, flexGrow: 1 },
  chips: { flexDirection: "row", gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH - 8,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.captionStrong, color: colors.text },
  chipTextSelected: { color: colors.primaryText },
  repayError: { ...typography.caption, color: colors.danger },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  fabText: { color: colors.primaryText, fontSize: 32, lineHeight: 36, fontWeight: "500" },
});
