import React from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { P } from "@/constants/colors";

interface Option {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  options: Option[];
  onClose: () => void;
}

export function ExMenuSheet({ visible, title, options, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[s.handle, { backgroundColor: colors.separator }]} />
        <Text style={{ fontFamily: "Outfit_300Light", fontSize: 12, letterSpacing: 2, color: colors.labelTertiary, textAlign: "center", marginBottom: 16 }}>
          {title.toUpperCase()}
        </Text>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => { onClose(); opt.onPress(); }}
            activeOpacity={0.7}
            style={[s.row, { borderTopColor: colors.separator, borderTopWidth: i === 0 ? 0 : 0.5 }]}
          >
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 16, color: opt.destructive ? P.red : colors.label }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={[s.cancel, { borderTopColor: colors.separator }]}>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 16, color: colors.labelSecondary }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:    { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, paddingBottom: 34, paddingHorizontal: 0 },
  handle:   { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  row:      { paddingVertical: 16, alignItems: "center" },
  cancel:   { paddingVertical: 16, alignItems: "center", marginTop: 4, borderTopWidth: 0.5 },
});
