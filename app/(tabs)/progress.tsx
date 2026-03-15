import React, { useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, useWindowDimensions, Modal, Image, Pressable,
  TextInput, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { P, MUSCLE_BADGE_COLORS } from "@/constants/colors";
import { CG, CG_ITALIC, OUT_L, OUT } from "@/constants/typography";
import { router } from "expo-router";
import { MUSCLE_DISPLAY_NAMES } from "@/constants/muscles";

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function toPhotoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function formatDate(ts: number) {
  const d = new Date(ts), today = new Date(), yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}
function formatPhotoDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d), today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatVol(v: number): string {
  if (v >= 1000) return `${(Math.round(v / 100) / 10)}k`;
  return String(Math.round(v));
}

// ── Weight Chart ──────────────────────────────────────────────────────────────
function WeightChart({ entries }: { entries: { date: string; weightKg: number }[] }) {
  const { width } = useWindowDimensions();
  const chartW = width - 48 - 40 - 32; // scroll padding (48) + card padding (40) + y-axis marginLeft (32)
  const chartH = 80;

  const { min, max, points, avgLine } = useMemo(() => {
    if (!entries.length) return { min: 0, max: 0, points: [], avgLine: [] };
    const weights = entries.map(e => e.weightKg);
    const mn = Math.min(...weights);
    const mx = Math.max(...weights);
    const range = mx - mn || 1;
    const n = entries.length;

    const pts = entries.map((e, i) => ({
      x: (i / Math.max(n - 1, 1)) * chartW,
      y: chartH - ((e.weightKg - mn) / range) * chartH,
      w: e.weightKg,
    }));

    // 7-day rolling average
    const avgs = entries.map((_, i) => {
      const slice = entries.slice(Math.max(0, i - 6), i + 1);
      return slice.reduce((s, e) => s + e.weightKg, 0) / slice.length;
    });
    const avgPts = avgs.map((a, i) => ({
      x: (i / Math.max(n - 1, 1)) * chartW,
      y: chartH - ((a - mn) / range) * chartH,
    }));

    return { min: mn, max: mx, points: pts, avgLine: avgPts };
  }, [entries, chartW]);

  if (!entries.length) return null;

  // Build SVG-style path string for the average line
  const avgPath = avgLine.length > 1
    ? avgLine.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    : "";

  return (
    <View style={{ height: chartH + 20, marginTop: 8, overflow: "hidden" }}>
      {/* Y axis labels */}
      <View style={{ position: "absolute", left: 0, top: 0, height: chartH, justifyContent: "space-between" }}>
        <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>{max.toFixed(1)}</Text>
        <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>{min.toFixed(1)}</Text>
      </View>

      {/* Chart area */}
      <View style={{ marginLeft: 32, width: chartW, height: chartH, position: "relative" }}>
        {/* Grid line */}
        <View style={{ position: "absolute", top: chartH / 2, left: 0, right: 0, height: 1, backgroundColor: P.border }} />

        {/* Daily dots */}
        {points.map((p, i) => (
          <View key={i} style={{
            position: "absolute",
            left: p.x - 2,
            top: p.y - 2,
            width: 4, height: 4,
            borderRadius: 2,
            backgroundColor: P.s2,
          }} />
        ))}

        {/* Rolling average line — drawn as connected segments */}
        {avgLine.slice(1).map((p, i) => {
          const prev = avgLine[i];
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View key={i} style={{
              position: "absolute",
              left: prev.x,
              top: prev.y,
              width: len,
              height: 1.5,
              backgroundColor: P.gold,
              transformOrigin: "left center" as any,
              transform: [{ rotate: `${angle}deg` }],
            }} />
          );
        })}

        {/* Latest dot highlight */}
        {points.length > 0 && (
          <View style={{
            position: "absolute",
            left: points[points.length - 1].x - 4,
            top: points[points.length - 1].y - 4,
            width: 8, height: 8,
            borderRadius: 4,
            backgroundColor: P.gold,
          }} />
        )}
      </View>

      {/* X labels: first and last date */}
      {entries.length > 1 && (
        <View style={{ marginLeft: 32, flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>
            {entries[0].date.slice(5).replace("-", "/")}
          </Text>
          <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>
            {entries[entries.length - 1].date.slice(5).replace("-", "/")}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── BF Zone Bar ───────────────────────────────────────────────────────────────
const BF_ESSENTIAL = "#5AC8FA";
const BF_ATHLETIC  = P.green;
const BF_FITNESS   = "#C8A840";
const BF_AVERAGE   = "#C87820";
const BF_OBESE     = P.red;

function bfCategory(sex: "male" | "female", bf: number): { label: string; color: string } {
  if (sex === "male") {
    if (bf < 6)  return { label: "Essential", color: BF_ESSENTIAL };
    if (bf < 14) return { label: "Athletic",  color: BF_ATHLETIC };
    if (bf < 18) return { label: "Fitness",   color: BF_FITNESS };
    if (bf < 25) return { label: "Average",   color: BF_AVERAGE };
    return { label: "Obese", color: BF_OBESE };
  } else {
    if (bf < 14) return { label: "Essential", color: BF_ESSENTIAL };
    if (bf < 21) return { label: "Athletic",  color: BF_ATHLETIC };
    if (bf < 25) return { label: "Fitness",   color: BF_FITNESS };
    if (bf < 32) return { label: "Average",   color: BF_AVERAGE };
    return { label: "Obese", color: BF_OBESE };
  }
}

function estimateMonths(current: number, target: number, weekly: number): string {
  if (current <= target) return "Goal reached";
  const weeks = (current - target) / (weekly * 0.125);
  const months = Math.ceil(weeks / 4.3);
  return months <= 1 ? "~1 month" : `~${months} months`;
}

function BfZoneBar({ sex, current, target }: { sex: "male" | "female"; current: number; target: number }) {
  const minBf = sex === "male" ? 3 : 10;
  const maxBf = 40;
  const range = maxBf - minBf;
  const currentPct = Math.min(Math.max((current - minBf) / range, 0), 1);
  const targetPct  = Math.min(Math.max((target  - minBf) / range, 0), 1);
  const zones = sex === "male"
    ? [{ end: 6, c: BF_ESSENTIAL }, { end: 14, c: BF_ATHLETIC }, { end: 18, c: BF_FITNESS }, { end: 25, c: BF_AVERAGE }, { end: 40, c: BF_OBESE }]
    : [{ end: 14, c: BF_ESSENTIAL }, { end: 21, c: BF_ATHLETIC }, { end: 25, c: BF_FITNESS }, { end: 32, c: BF_AVERAGE }, { end: 40, c: BF_OBESE }];
  const cat = bfCategory(sex, current);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <Text style={{ fontFamily: CG, fontSize: 52, color: cat.color, letterSpacing: -1 }}>{current}%</Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: cat.color + "40" }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 11, color: cat.color, letterSpacing: 2, textTransform: "uppercase" }}>{cat.label}</Text>
        </View>
      </View>
      <View style={{ height: 1, flexDirection: "row", overflow: "hidden", marginBottom: 24 }}>
        {zones.map((z, i) => {
          const start = i === 0 ? minBf : zones[i - 1].end;
          return <View key={i} style={{ flex: (z.end - start) / range, backgroundColor: z.c, opacity: 0.7 }} />;
        })}
      </View>
      <View style={{ position: "relative", height: 24, marginBottom: 8 }}>
        <View style={{ position: "absolute", left: `${currentPct * 88}%` as any, alignItems: "center" }}>
          <View style={{ width: 1, height: 8, backgroundColor: P.ink }} />
          <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.ink, marginTop: 2 }}>Now</Text>
        </View>
        <View style={{ position: "absolute", left: `${targetPct * 88}%` as any, alignItems: "center" }}>
          <View style={{ width: 1, height: 8, backgroundColor: P.gold }} />
          <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.gold, marginTop: 2 }}>Goal</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <View>
          <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid }}>Now</Text>
          <Text style={{ fontFamily: CG, fontSize: 18, color: P.ink }}>{current}%</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid }}>Goal</Text>
          <Text style={{ fontFamily: CG, fontSize: 18, color: P.gold }}>{target}%</Text>
        </View>
      </View>
    </View>
  );
}

// ── Weight Roadmap ────────────────────────────────────────────────────────────
function WeightRoadmap({ profile, currentWeight }: {
  profile: { sex: "male" | "female"; currentBf: number; targetBf: number; weeklyGoal: number };
  currentWeight: number;
}) {
  const lbm          = currentWeight * (1 - profile.currentBf / 100);
  const targetWeight = lbm / (1 - profile.targetBf / 100);
  const totalChange  = targetWeight - currentWeight;
  const isCut        = totalChange < -0.5;
  const isBulk       = totalChange > 0.5;
  const weeklyRate   = isCut ? -0.5 : isBulk ? 0.3 : 0;
  const weeksTotal   = weeklyRate !== 0 ? Math.abs(totalChange) / Math.abs(weeklyRate) : 0;

  if (!isCut && !isBulk) {
    return (
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid, lineHeight: 20 }}>
          You're at your target body fat. Focus on maintaining weight within ±1 kg of {currentWeight.toFixed(1)} kg.
        </Text>
      </View>
    );
  }

  // 5 milestones: start → 25% → 50% → 75% → goal
  const milestones = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const w  = currentWeight + totalChange * pct;
    const bf = 100 * (1 - lbm / w);
    const weeks = Math.round(weeksTotal * pct);
    return { pct, weight: parseFloat(w.toFixed(1)), bf: parseFloat(bf.toFixed(1)), weeks };
  });

  const monthsTotal = (weeksTotal / 4.3).toFixed(1);
  const rateLabel   = isCut ? "−0.5 kg/week" : "+0.3 kg/week";
  const changeLabel = isCut
    ? `−${Math.abs(totalChange).toFixed(1)} kg total`
    : `+${totalChange.toFixed(1)} kg total`;

  return (
    <View style={{ marginTop: 16 }}>
      {/* Summary line */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <View>
          <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid }}>RATE</Text>
          <Text style={{ fontFamily: CG, fontSize: 18, color: P.ink, marginTop: 4 }}>{rateLabel}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid }}>CHANGE</Text>
          <Text style={{ fontFamily: CG, fontSize: 18, color: isCut ? P.green : P.gold, marginTop: 4 }}>{changeLabel}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid }}>TIMELINE</Text>
          <Text style={{ fontFamily: CG, fontSize: 18, color: P.ink, marginTop: 4 }}>~{monthsTotal} mo</Text>
        </View>
      </View>

      {/* Vertical milestone timeline */}
      {milestones.map((m, i) => {
        const isFirst = i === 0;
        const isLast  = i === milestones.length - 1;
        const bfCat   = bfCategory(profile.sex, m.bf);
        return (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* Line + dot */}
            <View style={{ width: 20, alignItems: "center" }}>
              <View style={{
                width: isFirst || isLast ? 10 : 7,
                height: isFirst || isLast ? 10 : 7,
                borderRadius: 5,
                backgroundColor: isLast ? P.gold : isFirst ? P.ink : P.s2,
                borderWidth: isFirst ? 1.5 : 0,
                borderColor: P.mid,
                marginTop: 3,
              }} />
              {!isLast && <View style={{ width: 1, flex: 1, backgroundColor: P.border, minHeight: 24 }} />}
            </View>

            {/* Content */}
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16, paddingLeft: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontFamily: CG, fontSize: isFirst || isLast ? 22 : 18, color: isLast ? P.gold : P.ink, letterSpacing: -0.5 }}>
                  {m.weight} kg
                </Text>
                <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid }}>
                  {isFirst ? "now" : `wk ${m.weeks}`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={{ fontFamily: OUT_L, fontSize: 11, color: bfCat.color }}>{m.bf}% BF</Text>
                <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.dim }}>·</Text>
                <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.dim }}>{bfCat.label}</Text>
                {isLast && (
                  <>
                    <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.dim }}>·</Text>
                    <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.gold, letterSpacing: 1 }}>GOAL</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Weekly Roadmap ────────────────────────────────────────────────────────────
const DOW_LETTERS = ["S","M","T","W","T","F","S"]; // 0=Sun…6=Sat

function WeeklyRoadmap({ sessions, workoutDates, sessionByDate, mesoName, weekNumber, weightByDate, caloriesByDate, onDayPress }: {
  sessions: { _id: string; dayOfWeek: number; name: string; muscleGroups: string[] }[];
  workoutDates: Set<string>;
  sessionByDate: Record<string, string>;
  mesoName: string;
  weekNumber: number;
  weightByDate: Record<string, number>;
  caloriesByDate: Record<string, number>;
  onDayPress: (dateStr: string) => void;
}) {
  const days = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayDow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((todayDow + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dow = d.getDay();
      const key = dayKey(d.getTime());
      const photoDate = toPhotoDate(d.getFullYear(), d.getMonth(), d.getDate());
      const session = sessions.find(s => s.dayOfWeek === dow) ?? null;
      return {
        d, dow, key, photoDate,
        date: d.getDate(),
        isToday: d.getTime() === today.getTime(),
        isPast: d < today,
        done: workoutDates.has(key),
        session,
      };
    });
  }, [sessions, workoutDates]);

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid }}>{mesoName}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.dim }}>WK</Text>
          <Text style={{ fontFamily: CG, fontSize: 16, color: P.gold }}>{weekNumber}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 4 }}>
        {days.map((day, i) => {
          const hasSession  = !!day.session;
          const weight      = weightByDate[day.photoDate];
          const cals        = caloriesByDate[day.photoDate];
          const hasData     = weight !== undefined || cals !== undefined;
          const borderColor = day.isToday ? P.gold : day.done ? P.gold + "60" : P.border;
          const bgColor     = day.done ? P.gold + "15" : day.isToday ? P.s2 : "transparent";

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.75}
              onPress={() => onDayPress(day.photoDate)}
              style={{ flex: 1, alignItems: "center" }}
            >
              {/* Day letter */}
              <Text style={{ fontFamily: OUT_L, fontSize: 10, color: day.isToday ? P.gold : P.dim, marginBottom: 4 }}>
                {DOW_LETTERS[day.dow]}
              </Text>

              {/* Day cell */}
              <View style={{
                width: "100%",
                minHeight: 72,
                borderWidth: day.isToday ? 1.5 : 1,
                borderColor,
                backgroundColor: bgColor,
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 6,
                paddingHorizontal: 2,
              }}>
                <Text style={{ fontFamily: day.isToday ? OUT : OUT_L, fontSize: 11, color: day.isToday ? P.gold : day.isPast ? P.mid : P.ink }}>
                  {day.date}
                </Text>

                {hasSession ? (
                  day.done ? (
                    <Text style={{ fontSize: 12, color: P.gold }}>✓</Text>
                  ) : (
                    <View style={{ gap: 2 }}>
                      {day.session!.muscleGroups.slice(0, 3).map((mg, j) => (
                        <View key={j} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: MUSCLE_BADGE_COLORS[mg] ?? P.mid, alignSelf: "center" }} />
                      ))}
                    </View>
                  )
                ) : (
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: P.border }} />
                )}
              </View>

              {/* Data below cell */}
              <View style={{ marginTop: 4, alignItems: "center", gap: 1 }}>
                {(day.done ? sessionByDate[day.key] : day.session?.name) ? (
                  <Text numberOfLines={1} style={{ fontFamily: OUT_L, fontSize: 8, color: day.done ? P.gold : day.isToday ? P.ink : P.mid, textAlign: "center", letterSpacing: 0.3 }}>
                    {day.done ? sessionByDate[day.key] : day.session!.name}
                  </Text>
                ) : null}
                {weight !== undefined && (
                  <Text style={{ fontFamily: OUT_L, fontSize: 8, color: P.mid, textAlign: "center" }}>
                    {weight}kg
                  </Text>
                )}
                {cals !== undefined && (
                  <Text style={{ fontFamily: OUT_L, fontSize: 8, color: P.mid, textAlign: "center" }}>
                    {cals >= 1000 ? `${(cals / 1000).toFixed(1)}k` : String(Math.round(cals))}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function E1RMChart({ points }: { points: any[] }) {
  const chartH = 72;
  const max = Math.max(...points.map((p: any) => p.e1rm));
  const min = Math.min(...points.map((p: any) => p.e1rm));
  const range = max - min || 1;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartH, gap: 4 }}>
        {points.map((p: any, i: number) => {
          const h = (0.2 + ((p.e1rm - min) / range) * 0.8) * chartH;
          const isLast = i === points.length - 1;
          return (
            <View key={i} style={{ flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
              <View style={{ width: "100%", height: h, backgroundColor: isLast ? P.gold : P.s2 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 6, gap: 4 }}>
        {points.map((p: any, i: number) => (
          <Text key={i} style={{ fontFamily: OUT_L, fontSize: 10, color: P.dim, flex: 1, textAlign: "center" }}>
            W{p.weekNumber ?? i + 1}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Calendar Heatmap (Log tab) ────────────────────────────────────────────────
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function CalendarHeatmap({ workoutDates, photoDates, onDayPress }: {
  workoutDates: Set<string>; photoDates: Set<string>; onDayPress: (d: string) => void;
}) {
  const { width } = useWindowDimensions();
  const LABEL_W = 26, LABEL_GAP = 8, H_GAP = 2, ROW_GAP = 4;
  const CELL = Math.max(6, Math.floor((width - 60 - LABEL_W - LABEL_GAP - 30 * H_GAP) / 31));

  const months = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: 12 }, (_, i) => {
      const base = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
      const year = base.getFullYear(), month = base.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const days = Array.from({ length: 31 }, (_, di) => {
        const day = di + 1;
        if (day > daysInMonth) return { empty: true };
        const cellDate = new Date(year, month, day);
        const pd = toPhotoDate(year, month, day);
        return { empty: false, isFuture: cellDate > today, hasWorkout: workoutDates.has(`${year}-${month}-${day}`), hasPhoto: photoDates.has(pd), photoDate: pd };
      });
      return { label: MONTH_SHORT[month], days };
    });
  }, [workoutDates, photoDates]);

  return (
    <View>
      {months.map((month, mi) => (
        <View key={mi} style={{ flexDirection: "row", alignItems: "center", marginBottom: mi < 11 ? ROW_GAP : 0 }}>
          <Text style={{ width: LABEL_W, fontSize: 9, color: P.dim, fontFamily: OUT_L, marginRight: LABEL_GAP }}>
            {month.label}
          </Text>
          {month.days.map((day, di) => {
            const canPress = !day.empty && !day.isFuture && (day.hasWorkout || day.hasPhoto);
            return (
              <TouchableOpacity key={di} disabled={!canPress}
                onPress={() => canPress && day.photoDate && onDayPress(day.photoDate)}
                activeOpacity={0.7}
                style={{
                  width: CELL, height: CELL, borderRadius: 1.5,
                  marginRight: di < 30 ? H_GAP : 0,
                  backgroundColor: day.empty ? "transparent" : day.hasWorkout ? P.gold : P.s2,
                  ...(day.hasPhoto && !day.empty ? { borderWidth: 1, borderColor: P.bg } : {}),
                }}
              />
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 10 }}>
        <View style={{ width: CELL, height: CELL, borderRadius: 1.5, backgroundColor: P.s2 }} />
        <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>Rest</Text>
        <View style={{ width: CELL, height: CELL, borderRadius: 1.5, backgroundColor: P.gold, marginLeft: 8 }} />
        <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>Trained</Text>
      </View>
    </View>
  );
}

const DAY_HEADERS = ["M","T","W","T","F","S","S"];

function MonthCalendar({ viewDate, workoutDates, photoDates, weightByDate, caloriesByDate, onDayPress }: any) {
  const { width } = useWindowDimensions();
  const GAP = 3;
  const CELL = Math.floor((width - 60 - 6 * GAP) / 7);
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const result: any[] = Array.from({ length: startOffset }, () => ({ day: null }));
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const pd = toPhotoDate(year, month, d);
      result.push({
        day: d,
        hasWorkout: workoutDates.has(`${year}-${month}-${d}`),
        hasPhoto: photoDates.has(pd),
        isFuture: cellDate > today,
        isToday: cellDate.toDateString() === today.toDateString(),
        photoDate: pd,
        weight: weightByDate?.[pd],
        cals: caloriesByDate?.[pd],
      });
    }
    while (result.length % 7 !== 0) result.push({ day: null });
    return result;
  }, [viewDate, workoutDates, photoDates, weightByDate, caloriesByDate, today]);

  const rows: any[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP + 2 }}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={{ width: CELL, alignItems: "center" }}>
            <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.dim }}>{d}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: GAP, marginBottom: ri < rows.length - 1 ? GAP : 0 }}>
          {row.map((cell, ci) => {
            if (cell.day === null) return <View key={ci} style={{ width: CELL }} />;
            const hasAny = cell.hasWorkout || cell.hasPhoto || cell.weight !== undefined || cell.cals !== undefined;
            return (
              <TouchableOpacity
                key={ci}
                disabled={cell.isFuture}
                onPress={() => !cell.isFuture && onDayPress(cell.photoDate)}
                activeOpacity={0.7}
                style={{
                  width: CELL, minHeight: CELL + 20,
                  borderRadius: 4,
                  backgroundColor: cell.hasWorkout ? P.gold : P.s2,
                  alignItems: "center",
                  justifyContent: "flex-start",
                  paddingTop: 4,
                  borderWidth: cell.isToday ? 1.5 : 0,
                  borderColor: P.gold,
                  opacity: cell.isFuture ? 0.3 : 1,
                }}
              >
                <Text style={{ fontFamily: cell.isToday ? OUT : OUT_L, fontSize: 11, color: cell.hasWorkout ? "#fff" : cell.isFuture ? P.border : P.mid }}>
                  {cell.day}
                </Text>
                {/* Dot indicators */}
                {!cell.isFuture && (cell.weight !== undefined || cell.cals !== undefined) && (
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 3 }}>
                    {cell.weight !== undefined && <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: cell.hasWorkout ? "rgba(255,255,255,0.7)" : P.gold }} />}
                    {cell.cals !== undefined && <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: cell.hasWorkout ? "rgba(255,255,255,0.5)" : P.mid }} />}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 10, justifyContent: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.gold }} />
          <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>weight</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.mid }} />
          <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>calories</Text>
        </View>
      </View>
    </View>
  );
}

// ── Photo Modal ───────────────────────────────────────────────────────────────
function PhotoModal({ visible, dateStr, userId, weight, cals, onClose }: any) {
  const photo = useQuery(api.progressPhotos.getTodayPhoto, visible && userId && dateStr ? { userId, date: dateStr } : "skip");
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable style={[s.photoSheet, { backgroundColor: P.s1 }]} onPress={() => {}}>
          <View style={[s.handle, { backgroundColor: P.border }]} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <View>
              <Text style={{ fontFamily: OUT, fontSize: 16, color: P.ink, marginBottom: 2 }}>Progress Photo</Text>
              <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.mid }}>
                {dateStr ? formatPhotoDate(dateStr) : ""}
              </Text>
            </View>
            {(weight !== undefined || cals !== undefined) && (
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {weight !== undefined && (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
                    <Text style={{ fontFamily: CG, fontSize: 20, color: P.gold, letterSpacing: -0.5 }}>{weight}</Text>
                    <Text style={{ fontFamily: OUT_L, fontSize: 11, color: P.mid }}>kg</Text>
                  </View>
                )}
                {cals !== undefined && (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
                    <Text style={{ fontFamily: CG, fontSize: 16, color: P.ink, letterSpacing: -0.5 }}>{Math.round(cals)}</Text>
                    <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid }}>kcal</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          {photo === undefined ? (
            <View style={{ height: 280, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={P.gold} />
            </View>
          ) : photo === null ? (
            <View style={[s.noPhoto, { borderColor: P.border }]}>
              <Text style={{ fontFamily: OUT_L, fontSize: 14, color: P.mid }}>No photo for this day</Text>
            </View>
          ) : (
            <Image source={{ uri: photo.imageUrl }} style={s.photoImg} resizeMode="cover" />
          )}
          <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: P.s2 }]}>
            <Text style={{ fontFamily: OUT, fontSize: 15, color: P.ink }}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const { userId } = useCurrentUser();
  const today = todayStr();

  const [calView, setCalView]                     = useState<"week" | "month" | "year">("week");
  const [calMonth, setCalMonth]                   = useState(() => new Date());
  const [selectedPhotoDate, setSelectedPhotoDate] = useState<string | null>(null);

  // Weight input state
  const [weightInput, setWeightInput]   = useState("");
  const [weightFocused, setWeightFocused] = useState(false);

  // Queries
  const profile       = useQuery(api.userProfile.getByUser, userId ? { userId } : "skip");
  const weeklyCount   = useQuery(api.userProfile.getWeeklyWorkouts, userId ? { userId } : "skip");
  const dashboard     = useQuery(api.progress.getDashboard, userId ? { userId } : "skip");
  const todayPhoto    = useQuery(api.progressPhotos.getTodayPhoto, userId ? { userId, date: today } : "skip");
  const todayWeight   = useQuery(api.weightTracking.getTodayWeight, userId ? { userId, date: today } : "skip");
  const weightHistory = useQuery(api.weightTracking.getWeightHistory, userId ? { userId, days: 90 } : "skip");
  const activeMeso      = useQuery(api.mesocycles.getActiveWithDetails, userId ? { userId } : "skip");
  const dailyCalories   = useQuery(api.nutrition.getDailyTotals, userId ? { userId, fromDate: (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0,10); })(), toDate: today } : "skip");
  const dateSummary = useQuery(api.workouts.getWorkoutDates, userId ? { userId } : "skip");
  const allPhotos   = useQuery(api.progressPhotos.listPhotos, userId ? { userId } : "skip");

  const logWeight = useMutation(api.weightTracking.logWeight);

  const hasPhotoToday   = !!todayPhoto;
  const progressLoading = profile === undefined || dashboard === undefined;

  // Weight stats
  const weightStats = useMemo(() => {
    if (!weightHistory || weightHistory.length < 2) return null;
    const latest = weightHistory[weightHistory.length - 1].weightKg;
    const first  = weightHistory[0].weightKg;
    const change = latest - first;

    // Weekly avg change over last 4 weeks
    const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const cutoff = fourWeeksAgo.toISOString().slice(0, 10);
    const recent = weightHistory.filter(e => e.date >= cutoff);
    let weeklyChange: number | null = null;
    if (recent.length >= 2) {
      const span = (new Date(recent[recent.length - 1].date).getTime() - new Date(recent[0].date).getTime()) / (7 * 86400000);
      weeklyChange = span > 0 ? (recent[recent.length - 1].weightKg - recent[0].weightKg) / span : null;
    }

    return { latest, change, weeklyChange };
  }, [weightHistory]);

  // Lookup maps for calendar overlays
  const weightByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of weightHistory ?? []) map[e.date] = e.weightKg;
    return map;
  }, [weightHistory]);

  const caloriesByDate = dailyCalories ?? {};

  // Lean mass
  const leanMass = profile && weightStats
    ? (weightStats.latest * (1 - profile.currentBf / 100)).toFixed(1)
    : profile
    ? (profile.weightKg * (1 - profile.currentBf / 100)).toFixed(1)
    : null;

  // Log data
  const photoDates = useMemo(() => {
    const set = new Set<string>();
    for (const p of allPhotos ?? []) set.add(p.date);
    return set;
  }, [allPhotos]);

  const workoutDates = useMemo(() => {
    const dates = new Set<string>();
    for (const w of dateSummary ?? []) dates.add(dayKey(w.date));
    return dates;
  }, [dateSummary]);

  const sessionByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of dateSummary ?? []) {
      if (w.sessionName) map[dayKey(w.date)] = w.sessionName;
    }
    return map;
  }, [dateSummary]);

  function handleLogWeight() {
    const val = parseFloat(weightInput);
    if (!userId || isNaN(val) || val <= 0) return;
    logWeight({ userId, date: today, weightKg: val });
    setWeightInput("");
    setWeightFocused(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={s.eyebrow}>YOUR JOURNEY</Text>
              <Text style={s.heroItalic}>Progress.</Text>
            </View>
            <TouchableOpacity
              onPress={() => !hasPhotoToday && router.push("/camera")}
              hitSlop={12}
              style={{ paddingTop: 4, alignItems: "flex-end", opacity: hasPhotoToday ? 0.35 : 1 }}
              disabled={hasPhotoToday}
            >
              <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 3, color: hasPhotoToday ? P.mid : P.gold }}>
                {hasPhotoToday ? "✓ LOGGED" : "⊕ CHECK IN"}
              </Text>
              <Text style={{ fontFamily: OUT_L, fontSize: 9, letterSpacing: 1, color: P.mid, marginTop: 3 }}>
                {hasPhotoToday ? "come back tomorrow" : "log today's pic"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {progressLoading && <ActivityIndicator color={P.gold} style={{ marginTop: 40 }} />}

        {!progressLoading && (
          <>
                {/* ── Weight Card ─────────────────────────────────── */}
                <Animated.View entering={FadeInDown.springify()} style={s.card}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.sectionLabel}>BODY WEIGHT</Text>
                      {todayWeight ? (
                        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 10 }}>
                          <Text style={{ fontFamily: CG, fontSize: 48, color: P.gold, letterSpacing: -1 }}>
                            {todayWeight.weightKg}
                          </Text>
                          <Text style={{ fontFamily: OUT_L, fontSize: 14, color: P.mid }}>kg</Text>
                        </View>
                      ) : (
                        <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid, marginTop: 8 }}>
                          Not logged today
                        </Text>
                      )}
                    </View>

                    {/* Log input */}
                    <View style={{ width: 110, alignItems: "flex-end", gap: 6 }}>
                      <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.mid }}>
                        {todayWeight ? "UPDATE" : "LOG TODAY"}
                      </Text>
                      <View style={[s.weightInputRow, weightFocused && { borderColor: P.gold }]}>
                        <TextInput
                          style={s.weightInput}
                          value={weightInput}
                          onChangeText={setWeightInput}
                          onFocus={() => setWeightFocused(true)}
                          onBlur={() => setWeightFocused(false)}
                          placeholder={todayWeight ? String(todayWeight.weightKg) : "0.0"}
                          placeholderTextColor={P.dim}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          onSubmitEditing={handleLogWeight}
                        />
                        <Text style={{ fontFamily: OUT_L, fontSize: 12, color: P.dim }}>kg</Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleLogWeight}
                        style={[s.logBtn, (!weightInput || isNaN(parseFloat(weightInput))) && { opacity: 0.3 }]}
                        disabled={!weightInput || isNaN(parseFloat(weightInput))}
                      >
                        <Text style={{ fontFamily: OUT_L, fontSize: 10, letterSpacing: 2, color: P.bg }}>SAVE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 30-day chart */}
                  {weightHistory && weightHistory.length > 1 && (
                    <>
                      <View style={{ height: 1, backgroundColor: P.border, marginVertical: 16 }} />
                      <WeightChart entries={weightHistory} />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <View style={{ width: 12, height: 1.5, backgroundColor: P.gold }} />
                          <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>7-day avg</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.s2 }} />
                          <Text style={{ fontFamily: OUT_L, fontSize: 9, color: P.dim }}>daily</Text>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Stats row */}
                  {weightStats && (
                    <>
                      <View style={{ height: 1, backgroundColor: P.border, marginVertical: 16 }} />
                      <View style={s.statRow}>
                        {[
                          { v: `${weightStats.latest} kg`, l: "current" },
                          {
                            v: `${weightStats.change >= 0 ? "+" : ""}${weightStats.change.toFixed(1)} kg`,
                            l: "since start",
                            color: weightStats.change === 0 ? P.mid : undefined,
                          },
                          {
                            v: weightStats.weeklyChange !== null
                              ? `${weightStats.weeklyChange >= 0 ? "+" : ""}${weightStats.weeklyChange.toFixed(2)} kg`
                              : "—",
                            l: "per week",
                          },
                        ].map(({ v, l, color }) => (
                          <View key={l} style={s.statItem}>
                            <Text style={{ fontFamily: CG, fontSize: 20, color: color ?? P.ink, letterSpacing: -0.5 }}>{v}</Text>
                            <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid, marginTop: 3 }}>{l}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </Animated.View>

                {/* ── Training Calendar (Week / Month / Year) ──────── */}
                {workoutDates && (
                  <Animated.View entering={FadeInDown.delay(50).springify()} style={[s.card, { padding: 16 }]}>
                    {/* Header row */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Text style={s.sectionLabel}>
                        {calView === "week"
                          ? "THIS WEEK"
                          : calView === "month"
                          ? `${MONTH_SHORT[calMonth.getMonth()]} ${calMonth.getFullYear()}`
                          : "12 MONTHS"}
                      </Text>
                      {/* Toggle */}
                      <View style={{ flexDirection: "row", backgroundColor: P.s2, borderRadius: 4, padding: 2 }}>
                        {(["week", "month", "year"] as const).map(v => (
                          <TouchableOpacity key={v} onPress={() => setCalView(v)}
                            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: calView === v ? P.s1 : "transparent" }}
                          >
                            <Text style={{ fontFamily: calView === v ? OUT : OUT_L, fontSize: 11, color: calView === v ? P.ink : P.dim, letterSpacing: 1 }}>
                              {v === "week" ? "WK" : v === "month" ? "MO" : "YR"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Month nav (only in month view) */}
                    {calView === "month" && (() => {
                      const now = new Date();
                      const atCurrent = calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth();
                      return (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <TouchableOpacity onPress={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                            <Text style={{ fontSize: 20, color: P.mid }}>‹</Text>
                          </TouchableOpacity>
                          <Text style={{ fontFamily: OUT, fontSize: 14, color: P.ink }}>
                            {MONTH_SHORT[calMonth.getMonth()]} {calMonth.getFullYear()}
                          </Text>
                          <TouchableOpacity onPress={() => !atCurrent && setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                            <Text style={{ fontSize: 20, color: atCurrent ? P.border : P.mid }}>›</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}

                    {/* Content */}
                    {calView === "week" && activeMeso ? (
                      <WeeklyRoadmap
                        sessions={activeMeso.sessions as any}
                        workoutDates={workoutDates}
                        sessionByDate={sessionByDate}
                        mesoName={activeMeso.name}
                        weekNumber={activeMeso.weekNumber}
                        weightByDate={weightByDate}
                        caloriesByDate={caloriesByDate}
                        onDayPress={setSelectedPhotoDate}
                      />
                    ) : calView === "week" ? (
                      <Text style={{ fontFamily: OUT_L, fontSize: 13, color: P.mid }}>No active mesocycle.</Text>
                    ) : calView === "month" ? (
                      <MonthCalendar
                        viewDate={calMonth}
                        workoutDates={workoutDates}
                        photoDates={photoDates}
                        weightByDate={weightByDate}
                        caloriesByDate={caloriesByDate}
                        onDayPress={setSelectedPhotoDate}
                      />
                    ) : (
                      <CalendarHeatmap workoutDates={workoutDates} photoDates={photoDates} onDayPress={setSelectedPhotoDate} />
                    )}
                  </Animated.View>
                )}

                {/* ── Body Composition ────────────────────────────── */}
                {profile && (
                  <Animated.View entering={FadeInDown.delay(60).springify()} style={s.card}>
                    <Text style={s.sectionLabel}>BODY COMPOSITION</Text>
                    <View style={{ marginTop: 20 }}>
                      <BfZoneBar sex={profile.sex} current={profile.currentBf} target={profile.targetBf} />
                    </View>
                    <View style={{ height: 1, backgroundColor: P.border, marginVertical: 16 }} />
                    <View style={s.statRow}>
                      <View style={s.statItem}>
                        <Text style={{ fontFamily: CG, fontSize: 20, color: P.ink, letterSpacing: -0.5 }}>
                          {leanMass} kg
                        </Text>
                        <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid, marginTop: 3 }}>lean mass</Text>
                      </View>
                      <View style={s.statItem}>
                        <Text style={{ fontFamily: CG, fontSize: 20, color: P.gold, letterSpacing: -0.5 }}>
                          {estimateMonths(profile.currentBf, profile.targetBf, profile.weeklyGoal)}
                        </Text>
                        <Text style={{ fontFamily: OUT_L, fontSize: 10, color: P.mid, marginTop: 3 }}>to goal</Text>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {/* ── Weight Roadmap ───────────────────────────────── */}
                {profile && (weightStats || profile.weightKg) && (
                  <Animated.View entering={FadeInDown.delay(80).springify()} style={s.card}>
                    <Text style={s.sectionLabel}>WEIGHT ROADMAP</Text>
                    <WeightRoadmap
                      profile={profile}
                      currentWeight={weightStats?.latest ?? profile.weightKg}
                    />
                  </Animated.View>
                )}

          </>
        )}

      </ScrollView>

      <PhotoModal
        visible={selectedPhotoDate !== null}
        dateStr={selectedPhotoDate ?? ""}
        userId={userId}
        weight={selectedPhotoDate ? weightByDate[selectedPhotoDate] : undefined}
        cals={selectedPhotoDate ? caloriesByDate[selectedPhotoDate] : undefined}
        onClose={() => setSelectedPhotoDate(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:         { paddingHorizontal: 24, paddingBottom: 100, gap: 12 },
  header:         { marginTop: 16, marginBottom: 20 },
  eyebrow:        { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.gold, textTransform: "uppercase" },
  heroItalic:     { fontFamily: CG_ITALIC, fontSize: 52, letterSpacing: -0.5, lineHeight: 58, marginTop: 10, color: P.ink },
  sectionLabel:   { fontFamily: OUT_L, fontSize: 10, letterSpacing: 4, color: P.mid, textTransform: "uppercase" },
  card:           { backgroundColor: P.s1, padding: 20, borderWidth: 1, borderColor: P.border, overflow: "hidden" },
  divRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  statRow:        { flexDirection: "row", justifyContent: "space-around" },
  statItem:       { alignItems: "center" },
  prCard:         { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: P.border, backgroundColor: P.s1 },
  prStripe:       { width: 3, alignSelf: "stretch", backgroundColor: P.gold },
  photoSheet:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle:         { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  noPhoto:        { height: 160, borderRadius: 4, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  photoImg:       { width: "100%", height: 320, borderRadius: 4, marginBottom: 16 },
  closeBtn:       { paddingVertical: 14, borderRadius: 4, alignItems: "center" },
  tabToggle:      { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: P.border },
  tabBtn:         { paddingVertical: 10, paddingHorizontal: 4, marginRight: 24 },
  tabBtnActive:   { borderBottomWidth: 1, borderBottomColor: P.gold },
  tabBtnText:     { fontFamily: OUT_L, fontSize: 11, letterSpacing: 3 },
  weightInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: P.border, backgroundColor: P.s2, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  weightInput:    { fontFamily: OUT_L, fontSize: 16, color: P.ink, flex: 1, textAlign: "right", borderWidth: 0 },
  logBtn:         { backgroundColor: P.gold, paddingHorizontal: 16, paddingVertical: 7, alignItems: "center" },
});
