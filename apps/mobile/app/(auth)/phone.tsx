import { phoneSchema } from "@miniledger/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { ApiError, api } from "../../src/lib/api";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function PhoneScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const ready = digits.length === 10;

  async function submit() {
    const phone = `+91${digits}`;
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      await api.requestOtp(phone);
      router.push({ pathname: "/otp", params: { phone } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.brand}>MiniLedger</Text>
          <Text style={styles.title}>Enter your mobile number</Text>
          <Text style={styles.muted}>We’ll send you a 6-digit code to sign in.</Text>
        </View>

        <Input
          label="Mobile number"
          prefix="+91"
          value={digits}
          onChangeText={(t) => {
            setDigits(t.replace(/\D/g, "").slice(0, 10));
            setError(undefined);
          }}
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
          placeholder="98765 43210"
          textContentType="telephoneNumber"
          autoComplete="tel"
          error={error}
          onSubmitEditing={() => ready && submit()}
        />

        <Button label="Send OTP" onPress={submit} disabled={!ready} loading={loading} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, gap: spacing.xl, justifyContent: "center" },
  brand: { ...typography.captionStrong, color: colors.primary, textTransform: "uppercase", letterSpacing: 1 },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted },
});
