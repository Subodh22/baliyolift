import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { useMutation } from "convex/react";
import { FeedbackModal } from "./FeedbackModal";

jest.mock("convex/react", () => ({ useMutation: jest.fn() }));

const saveMock = jest.fn((..._args: any[]) => Promise.resolve());
const anyId = "id_123" as any;

beforeEach(() => {
  saveMock.mockClear();
  (useMutation as jest.Mock).mockReturnValue(saveMock);
});

// ─── Soreness mode (session start) ────────────────────────────────────────────

describe("FeedbackModal — soreness mode", () => {
  function renderSoreness(overrides: any = {}) {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(
      <FeedbackModal
        mode="soreness"
        visible
        muscleGroups={["chest"]}
        workoutId={anyId}
        userId={anyId}
        onSave={onSave}
        onCancel={onCancel}
        {...overrides}
      />
    );
    return { onSave, onCancel };
  }

  it("renders nothing when not visible", () => {
    renderSoreness({ visible: false });
    expect(screen.queryByText("RECOVERY CHECK")).toBeNull();
  });

  it("asks only soreness per muscle", () => {
    renderSoreness();
    expect(screen.getByText("RECOVERY CHECK")).toBeTruthy();
    expect(screen.getByText("CHEST SORENESS")).toBeTruthy();
    expect(screen.queryByText("CHEST PUMP")).toBeNull();
    expect(screen.getByText("START")).toBeTruthy();
  });

  it("saves default soreness (2) on START", async () => {
    const { onSave } = renderSoreness();
    fireEvent.press(screen.getByText("START"));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith({
      workoutId: anyId,
      userId: anyId,
      feedback: [{ muscleGroup: "chest", soreness: 2 }],
    });
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it("reflects a soreness pick in the payload", async () => {
    renderSoreness();
    fireEvent.press(screen.getByText("I'm still\nsore!")); // soreness 3
    fireEvent.press(screen.getByText("START"));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ feedback: [{ muscleGroup: "chest", soreness: 3 }] })
    );
  });

  it("calls onCancel without saving when CANCEL is pressed", () => {
    const { onCancel } = renderSoreness();
    fireEvent.press(screen.getByText("CANCEL"));
    expect(onCancel).toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });
});

// ─── Exercise mode (post-work) ────────────────────────────────────────────────

describe("FeedbackModal — exercise mode", () => {
  const exercises = [
    { exerciseId: "ex_1" as any, name: "Incline Barbell Press", muscleGroup: "chest" },
  ];

  function renderExercise(overrides: any = {}) {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(
      <FeedbackModal
        mode="exercise"
        visible
        exercises={exercises}
        workoutId={anyId}
        userId={anyId}
        onSave={onSave}
        onCancel={onCancel}
        {...overrides}
      />
    );
    return { onSave, onCancel };
  }

  it("asks pump + workload per exercise (no soreness)", () => {
    renderExercise();
    expect(screen.getByText("FEEDBACK")).toBeTruthy();
    expect(screen.getByText("Incline Barbell Press")).toBeTruthy();
    expect(screen.getByText("PUMP")).toBeTruthy();
    expect(screen.getByText("WORKLOAD")).toBeTruthy();
    expect(screen.queryByText("SORENESS")).toBeNull();
  });

  it("saves default pump/workload (1/1) keyed by exerciseId", async () => {
    const { onSave } = renderExercise();
    fireEvent.press(screen.getByText("SAVE"));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith({
      workoutId: anyId,
      userId: anyId,
      feedback: [{ exerciseId: "ex_1", muscleGroup: "chest", pump: 1, workload: 1 }],
    });
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it("reflects pump/workload picks in the payload", async () => {
    renderExercise();
    fireEvent.press(screen.getByText("Amazing\npump")); // pump 2
    fireEvent.press(screen.getByText("Too\nmuch")); // workload 3
    fireEvent.press(screen.getByText("SAVE"));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: [{ exerciseId: "ex_1", muscleGroup: "chest", pump: 2, workload: 3 }],
      })
    );
  });
});
