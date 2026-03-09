import React, { createContext, useContext, useState } from "react";

export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  targetSets: number;
}

interface ActiveWorkout {
  workoutId: string | null;
  sessionId: string | null;
  currentExerciseIndex: number;
  startTime: number | null;
  exercises: WorkoutExercise[];
}

interface WorkoutContextValue {
  activeWorkout: ActiveWorkout;
  isActive: boolean;
  startWorkout: (sessionId: string, exercises: WorkoutExercise[]) => void;
  endWorkout: () => void;
  nextExercise: () => void;
  prevExercise: () => void;
  currentExercise: WorkoutExercise | null;
}

const DEFAULT_STATE: ActiveWorkout = {
  workoutId: null,
  sessionId: null,
  currentExerciseIndex: 0,
  startTime: null,
  exercises: [],
};

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout>(DEFAULT_STATE);

  const startWorkout = (sessionId: string, exercises: WorkoutExercise[]) => {
    setActiveWorkout({
      workoutId: Date.now().toString(),
      sessionId,
      currentExerciseIndex: 0,
      startTime: Date.now(),
      exercises,
    });
  };

  const endWorkout = () => {
    setActiveWorkout(DEFAULT_STATE);
  };

  const nextExercise = () => {
    setActiveWorkout((prev) => ({
      ...prev,
      currentExerciseIndex: Math.min(
        prev.currentExerciseIndex + 1,
        prev.exercises.length - 1
      ),
    }));
  };

  const prevExercise = () => {
    setActiveWorkout((prev) => ({
      ...prev,
      currentExerciseIndex: Math.max(prev.currentExerciseIndex - 1, 0),
    }));
  };

  const isActive = activeWorkout.workoutId !== null;
  const currentExercise =
    activeWorkout.exercises[activeWorkout.currentExerciseIndex] ?? null;

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        isActive,
        startWorkout,
        endWorkout,
        nextExercise,
        prevExercise,
        currentExercise,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}
