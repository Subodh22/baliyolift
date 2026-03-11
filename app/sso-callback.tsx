import { View, ActivityIndicator, Platform } from "react-native";
import { useTheme } from "@/hooks/useTheme";

// Use Clerk's built-in callback handler on web
let AuthenticateWithRedirectCallback: any = null;
if (Platform.OS === "web") {
  AuthenticateWithRedirectCallback =
    require("@clerk/clerk-react").AuthenticateWithRedirectCallback;
}

export default function SSOCallback() {
  const { colors } = useTheme();

  if (Platform.OS === "web" && AuthenticateWithRedirectCallback) {
    return (
      <AuthenticateWithRedirectCallback
        afterSignInUrl="/(tabs)"
        afterSignUpUrl="/(tabs)"
      />
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}
