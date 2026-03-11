import { View } from "react-native";
import { SignIn } from "@clerk/clerk-react";
import { useTheme } from "@/hooks/useTheme";

export default function SignInScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <SignIn afterSignInUrl="/(tabs)" afterSignUpUrl="/(tabs)" />
    </View>
  );
}
