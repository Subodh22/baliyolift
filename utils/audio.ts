import { Platform } from "react-native";

// ─── WEB / PWA ────────────────────────────────────────────────────────────────
// iOS Safari & PWA suspend the AudioContext until a user gesture occurs.
// Call unlockAudioContext() from the root layout on the first touch/click
// so subsequent playChime() calls work without a gesture.

let _audioCtx: AudioContext | null = null;
let _chimeBuffer: AudioBuffer | null = null;

function getOrCreateCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
  if (!Ctor) return null;
  if (!_audioCtx) {
    _audioCtx = new Ctor();
    // Pre-decode the chime buffer so playback is instant when triggered
    fetch("/timer-complete.wav")
      .then((r) => r.arrayBuffer())
      .then((buf) => _audioCtx!.decodeAudioData(buf))
      .then((decoded) => {
        _chimeBuffer = decoded;
      })
      .catch(() => {});
  }
  return _audioCtx;
}

/** Call once from the root layout on first user touch to unlock iOS WebKit audio. */
export function unlockAudioContext() {
  if (Platform.OS !== "web") return;
  const ctx = getOrCreateCtx();
  if (ctx?.state === "suspended") ctx.resume().catch(() => {});
}

async function playChimeWeb() {
  try {
    const ctx = getOrCreateCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();

    if (_chimeBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = _chimeBuffer;
      src.connect(ctx.destination);
      src.start(0);
    } else {
      // Buffer not ready yet — fall back to HTMLAudioElement
      const el = new Audio("/timer-complete.wav");
      el.volume = 1;
      await el.play().catch(() => {});
    }
  } catch {}
}

// ─── NATIVE ───────────────────────────────────────────────────────────────────
// playsInSilentModeIOS  — plays through the silent/ring switch
// staysActiveInBackground — keeps audio session alive when app is backgrounded

async function playChimeNative() {
  try {
    const { Audio } = await import("expo-av");
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../assets/timer-complete.wav"),
      { shouldPlay: true, volume: 1.0 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
  } catch {}
}

// ─── UNIFIED ──────────────────────────────────────────────────────────────────
export async function playChime() {
  if (Platform.OS === "web") {
    await playChimeWeb();
  } else {
    await playChimeNative();
  }
}
