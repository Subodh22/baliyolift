import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { notificationSuccess, impactMedium } from "@/utils/haptics";

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TIMER_OPTIONS = [0, 3, 10];

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [selectedTimer, setSelectedTimer] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { userId } = useCurrentUser();
  const savePhoto = useMutation(api.progressPhotos.savePhoto);
  const todayDate = todayDateString();

  const handleShutter = useCallback(() => {
    if (countdown !== null) return; // already counting

    if (selectedTimer === 0) {
      takePicture();
      return;
    }

    setCountdown(selectedTimer);
    let remaining = selectedTimer;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      impactMedium();
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setCountdown(null);
        takePicture();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [selectedTimer, countdown]);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    impactMedium();
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false });
    if (photo?.uri) setCapturedUri(photo.uri);
  };

  const handleRetake = () => {
    setCapturedUri(null);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
  };

  const handleUpload = async () => {
    if (!capturedUri || !userId) return;
    setUploading(true);
    try {
      const convexSiteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL!;
      const imageBlob = await (await fetch(capturedUri)).blob();
      const response = await fetch(`${convexSiteUrl}/upload-photo`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: imageBlob,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { url } = await response.json();
      await savePhoto({ userId, imageUrl: url, date: todayDate });
      notificationSuccess();
      router.back();
    } catch (e) {
      console.log("Upload error:", e);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center", gap: 16 }]}>
        <Text style={{ color: "#fff", fontSize: 16, textAlign: "center", paddingHorizontal: 32 }}>
          Camera access is required for progress photos.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.uploadBtn}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#888", fontSize: 14 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Preview screen ─────────────────────────────────────────────────────────
  if (capturedUri) {
    return (
      <View style={styles.screen}>
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleRetake} style={styles.topBtn}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Retake</Text>
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", opacity: 0.7 }}>
            Progress Photo
          </Text>
          <View style={{ width: 64 }} />
        </View>

        {/* Use photo button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            style={[styles.uploadBtn, { opacity: uploading ? 0.7 : 1 }]}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>Use Photo</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Camera screen ──────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />

      {/* Countdown overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", opacity: 0.7 }}>
          Progress Photo
        </Text>
        {/* Flip */}
        <TouchableOpacity
          onPress={() => setFacing(f => f === "back" ? "front" : "back")}
          style={styles.topBtn}
        >
          <Text style={{ color: "#fff", fontSize: 22 }}>⇄</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Timer selector */}
        <View style={styles.timerRow}>
          {TIMER_OPTIONS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setSelectedTimer(t)}
              style={[
                styles.timerPill,
                { backgroundColor: selectedTimer === t ? "#fff" : "rgba(255,255,255,0.2)" }
              ]}
            >
              <Text style={{
                color: selectedTimer === t ? "#000" : "#fff",
                fontWeight: "700",
                fontSize: 13,
              }}>
                {t === 0 ? "Off" : `${t}s`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Shutter */}
        <TouchableOpacity
          onPress={handleShutter}
          disabled={countdown !== null}
          style={[styles.shutter, { opacity: countdown !== null ? 0.5 : 1 }]}
          activeOpacity={0.8}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <View style={{ height: 44 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  topBtn: {
    width: 64,
    alignItems: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingTop: 24,
    alignItems: "center",
    gap: 24,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  timerRow: {
    flexDirection: "row",
    gap: 10,
  },
  timerPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  countdownText: {
    fontSize: 120,
    fontWeight: "900",
    color: "#fff",
    opacity: 0.9,
  },
  uploadBtn: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
});
