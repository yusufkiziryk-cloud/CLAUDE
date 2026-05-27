module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
            '@components': './components',
            '@stores': './stores',
            '@constants': './constants',
            '@hooks': './hooks',
            '@services': './services',
            '@database': './database',
          },
        },
      ],
    ],
  };
};
