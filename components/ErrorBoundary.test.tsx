import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ crash }: { crash: boolean }): React.ReactElement {
  if (crash) throw new Error("kaboom from render");
  return <Text>all good</Text>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs the caught error to console.error; silence it for clean output.
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Boom crash={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("all good")).toBeTruthy();
  });

  it("shows the fallback with the real error message instead of a black screen", () => {
    render(
      <ErrorBoundary>
        <Boom crash={true} />
      </ErrorBoundary>
    );
    // This is the whole point: the user sees the message, not a blank screen.
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("kaboom from render")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("recovers when 'Try again' is pressed after the child stops throwing", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Boom crash={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();

    // Child is fixed, then user taps retry → boundary resets and renders it.
    rerender(
      <ErrorBoundary>
        <Boom crash={false} />
      </ErrorBoundary>
    );
    fireEvent.press(screen.getByText("Try again"));
    expect(screen.getByText("all good")).toBeTruthy();
  });
});
