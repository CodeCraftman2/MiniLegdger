import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

const QUIET = 4; // modules of white border the QR spec asks for

/**
 * QR code drawn with plain Views (no SVG/native module). Each row is merged into runs of dark
 * modules, so a typical UPI code is a few hundred Views rather than a thousand.
 */
export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  const { rows, count } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const out: { y: number; x: number; len: number }[] = [];
    for (let y = 0; y < n; y++) {
      let x = 0;
      while (x < n) {
        if (!qr.isDark(y, x)) {
          x++;
          continue;
        }
        const start = x;
        while (x < n && qr.isDark(y, x)) x++;
        out.push({ y, x: start, len: x - start });
      }
    }
    return { rows: out, count: n };
  }, [value]);

  const cell = size / (count + QUIET * 2);

  return (
    <View
      accessible
      accessibilityLabel="QR code for the UPI payment"
      style={[styles.box, { width: size, height: size }]}
    >
      {rows.map((r) => (
        <View
          key={`${r.y}-${r.x}`}
          style={{
            position: "absolute",
            left: (r.x + QUIET) * cell,
            top: (r.y + QUIET) * cell,
            width: r.len * cell,
            height: cell,
            backgroundColor: "#000000",
          }}
        />
      ))}
    </View>
  );
}

// A QR code must be dark on light, so it stays white even in a dark theme.
const styles = StyleSheet.create({ box: { backgroundColor: "#FFFFFF" } });
