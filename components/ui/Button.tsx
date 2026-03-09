import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
}: ButtonProps) {
  const { colors, typography } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled || loading) return;
    scale.value = withSequence(
      withSpring(0.97, { damping: 15 }),
      withSpring(1, { damping: 12 })
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const bgColor = {
    primary:     colors.accent,
    secondary:   colors.fillPrimary,
    ghost:       "transparent",
    destructive: colors.accentRed,
  }[variant];

  const labelColor = {
    primary:     "#FFFFFF",
    secondary:   colors.label,
    ghost:       colors.accent,
    destructive: "#FFFFFF",
  }[variant];

  const height = { lg: 52, md: 44, sm: 36 }[size];
  const radius = { lg: 14, md: 12, sm: 10 }[size];
  const textStyle = size === "lg" ? typography.headline : typography.subheadline;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: bgColor, height, borderRadius: radius, opacity: disabled ? 0.4 : 1 },
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <Text style={[textStyle, { color: labelColor }]}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
});
