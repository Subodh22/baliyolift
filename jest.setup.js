/* Global test setup: mock the native / generated modules that components pull
 * in so they render under jsdom without a real device, Convex, or Clerk. */

// Haptics call into expo-haptics native code — no-op them.
jest.mock("@/utils/haptics", () => ({
  selectionAsync: jest.fn(),
  notificationSuccess: jest.fn(),
  notificationError: jest.fn(),
  impactAsync: jest.fn(),
  impactLight: jest.fn(),
}));

// Safe-area: use the library's official jest mock (fixed insets, no native).
// Its mock is a `default` export, so unwrap it to expose the named components
// (SafeAreaView, SafeAreaProvider, useSafeAreaInsets, …).
jest.mock("react-native-safe-area-context", () => {
  const mock = require("react-native-safe-area-context/jest/mock");
  return mock.default ?? mock;
});

// The Convex generated `api` object is a deep function-tree of references.
// A self-returning proxy lets `api.overload.saveFeedback` resolve to a harmless
// stub no matter how deep the access goes.
jest.mock(
  "@/convex/_generated/api",
  () => {
    const handler = { get: () => new Proxy(() => {}, handler) };
    return { api: new Proxy(() => {}, handler) };
  },
  { virtual: true }
);
