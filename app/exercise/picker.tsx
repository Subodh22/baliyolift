import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { impactLight, selectionAsync } from "@/utils/haptics";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import { EXERCISE_SEED_DATA, CARDIO_EXERCISE_SEED_DATA, type Exercise } from "@/data/exercises";
import {
  ALL_MUSCLE_GROUPS,
  ALL_MUSCLE_GROUPS_WITH_CARDIO,
  MUSCLE_DISPLAY_NAMES,
  type MuscleGroup,
} from "@/constants/muscles";

const ALL_EXERCISES: Exercise[] = [...EXERCISE_SEED_DATA, ...CARDIO_EXERCISE_SEED_DATA];

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterPill = "all" | MuscleGroup;

type ListItem =
  | { type: "header"; key: string; title: string }
  | { type: "exercise"; key: string; exercise: Exercise };

// ─── Constants ───────────────────────────────────────────────────────────────

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 260,
  mass: 0.7,
};

const SFR_DOT_COLOR: Record<Exercise["sfr"], string> = {
  high: "#30D158",   // accentGreen
  medium: "#FF9F0A", // accentOrange
  low: "#8E8E93",    // system grey
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Animated filter pill with spring scale effect */
function FilterPillButton({
  label,
  active,
  onPress,
  colors,
  typography,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  typography: ReturnType<typeof useTheme>["typography"];
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.88, SPRING_CONFIG, () => {
      scale.value = withSpring(1, SPRING_CONFIG);
    });
    selectionAsync();
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[
          styles.filterPill,
          {
            backgroundColor: active ? colors.label : colors.backgroundTertiary,
          },
        ]}
      >
        <Text
          style={[
            typography.subheadline,
            {
              color: active ? colors.background : colors.labelSecondary,
              fontWeight: active ? "600" : "400",
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** SFR badge — coloured dot */
function SfrDot({ sfr }: { sfr: Exercise["sfr"] }) {
  return (
    <View style={[styles.sfrDot, { backgroundColor: SFR_DOT_COLOR[sfr] }]} />
  );
}

/** Single exercise row */
function ExerciseRow({
  exercise,
  onPress,
  colors,
  typography,
  isLast,
}: {
  exercise: Exercise;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  typography: ReturnType<typeof useTheme>["typography"];
  isLast: boolean;
}) {
  const muscleLabel =
    MUSCLE_DISPLAY_NAMES[exercise.muscleGroup];
  const subtitle = `${muscleLabel} · ${exercise.equipment}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.exerciseRow,
        { backgroundColor: pressed ? colors.fillTertiary : "transparent" },
      ]}
    >
      <View style={styles.exerciseRowContent}>
        <View style={styles.exerciseTextBlock}>
          <Text
            style={[typography.headline, { color: colors.label }]}
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Text
            style={[typography.caption1, { color: colors.labelSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
        <SfrDot sfr={exercise.sfr} />
      </View>
      {!isLast && (
        <View style={[styles.separator, { backgroundColor: colors.separator }]} />
      )}
    </Pressable>
  );
}

/** Section header for grouped list */
function SectionHeader({
  title,
  colors,
  typography,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>["colors"];
  typography: ReturnType<typeof useTheme>["typography"];
}) {
  return (
    <View
      style={[
        styles.sectionHeader,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <Text
        style={[
          typography.footnote,
          {
            color: colors.labelSecondary,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

/** Empty state */
function EmptyState({
  colors,
  typography,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  typography: ReturnType<typeof useTheme>["typography"];
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={[typography.headline, { color: colors.labelSecondary }]}>
        No exercises found
      </Text>
      <Text
        style={[
          typography.subheadline,
          { color: colors.labelTertiary, marginTop: 6, textAlign: "center" },
        ]}
      >
        Try clearing your search or filter
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ExercisePicker() {
  const { colors, typography } = useTheme();

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterPill>("all");
  const [highSfrOnly, setHighSfrOnly] = useState(false);

  const searchInputRef = useRef<TextInput>(null);

  // ── Filtering logic ─────────────────────────────────────────────────────

  const filtered = useMemo<Exercise[]>(() => {
    let results = ALL_EXERCISES;

    // Muscle group filter
    if (activeFilter !== "all") {
      results = results.filter((e) => e.muscleGroup === activeFilter);
    }

    // High SFR filter
    if (highSfrOnly) {
      results = results.filter((e) => e.sfr === "high");
    }

    // Search query
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter((e) => e.name.toLowerCase().includes(q));
    }

    return results;
  }, [query, activeFilter, highSfrOnly]);

  // ── List items ──────────────────────────────────────────────────────────

  const listData = useMemo<ListItem[]>(() => {
    const showGrouped = !query.trim() && activeFilter === "all";

    if (showGrouped) {
      // Group by muscle group in ALL_MUSCLE_GROUPS order
      const grouped: ListItem[] = [];

      ALL_MUSCLE_GROUPS_WITH_CARDIO.forEach((muscle) => {
        const exercises = filtered
          .filter((e) => e.muscleGroup === muscle)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (exercises.length === 0) return;

        grouped.push({
          type: "header",
          key: `header-${muscle}`,
          title: MUSCLE_DISPLAY_NAMES[muscle],
        });

        exercises.forEach((ex, i) => {
          grouped.push({
            type: "exercise",
            key: `ex-${muscle}-${ex.name}`,
            exercise: ex,
          });
        });
      });

      return grouped;
    }

    // Flat alphabetical list for search/muscle-filter mode
    const sorted = [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return sorted.map((ex) => ({
      type: "exercise" as const,
      key: `ex-${ex.name}`,
      exercise: ex,
    }));
  }, [filtered, query, activeFilter]);

  // ── Exercise selection ──────────────────────────────────────────────────

  const handleSelect = useCallback((exercise: Exercise) => {
    impactLight();
    console.log("[ExercisePicker] selected:", exercise);
    router.back();
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      if (item.type === "header") {
        return (
          <SectionHeader
            title={item.title}
            colors={colors}
            typography={typography}
          />
        );
      }

      // Determine if this exercise is the last before the next header (or end)
      const nextItem = listData[index + 1];
      const isLast = !nextItem || nextItem.type === "header";

      return (
        <ExerciseRow
          exercise={item.exercise}
          onPress={() => handleSelect(item.exercise)}
          colors={colors}
          typography={typography}
          isLast={isLast}
        />
      );
    },
    [colors, typography, listData, handleSelect]
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  // ── SFR toggle spring ───────────────────────────────────────────────────

  const sfrScale = useSharedValue(1);
  const sfrAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sfrScale.value }],
  }));

  const handleSfrToggle = () => {
    sfrScale.value = withSpring(0.9, SPRING_CONFIG, () => {
      sfrScale.value = withSpring(1, SPRING_CONFIG);
    });
    selectionAsync();
    setHighSfrOnly((v) => !v);
  };

  // ── Pill filter list ────────────────────────────────────────────────────

  const filterPills: Array<{ id: FilterPill; label: string }> = [
    { id: "all", label: "All" },
    ...ALL_MUSCLE_GROUPS_WITH_CARDIO.map((m) => ({ id: m as FilterPill, label: MUSCLE_DISPLAY_NAMES[m] })),
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      edges={["top", "bottom"]}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[typography.body, { color: colors.accent }]}>
            Cancel
          </Text>
        </TouchableOpacity>

        <Text style={[typography.headline, { color: colors.label }]}>
          Exercises
        </Text>

        {/* Spacer to balance header */}
        <View style={styles.cancelBtn} />
      </View>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <View style={styles.searchBarWrapper}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.fillSecondary },
          ]}
        >
          <Text style={[styles.searchIcon, { color: colors.labelTertiary }]}>
            🔍
          </Text>
          <TextInput
            ref={searchInputRef}
            style={[
              styles.searchInput,
              typography.body,
              { color: colors.label },
            ]}
            placeholder="Search exercises"
            placeholderTextColor={colors.labelTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="never"
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="default"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.clearIcon, { color: colors.labelTertiary }]}>
                ✕
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Muscle filter pills + SFR toggle ──────────────────────────── */}
      <View style={styles.filtersRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
          style={styles.pillsScroll}
        >
          {filterPills.map((pill) => (
            <FilterPillButton
              key={pill.id}
              label={pill.label}
              active={activeFilter === pill.id}
              onPress={() => setActiveFilter(pill.id)}
              colors={colors}
              typography={typography}
            />
          ))}
        </ScrollView>

        {/* SFR toggle — sits to the right of the scroll, always visible */}
        <Animated.View style={[styles.sfrToggleWrapper, sfrAnimStyle]}>
          <TouchableOpacity
            onPress={handleSfrToggle}
            activeOpacity={0.8}
            style={[
              styles.sfrToggle,
              {
                backgroundColor: highSfrOnly
                  ? colors.accentGreen
                  : colors.backgroundTertiary,
              },
            ]}
          >
            <View
              style={[
                styles.sfrDotSmall,
                {
                  backgroundColor: highSfrOnly ? "#fff" : SFR_DOT_COLOR.high,
                },
              ]}
            />
            <Text
              style={[
                typography.caption1,
                {
                  color: highSfrOnly ? "#fff" : colors.labelSecondary,
                  fontWeight: "600",
                },
              ]}
            >
              High SFR
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Exercise list ───────────────────────────────────────────────── */}
      <FlatList<ListItem>
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={
          listData.length === 0 ? styles.listEmptyContainer : styles.listContent
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState colors={colors} typography={typography} />
        }
        getItemLayout={undefined} // variable heights due to headers; skip fixed layout
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  cancelBtn: {
    width: 70,
  },

  // Search bar
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 9 : 6,
    gap: 6,
  },
  searchIcon: {
    fontSize: 15,
    lineHeight: 20,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
  clearIcon: {
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 2,
  },

  // Filter pills row
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
  },
  pillsScroll: {
    flexShrink: 1,
  },
  pillsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },

  // SFR toggle
  sfrToggleWrapper: {
    paddingRight: 12,
    paddingLeft: 4,
  },
  sfrToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  sfrDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // Exercise list
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  listEmptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 7,
  },

  // Exercise row
  exerciseRow: {
    paddingHorizontal: 20,
  },
  exerciseRowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 12,
  },
  exerciseTextBlock: {
    flex: 1,
  },

  // SFR indicator dot
  sfrDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    flexShrink: 0,
  },

  // Row separator
  separator: {
    height: 0.5,
    marginLeft: 0,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
});
