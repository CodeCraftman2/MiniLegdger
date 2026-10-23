import { buildUpiUri, formatRupees, isValidUpiId, type Loan } from "@miniledger/shared";
import { useEffect, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { QrCode } from "../../components/QrCode";
import { ResizableSheet } from "../../components/ResizableSheet";
import { deleteUpiProfile, loadUpiProfile, saveUpiProfile, type UpiProfile } from "../../lib/upi-store";
import { colors, radius, spacing, typography } from "../../theme/tokens";

type Props = {
  loan: Loan | null;
  onClose: () => void;
  /** The friend says they've paid: hand over to the normal "record a payment" sheet. */
  onPaid: (loan: Loan) => void;
};

/**
 * Shows a UPI QR for what is owed right now, plus a shareable message. The money goes straight to the
 * lender's UPI ID, so the app can't confirm it arrived: the lender records it once it shows in their bank app.
 * It opens part-way and can be dragged up to almost full screen.
 */
export function RequestPaymentSheet({ loan, onClose, onPaid }: Props) {
  const [profile, setProfile] = useState<UpiProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!loan) return;
    let live = true;
    void loadUpiProfile().then((p) => {
      if (!live) return;
      setProfile(p);
      setUpiId(p?.upiId ?? "");
      setName(p?.payeeName ?? "");
      setEditing(p === null);
      setConfirmRemove(false);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [loan?.id]);

  if (!loan) return null;
  const owed = loan.balance.owedPaise;

  async function save() {
    const id = upiId.trim();
    if (!isValidUpiId(id)) return setError("Enter a UPI ID like name@bank");
    const next = { upiId: id, payeeName: name.trim() };
    try {
      await saveUpiProfile(next);
    } catch {
      // Not being able to remember it is fine; it still works for this request.
    }
    setProfile(next);
    setEditing(false);
    setError(undefined);
  }

  async function remove() {
    try {
      await deleteUpiProfile();
    } catch {
      // If storage fails the form below still lets the user enter a new one.
    }
    setProfile(null);
    setUpiId("");
    setName("");
    setConfirmRemove(false);
    setEditing(true);
  }

  const uri = profile
    ? buildUpiUri({ upiId: profile.upiId, payeeName: profile.payeeName, amountPaise: owed, note: "MiniLedger" })
    : null;

  function share() {
    if (!profile) return;
    const amount = formatRupees(owed, { alwaysShowPaise: true });
    void Share.share({
      message: `Hi ${loan!.friendName}, you owe me ${amount}. Please pay it to my UPI ID ${profile.upiId} (or scan the QR I send).`,
    });
  }

  return (
    <ResizableSheet title={`Ask ${loan.friendName} to pay`} onClose={onClose} initialRatio={0.62}>
      {!loaded ? null : editing || !profile ? (
        <>
          <Text style={styles.message}>
            Enter your UPI ID so {loan.friendName} can pay you directly. It is saved on this phone only.
          </Text>
          <Input
            label="Your UPI ID"
            value={upiId}
            onChangeText={(v) => {
              setUpiId(v);
              setError(undefined);
            }}
            placeholder="name@bank"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            error={error}
          />
          <Input
            label="Your name (shown when they pay)"
            value={name}
            onChangeText={setName}
            placeholder="Optional"
            autoCapitalize="words"
            maxLength={40}
          />
          <Button label="Save and show QR" onPress={() => void save()} />
        </>
      ) : (
        <>
          <Text style={styles.amount}>{formatRupees(owed, { alwaysShowPaise: true })}</Text>
          <Text style={styles.message}>
            They scan this with any UPI app (GPay, PhonePe, Paytm…) and the amount is filled in.
            {loan.balance.interestDuePaise > 0 ? " Interest grows daily, so make a fresh QR if they pay on a later day." : ""}
          </Text>
          <View style={styles.qrWrap}>{uri && <QrCode value={uri} size={248} />}</View>
          <Text style={styles.upi} selectable>
            {profile.upiId}
          </Text>

          <View style={styles.actions}>
            <Button label="Share message" variant="secondary" onPress={share} style={{ flex: 1 }} />
            <Button label="They’ve paid" onPress={() => onPaid(loan)} style={{ flex: 1 }} />
          </View>
          <Text style={styles.hint}>
            MiniLedger can’t see UPI payments. Once the money shows in your bank app, tap “They’ve paid” to record it.
          </Text>
          {confirmRemove ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.hint}>Remove {profile.upiId}? You can add a new UPI ID straight after.</Text>
              <View style={styles.actions}>
                <Button label="Keep it" variant="secondary" onPress={() => setConfirmRemove(false)} style={{ flex: 1 }} />
                <Button label="Remove" variant="danger" onPress={() => void remove()} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button label="Edit UPI ID" variant="ghost" onPress={() => setEditing(true)} style={{ flex: 1 }} />
              <Button label="Remove & add new" variant="ghost" onPress={() => setConfirmRemove(true)} style={{ flex: 1 }} />
            </View>
          )}
        </>
      )}
    </ResizableSheet>
  );
}

const styles = StyleSheet.create({
  amount: { ...typography.amount, color: colors.text, textAlign: "center" },
  message: { ...typography.body, color: colors.textMuted },
  qrWrap: { alignSelf: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: "#FFFFFF" },
  upi: { ...typography.bodyStrong, color: colors.text, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
});
