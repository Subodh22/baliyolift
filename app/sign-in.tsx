import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useSignIn, useSignUp, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");

  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    try {
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL("/(tabs)", { scheme: "baliyolift" }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      Alert.alert("Google Sign In Failed", e.errors?.[0]?.message ?? e.message ?? "Something went wrong");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) { Alert.alert("Enter email and password"); return; }
    setLoading(true);
    try {
      if (mode === "sign_in" && signIn) {
        const result = await signIn.create({ identifier: email, password });
        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId });
          router.replace("/(tabs)");
        }
      } else if (mode === "sign_up" && signUp) {
        const result = await signUp.create({ emailAddress: email, password });
        if (result.status === "complete") {
          await setSignUpActive!({ session: result.createdSessionId });
          router.replace("/(tabs)");
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.errors?.[0]?.message ?? e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <Text style={[typography.largeTitle, { color: colors.label, fontWeight: "800", marginBottom: 8 }]}>
          BaliYoLift
        </Text>
        <Text style={[typography.body, { color: colors.labelSecondary, marginBottom: 40 }]}>
          RP-style hypertrophy tracking
        </Text>

        {/* Google Sign In */}
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}
          onPress={handleGoogleSignIn}
          activeOpacity={0.8}
          disabled={oauthLoading}
        >
          {oauthLoading ? (
            <ActivityIndicator color={colors.label} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[typography.body, { color: colors.label, fontWeight: "600" }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.separator }]} />
          <Text style={[typography.footnote, { color: colors.labelTertiary, marginHorizontal: 12 }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.separator }]} />
        </View>

        <TextInput
          style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.label, borderColor: colors.separator }]}
          placeholder="Email"
          placeholderTextColor={colors.labelTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.label, borderColor: colors.separator }]}
          placeholder="Password"
          placeholderTextColor={colors.labelTertiary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.accent }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>
              {mode === "sign_in" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setMode(m => m === "sign_in" ? "sign_up" : "sign_in")}>
          <Text style={[typography.subheadline, { color: colors.accent }]}>
            {mode === "sign_in" ? "No account? Sign up" : "Have an account? Sign in"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: "center" },
  googleBtn: {
    height: 52, borderRadius: 14, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginBottom: 4,
  },
  googleIcon: {
    fontSize: 18, fontWeight: "700", color: "#4285F4",
    fontFamily: "System",
  },
  divider: {
    flexDirection: "row", alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 0.5 },
  input: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 12,
  },
  btn: {
    height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
});
