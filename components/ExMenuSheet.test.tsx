import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ExMenuSheet } from "./ExMenuSheet";

describe("ExMenuSheet", () => {
  it("renders the title (uppercased) and every option label", () => {
    render(
      <ExMenuSheet
        visible
        title="Options"
        options={[
          { label: "Swap exercise", onPress: jest.fn() },
          { label: "Delete", destructive: true, onPress: jest.fn() },
        ]}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("OPTIONS")).toBeTruthy();
    expect(screen.getByText("Swap exercise")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("fires the option's onPress AND closes the sheet when tapped", () => {
    const onPress = jest.fn();
    const onClose = jest.fn();
    render(
      <ExMenuSheet
        visible
        title="Options"
        options={[{ label: "Swap exercise", onPress }]}
        onClose={onClose}
      />
    );
    fireEvent.press(screen.getByText("Swap exercise"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes without firing any option when Cancel is tapped", () => {
    const onPress = jest.fn();
    const onClose = jest.fn();
    render(
      <ExMenuSheet
        visible
        title="Options"
        options={[{ label: "Delete", destructive: true, onPress }]}
        onClose={onClose}
      />
    );
    fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
