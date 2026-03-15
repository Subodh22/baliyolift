import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, Modal,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { P } from "@/constants/colors";
import { OUT, OUT_L } from "@/constants/typography";

function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  // Already a bare ID (11 chars, alphanumeric + - _)
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // youtu.be/ID
  const short = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/shorts/ID or /watch?v=ID or /embed/ID
  const long = trimmed.match(/(?:v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  if (long) return long[1];
  return null;
}

interface Props {
  exerciseName: string;
  exerciseId: Id<"exercises">;
  onClose: () => void;
  onSaved: (videoId: string) => void;
}

export function AddVideoModal({ exerciseName, exerciseId, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const setVideoUrl = useMutation(api.exercises.setVideoUrl);

  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const id = extractYouTubeId(url);
    if (!id) {
      setError("Couldn't find a YouTube video ID in that URL. Try pasting the full link.");
      return;
    }
    setSaving(true);
    try {
      await setVideoUrl({ exerciseId, videoUrl: url.trim() });
      onSaved(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.overlay}
      >
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          {/* Header */}
          <Text style={s.title}>No video for this exercise</Text>
          <Text style={s.sub}>
            Paste a YouTube link for <Text style={{ color: P.ink }}>{exerciseName}</Text> and it'll be saved for next time.
          </Text>

          {/* Input */}
          <TextInput
            value={url}
            onChangeText={(t) => { setUrl(t); setError(""); }}
            placeholder="https://youtu.be/..."
            placeholderTextColor={P.mid}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
          {!!error && (
            <Text style={s.errorText}>{error}</Text>
          )}

          {/* Buttons */}
          <View style={s.btnRow}>
            <Pressable onPress={onClose} style={[s.btn, s.cancelBtn]}>
              <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.ink }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving || !url.trim()} style={[s.btn, s.saveBtn, (!url.trim() || saving) && { opacity: 0.5 }]}>
              {saving
                ? <ActivityIndicator color={P.bg} size="small" />
                : <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.bg, letterSpacing: 0.5 }}>SAVE & PLAY</Text>
              }
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: P.s1, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 24, borderWidth: 1, borderColor: P.border },
  title:     { fontFamily: OUT, fontSize: 17, color: P.ink, marginBottom: 6 },
  sub:       { fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20, marginBottom: 20 },
  input:     { backgroundColor: P.s2, borderRadius: 6, borderWidth: 1, borderColor: P.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: OUT_L, fontSize: 13, color: P.ink, marginBottom: 8 },
  errorText: { fontFamily: OUT_L, fontSize: 12, color: "#CF4444", marginBottom: 8 },
  btnRow:    { flexDirection: "row", gap: 10, marginTop: 8 },
  btn:       { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 6 },
  cancelBtn: { backgroundColor: P.s2 },
  saveBtn:   { backgroundColor: P.gold },
});
