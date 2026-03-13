import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Pressable, LayoutAnimation, Platform, UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import { router } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { notificationSuccess, selectionAsync } from "@/utils/haptics";
import { P } from "@/constants/colors";
import { CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";
import { Id } from "@/convex/_generated/dataModel";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Meso = {
  _id: Id<"mesocycles">;
  name: string;
  status: "active" | "completed" | "deload";
  weeks: number;
  weekNumber: number;
  sessions: {
    _id: Id<"sessions">;
    name: string;
    dayOfWeek: number;
    muscleGroups: string[];
    exercises: { id: Id<"exercises">; name: string; muscleGroup: string }[];
  }[];
};

// ── Meso accordion card ────────────────────────────────────────────────────────
function MesoCard({
  meso,
  onEnd,
  onActivate,
}: {
  meso: Meso;
  onEnd: () => void;
  onActivate: () => void;
}) {
  const [open, setOpen] = useState(meso.status === "active");
  const isActive = meso.status === "active";
  const pct = isActive ? ((meso.weekNumber - 1) / meso.weeks) * 100 : 100;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  const statusLabel =
    meso.status === "active" ? "ACTIVE" :
    meso.status === "deload" ? "DELOAD" : "COMPLETED";

  const statusColor =
    meso.status === "active" ? P.gold :
    meso.status === "deload" ? "#7BA7BC" : P.mid;

  return (
    <View style={[s.mesoCard, isActive && { borderColor: P.gold + "40" }]}>
      {/* Header row — tap to expand */}
      <Pressable onPress={toggle} style={s.mesoHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <View style={[s.statusPill, { backgroundColor: statusColor + "18" }]}>
              <Text style={{ fontFamily: OUT_L, fontSize: 9, color: statusColor, letterSpacing: 1.5 }}>
                {statusLabel}
              </Text>
            </View>
            {isActive && (
              <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid }}>
                Week {meso.weekNumber} / {meso.weeks}
              </Text>
            )}
          </View>
          <Text style={{ fontFamily: OUT, fontSize: 17, color: P.ink, letterSpacing: -0.2 }}>
            {meso.name}
          </Text>
          <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid, marginTop: 2 }}>
            {meso.sessions.length} sessions · {meso.weeks} weeks
          </Text>
        </View>
        <Text style={{ fontFamily: OUT_L, fontSize: 18, color: P.mid, paddingLeft: 12 }}>
          {open ? "⌃" : "⌄"}
        </Text>
      </Pressable>

      {/* Progress bar — active only */}
      {isActive && (
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` as any }]} />
        </View>
      )}

      {/* Sessions list — collapsible */}
      {open && (
        <View style={[s.sessionsList, { borderTopColor: P.border }]}>
          {meso.sessions.map((session) => (
            <View key={session._id as string} style={[s.sessionRow, { borderBottomColor: P.border }]}>
              <View style={s.dayBadge}>
                <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid }}>
                  {DAY_LABELS[session.dayOfWeek]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: OUT, fontSize: 14, color: P.ink }}>{session.name}</Text>
                <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid, marginTop: 2 }}>
                  {session.muscleGroups
                    .map((m) => MUSCLE_DISPLAY_NAMES[m as keyof typeof MUSCLE_DISPLAY_NAMES] ?? m)
                    .join(" · ")}
                </Text>
                {session.exercises.length > 0 && (
                  <View style={{ marginTop: 6, gap: 3 }}>
                    {session.exercises.map((ex) => (
                      <View key={ex.id as string} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: P.gold }} />
                        <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid }}>{ex.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* Action buttons */}
          <View style={s.actionRow}>
            {isActive ? (
              <Pressable onPress={onEnd} style={[s.actionBtn, s.dangerBtn]}>
                <Text style={{ fontFamily: OUT_L, fontSize: 12, color: "#CF4444", letterSpacing: 1 }}>
                  END MESOCYCLE
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={onActivate} style={[s.actionBtn, s.activateBtn]}>
                <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.gold, letterSpacing: 1 }}>
                  SET ACTIVE
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Warning modal ──────────────────────────────────────────────────────────────
function WarningSheet({
  title,
  body,
  confirmLabel,
  confirmDanger,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string; body: string; confirmLabel: string; confirmDanger: boolean;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <View style={s.overlay}>
      <Animated.View entering={FadeInDown.springify().damping(18)} style={s.sheet}>
        <Text style={{ fontFamily: OUT, fontSize: 17, color: P.ink, marginBottom: 8 }}>{title}</Text>
        <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20, marginBottom: 24 }}>{body}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={onCancel} style={[s.sheetBtn, { backgroundColor: P.s2, flex: 1 }]}>
            <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.ink }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={onConfirm} disabled={loading}
            style={[s.sheetBtn, { backgroundColor: confirmDanger ? "#CF4444" : P.gold, flex: 1 }]}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontFamily: OUT_L, fontSize: 13, color: confirmDanger ? "#fff" : P.bg, letterSpacing: 0.5 }}>
                  {confirmLabel}
                </Text>
            }
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function PlanScreen() {
  const { userId, loading: userLoading } = useCurrentUser();
  const mesoList = useQuery(api.mesocycles.listAllWithSessions, userId ? { userId } : "skip");
  const completeMeso = useMutation(api.mesocycles.complete);
  const setActiveMeso = useMutation(api.mesocycles.setActive);

  const [endTarget, setEndTarget] = useState<Id<"mesocycles"> | null>(null);
  const [activateTarget, setActivateTarget] = useState<Id<"mesocycles"> | null>(null);
  const [busy, setBusy] = useState(false);

  const isLoading = userLoading || mesoList === undefined;
  const hasActive = mesoList?.some((m) => m.status === "active");

  const handleEnd = async () => {
    if (!endTarget || !userId) return;
    setBusy(true);
    try { notificationSuccess(); await completeMeso({ mesocycleId: endTarget }); }
    finally { setBusy(false); setEndTarget(null); }
  };

  const handleActivate = async () => {
    if (!activateTarget || !userId) return;
    setBusy(true);
    try { notificationSuccess(); await setActiveMeso({ userId, mesocycleId: activateTarget }); }
    finally { setBusy(false); setActivateTarget(null); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>Your program</Text>
            <Text style={s.hero}>Mesocycles.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/meso/new")} activeOpacity={0.7} style={s.newBtn}>
            <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.gold, letterSpacing: 1 }}>+ NEW</Text>
          </TouchableOpacity>
        </View>

        {isLoading && <ActivityIndicator color={P.gold} style={{ marginTop: 40 }} />}

        {/* Empty state */}
        {!isLoading && (!mesoList || mesoList.length === 0) && (
          <Animated.View entering={FadeInDown.springify()} style={s.emptyCard}>
            <Text style={{ fontFamily: OUT, fontSize: 17, color: P.ink, marginBottom: 8 }}>No mesocycles yet</Text>
            <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20, marginBottom: 20 }}>
              A mesocycle is a structured training block designed to progressively overload your muscles over 4–6 weeks.
            </Text>
            <Pressable onPress={() => router.push("/meso/new")} style={s.createBtn}>
              <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.gold, letterSpacing: 1 }}>CREATE MESOCYCLE</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Meso list */}
        {!isLoading && mesoList && mesoList.length > 0 && (
          <View style={{ gap: 12, marginTop: 4 }}>
            {(mesoList as Meso[]).map((meso, i) => (
              <Animated.View key={meso._id as string} entering={FadeInDown.delay(i * 60).springify()}>
                <MesoCard
                  meso={meso}
                  onEnd={() => setEndTarget(meso._id)}
                  onActivate={() => { selectionAsync(); setActivateTarget(meso._id); }}
                />
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* End meso warning */}
      {endTarget && (
        <WarningSheet
          title="End this mesocycle?"
          body="Your training history is saved. You can create a new mesocycle or reactivate this one later."
          confirmLabel="END"
          confirmDanger
          onConfirm={handleEnd}
          onCancel={() => setEndTarget(null)}
          loading={busy}
        />
      )}

      {/* Activate meso warning */}
      {activateTarget && (
        <WarningSheet
          title={hasActive ? "Switch active mesocycle?" : "Activate mesocycle?"}
          body={
            hasActive
              ? "Your current active mesocycle will be marked as completed. This mesocycle will start fresh from today."
              : "This mesocycle will be set as active and start from today."
          }
          confirmLabel="ACTIVATE"
          confirmDanger={false}
          onConfirm={handleActivate}
          onCancel={() => setActivateTarget(null)}
          loading={busy}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:       { paddingHorizontal: 20, paddingBottom: 100 },
  header:       { marginTop: 16, marginBottom: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  eyebrow:      { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, textTransform: "uppercase" },
  hero:         { fontFamily: CG_ITALIC, fontSize: 52, color: P.ink, letterSpacing: -0.5, lineHeight: 58, marginTop: 8 },
  newBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: P.border },

  mesoCard:     { borderRadius: 4, borderWidth: 1, borderColor: P.border, backgroundColor: P.s1, overflow: "hidden" },
  mesoHeader:   { flexDirection: "row", alignItems: "center", padding: 16 },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2 },
  progressTrack:{ height: 1, backgroundColor: P.border, marginHorizontal: 16, marginBottom: 0 },
  progressFill: { height: 1, backgroundColor: P.gold },

  sessionsList: { borderTopWidth: 1 },
  sessionRow:   { flexDirection: "row", gap: 12, padding: 14, borderBottomWidth: 0.5 },
  dayBadge:     { width: 36, height: 36, borderRadius: 4, backgroundColor: P.s2, alignItems: "center", justifyContent: "center" },

  actionRow:    { padding: 14 },
  actionBtn:    { paddingVertical: 12, alignItems: "center", borderRadius: 4, borderWidth: 1 },
  dangerBtn:    { borderColor: "#CF444440", backgroundColor: "#CF44440C" },
  activateBtn:  { borderColor: P.gold + "40", backgroundColor: P.goldDim },

  emptyCard:    { marginTop: 20, borderRadius: 4, borderWidth: 1, borderColor: P.border, backgroundColor: P.s1, padding: 20 },
  createBtn:    { borderWidth: 1, borderColor: P.gold + "60", paddingVertical: 12, alignItems: "center", borderRadius: 4, backgroundColor: P.goldDim },

  overlay:      { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: P.s1, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 24, borderWidth: 1, borderColor: P.border },
  sheetBtn:     { paddingVertical: 14, alignItems: "center", borderRadius: 4 },
});
