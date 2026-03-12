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
  const { colors } = useTheme();

  const content = (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <Text style={[styles.label, { color: destructive ? colors.accentRed : colors.label }]}>
        {label}
      </Text>
      {value && (
        <Text style={[styles.value, { color: colors.labelSecondary }]}>{value}</Text>
      )}
      {showChevron && onPress && (
        <Text style={{ color: colors.labelTertiary, fontSize: 16, marginLeft: 4 }}>›</Text>
      )}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.65}>{content}</TouchableOpacity>;
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
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  label: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    letterSpacing: -0.1,
  },
  value: {
    fontFamily: "Outfit_300Light",
    fontSize: 15,
    marginRight: 4,
  },
  group: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 8,
  },
});
