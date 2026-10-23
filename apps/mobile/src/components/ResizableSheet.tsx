import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing, typography } from "../theme/tokens";

type Props = {
  title: string;
  onClose: () => void;
  /** How much of the screen the sheet takes when it opens (0–1). Drag the handle to resize. */
  initialRatio?: number;
  children: ReactNode;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Bottom sheet you can drag taller (up to nearly full screen) or shorter. Fling it down to close.
 * It grows to full height by itself when the keypad opens, so the fields stay in view.
 * Built on PanResponder + Animated, so it needs no extra native modules.
 */
export function ResizableSheet({ title, onClose, initialRatio = 0.6, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // The sheet sits above the keypad, so the tallest it can be shrinks while the keypad is open.
  const maxHeight = windowHeight - keyboard - insets.top - spacing.sm;
  const collapsed = Math.min(windowHeight * initialRatio, maxHeight);

  const height = useRef(new Animated.Value(collapsed)).current;
  const startHeight = useRef(collapsed);
  const limits = useRef({ collapsed, maxHeight, onClose });
  limits.current = { collapsed, maxHeight, onClose };

  const animateTo = (value: number) =>
    Animated.spring(height, { toValue: value, useNativeDriver: false, bounciness: 0, speed: 16 }).start();

  // Keypad opened: use all the room there is. Keypad closed: settle back to a sensible size.
  const wasKeyboard = useRef(false);
  useEffect(() => {
    if (keyboard > 0) animateTo(maxHeight);
    else if (wasKeyboard.current) animateTo(collapsed);
    wasKeyboard.current = keyboard > 0;
  }, [keyboard]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        height.stopAnimation((v) => {
          startHeight.current = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        height.setValue(clamp(startHeight.current - g.dy, 0, limits.current.maxHeight));
      },
      onPanResponderRelease: (_e, g) => {
        const { collapsed: small, maxHeight: big, onClose: close } = limits.current;
        const current = clamp(startHeight.current - g.dy, 0, big);
        if (current < small * 0.6 || g.vy > 1.4) return close();
        if (g.vy < -0.4) return animateTo(big);
        if (g.vy > 0.4) return animateTo(small);
        animateTo(Math.abs(current - big) < Math.abs(current - small) ? big : small);
      },
    }),
  ).current;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
      <Animated.View style={[styles.sheet, { height, bottom: keyboard }]} accessibilityViewIsModal>
        <View {...pan.panHandlers} style={styles.grabArea}>
          <View style={styles.handle} accessibilityLabel="Drag to resize" />
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.sm,
            // Content padding (not the ScrollView's) so the last button scrolls fully into view.
            paddingBottom: spacing.xl + (keyboard > 0 ? 0 : insets.bottom) + spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
    ...shadow.raised,
  },
  grabArea: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  closeBtn: { minHeight: 44, justifyContent: "center" },
  close: { ...typography.bodyStrong, color: colors.primary },
});
