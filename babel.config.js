module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Reanimated 4 — worklets plugin must be listed LAST
      "react-native-worklets/plugin",
    ],
  };
};
