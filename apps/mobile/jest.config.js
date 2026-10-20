/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Rendering the whole catalog with a cold transform cache can take several seconds (slower on Windows CI).
  testTimeout: 20000,
  moduleNameMapper: {
    '^react-native-reanimated$': '<rootDir>/jest/reanimated-entry.js',
    '^react-native-reanimated/mock$': '<rootDir>/jest/reanimated.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|standard-navigation|@react-native-async-storage/.*|@testing-library/.*))',
  ],
};
