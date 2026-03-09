import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

export function Row({ label, value, onPress, showChevron = true, destructive = false }: RowProps) {
  const { colors, typography } = useTheme();

  const content = (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <Text style={[typography.body, { color: destructive ? colors.accentRed : colors.label, flex: 1 }]}>
        {label}
      </Text>
      {value && (
        <Text style={[typography.body, { color: colors.labelSecondary, marginRight: 6 }]}>
          {value}
        </Text>
      )}
      {showChevron && onPress && (
        <Text style={[typography.body, { color: colors.labelTertiary }]}>›</Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export function RowGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  group: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
});
