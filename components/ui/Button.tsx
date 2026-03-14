import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import { impactLight } from "@/utils/haptics";
import { useTheme } from "@/hooks/useTheme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "destructive";
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
  const { colors } = useTheme();
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
    impactLight();
    onPress();
  };

  const bgColor = {
    primary:     colors.accent,
    secondary:   colors.fillSecondary,
    ghost:       "transparent",
    outline:     "transparent",
    destructive: colors.accentRed,
  }[variant];

  const labelColor = {
    primary:     "#FFFFFF",
    secondary:   colors.label,
    ghost:       colors.accent,
    outline:     colors.accent,
    destructive: "#FFFFFF",
  }[variant];

  const height   = { lg: 52, md: 44, sm: 36 }[size];
  const fontSize = { lg: 15, md: 14, sm: 13 }[size];
  const isOutline = variant === "outline";

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: bgColor, height, opacity: disabled ? 0.4 : 1 },
          isOutline && { borderWidth: 1, borderColor: colors.accent },
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <Text style={{
            fontFamily: "Outfit_400Regular",
            fontSize,
            color: labelColor,
            letterSpacing: isOutline ? 2 : 0.1,
            textTransform: isOutline ? "uppercase" : "none",
          }}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});
