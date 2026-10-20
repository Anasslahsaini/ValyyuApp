/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Rendering the whole catalog with a cold transform cache can take several seconds (slower on Windows CI).
  testTimeout: 20000,
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@testing-library/.*))',
  ],
};
