module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated must be listed last (required by react-native-reanimated v4).
      'react-native-worklets/plugin',
    ],
  };
};
