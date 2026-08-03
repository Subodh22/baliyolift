import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { useMutation } from "convex/react";
import { FeedbackModal } from "./FeedbackModal";

jest.mock("convex/react", () => ({ useMutation: jest.fn() }));

const saveMock = jest.fn((..._args: any[]) => Promise.resolve());
const anyId = "id_123" as any;

function renderModal(overrides: Partial<React.ComponentProps<typeof FeedbackModal>> = {}) {
  const onSave = jest.fn();
  const onCancel = jest.fn();
  render(
    <FeedbackModal
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

beforeEach(() => {
  saveMock.mockClear();
  (useMutation as jest.Mock).mockReturnValue(saveMock);
});

describe("FeedbackModal", () => {
  it("renders nothing when not visible", () => {
    renderModal({ visible: false });
    expect(screen.queryByText("FEEDBACK")).toBeNull();
  });

  it("renders the muscle section and its questions when visible", () => {
    renderModal();
    expect(screen.getByText("FEEDBACK")).toBeTruthy();
    expect(screen.getByText("CHEST SORENESS")).toBeTruthy();
    expect(screen.getByText("CHEST PUMP")).toBeTruthy();
    expect(screen.getByText("CHEST WORKLOAD")).toBeTruthy();
    expect(screen.getByText("SAVE")).toBeTruthy();
  });

  it("saves the default feedback (soreness 2 / pump 1 / workload 1) on SAVE", async () => {
    const { onSave } = renderModal();
    fireEvent.press(screen.getByText("SAVE"));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith({
      workoutId: anyId,
      userId: anyId,
      feedback: [{ muscleGroup: "chest", soreness: 2, pump: 1, workload: 1 }],
    });
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it("reflects option clicks in the saved payload", async () => {
    renderModal();
    // Change every signal away from its default.
    fireEvent.press(screen.getByText("Never got\nsore")); // soreness 0
    fireEvent.press(screen.getByText("Amazing\npump")); // pump 2
    fireEvent.press(screen.getByText("Too\nmuch")); // workload 3
    fireEvent.press(screen.getByText("SAVE"));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: [{ muscleGroup: "chest", soreness: 0, pump: 2, workload: 3 }],
      })
    );
  });

  it("supports multiple muscles independently", async () => {
    renderModal({ muscleGroups: ["chest", "back"] });
    // The last-pressed matching option wins for each group's field.
    fireEvent.press(screen.getAllByText("I'm still\nsore!")[0]); // chest soreness 3
    fireEvent.press(screen.getAllByText("Easy")[1]); // back workload 0
    fireEvent.press(screen.getByText("SAVE"));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    const payload = saveMock.mock.calls[0][0] as any;
    expect(payload.feedback).toHaveLength(2);
    const chest = payload.feedback.find((f: any) => f.muscleGroup === "chest");
    const back = payload.feedback.find((f: any) => f.muscleGroup === "back");
    expect(chest.soreness).toBe(3);
    expect(back.workload).toBe(0);
  });

  it("calls onCancel without saving when CANCEL is pressed", () => {
    const { onCancel } = renderModal();
    fireEvent.press(screen.getByText("CANCEL"));
    expect(onCancel).toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });
});
