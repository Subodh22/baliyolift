import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";

// WebView is native-only — lazy import so web bundle doesn't break
const WebView = Platform.OS !== "web"
  ? require("react-native-webview").WebView
  : null;

interface Props {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  videoId: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIDEO_HEIGHT = Math.round(SCREEN_WIDTH * 9 / 16);

export function VideoModal({ visible, onClose, exerciseName, videoId }: Props) {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const embedUri = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[typography.headline, { color: colors.label, flex: 1 }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.label, fontSize: 15, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Player */}
        <View style={[styles.playerWrapper, { backgroundColor: "#000" }]}>
          {Platform.OS === "web" ? (
            // @ts-ignore — iframe is a valid DOM element in RN Web
            <iframe
              src={embedUri}
              width={SCREEN_WIDTH}
              height={VIDEO_HEIGHT}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              style={{ border: "none" }}
            />
          ) : (
            <WebView
              source={{ uri: embedUri }}
              style={styles.webview}
              javaScriptEnabled
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              originWhitelist={["*"]}
            />
          )}
        </View>

        {/* Label */}
        <View style={[styles.labelRow, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.labelSecondary, fontSize: 13 }}>
            Instructional video — watch for form cues
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  playerWrapper: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
  },
  webview: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: "#000",
  },
  labelRow: {
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
});
