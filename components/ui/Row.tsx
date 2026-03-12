import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { P } from "@/constants/colors";
import { OUT_L, OUT } from "@/constants/typography";

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

export function Row({ label, value, onPress, showChevron = true, destructive = false }: RowProps) {
  const content = (
    <View style={styles.row}>
      <Text style={[styles.label, { color: destructive ? P.red : P.ink }]}>
        {label}
      </Text>
      {value && (
        <Text style={styles.value}>{value}</Text>
      )}
      {showChevron && onPress && (
        <Text style={{ color: P.dim, fontSize: 16, marginLeft: 4 }}>›</Text>
      )}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.65}>{content}</TouchableOpacity>;
  }
  return content;
}

export function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.group}>
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
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  label: {
    flex: 1,
    fontFamily: OUT,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  value: {
    fontFamily: OUT_L,
    fontSize: 15,
    marginRight: 4,
    color: P.mid,
  },
  group: {
    backgroundColor: P.s1,
    borderWidth: 1,
    borderColor: P.border,
    overflow: "hidden",
    marginBottom: 8,
  },
});
