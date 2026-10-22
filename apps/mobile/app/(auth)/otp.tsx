import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/components/Button";
import { ApiError, api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../../src/theme/tokens";

const LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const { signIn } = useAuth();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  async function verify(value: string) {
    setVerifying(true);
    setError(undefined);
    try {
      await signIn(phone, value);
      // The (auth) layout redirects to the home screen once signed in.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }

  function onChange(text: string) {
    const clean = text.replace(/\D/g, "").slice(0, LENGTH);
    setCode(clean);
    setError(undefined);
    if (clean.length === LENGTH) void verify(clean);
  }

  async function resend() {
    setResending(true);
    setError(undefined);
    try {
      await api.requestOtp(phone);
      setSecondsLeft(RESEND_SECONDS);
      setCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn’t resend the code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.title}>Enter the 6-digit code</Text>
          <Text style={styles.muted}>Sent to {phone?.replace("+91", "+91 ")}</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>Wrong number?</Text>
          </Pressable>
        </View>

        {/* One real input drives six display boxes: paste, SMS autofill and backspace all just work. */}
        <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="One-time code">
          <View style={styles.boxes}>
            {Array.from({ length: LENGTH }, (_, i) => {
              const active = i === Math.min(code.length, LENGTH - 1);
              return (
                <View
                  key={i}
                  style={[styles.box, active && styles.boxActive, !!error && styles.boxError]}
                >
                  <Text style={styles.digit}>{code[i] ?? ""}</Text>
                </View>
              );
            })}
          </View>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            maxLength={LENGTH}
            autoFocus
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={styles.hiddenInput}
            caretHidden
            accessibilityLabel="6-digit code"
          />
        </Pressable>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Button label="Verify" onPress={() => verify(code)} disabled={code.length !== LENGTH} loading={verifying} />

        <View style={{ alignItems: "center" }}>
          {secondsLeft > 0 ? (
            <Text style={styles.muted}>Resend code in {secondsLeft}s</Text>
          ) : (
            <Button label="Resend code" variant="ghost" onPress={resend} loading={resending} />
          )}
        </View>

        {__DEV__ && <Text style={styles.hint}>Dev: the mock SMS provider prints the code in the API server log.</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, gap: spacing.xl, justifyContent: "center" },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted },
  link: { ...typography.bodyStrong, color: colors.primary },
  boxes: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  box: {
    flex: 1,
    height: 56,
    minWidth: MIN_TOUCH - 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { borderColor: colors.primary, borderWidth: 2 },
  boxError: { borderColor: colors.dangerBorder },
  digit: { ...typography.title, color: colors.text },
  hiddenInput: { position: "absolute", opacity: 0, width: "100%", height: "100%" },
  error: { ...typography.body, color: colors.danger },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
});
