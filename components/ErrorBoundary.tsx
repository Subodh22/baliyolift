import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { captureError } from "@/utils/monitoring";

type Props = {
  children: React.ReactNode;
  /** Optional label so we know which boundary tripped (e.g. "workout"). */
  name?: string;
};

type State = {
  error: Error | null;
};

/**
 * Catches render/runtime errors in the subtree and shows the actual error
 * instead of unmounting to a black screen. Without this, any thrown error
 * (including a Convex `useQuery` that errors after a DB write) blanks the whole
 * app against the near-black background and gives the user nothing to report.
 *
 * Error boundaries MUST be class components — there is no hook equivalent.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface it in the JS console / Convex logs so we can see it even when the
    // fallback UI is dismissed.
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`,
      error,
      info.componentStack
    );
    // Report to Sentry with the boundary label + React component stack.
    captureError(error, {
      boundary: this.props.name ?? "root",
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A0B", paddingHorizontal: 24, justifyContent: "center" }}>
        <ScrollView contentContainerStyle={{ paddingVertical: 48 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: "#FF6B6B", fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: "#EDEDED", fontSize: 15, marginBottom: 20 }}>
            {error.message || "An unexpected error occurred."}
          </Text>

          {!!error.stack && (
            <View style={{ backgroundColor: "#161618", borderRadius: 10, padding: 12, marginBottom: 24 }}>
              <Text style={{ color: "#8A8A8E", fontSize: 11, fontFamily: "Courier" }}>
                {error.stack.split("\n").slice(0, 14).join("\n")}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={this.reset}
            activeOpacity={0.8}
            style={{ backgroundColor: "#2E7DFF", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}
