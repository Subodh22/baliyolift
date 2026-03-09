// react-dom shim for React Native (Clerk uses portals which don't apply in RN)
module.exports = {
  createPortal: (children) => children,
  render: () => {},
  unmountComponentAtNode: () => {},
  findDOMNode: () => null,
  unstable_batchedUpdates: (fn) => fn(),
  flushSync: (fn) => fn(),
  version: "18.0.0",
};
