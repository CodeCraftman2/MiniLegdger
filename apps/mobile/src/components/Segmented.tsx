import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, typography } from "../theme/tokens";

type Option<T extends string> = { value: T; label: string };

/** iOS-style segmented control: a grey track with a white thumb under the selected option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: colors.segmentTrack, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, paddingHorizontal: 8 },
  selected: { backgroundColor: colors.surface, ...shadow.card },
  text: { ...typography.captionStrong, color: colors.textMuted },
  textSelected: { color: colors.text },
});
