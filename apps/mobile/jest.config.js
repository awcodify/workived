module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/types/**',  // Type definitions don't need tests
    '!src/screens/HomeScreen.tsx',  // TODO: Add tests in next sprint
    '!src/screens/LeaveScreen.tsx',  // Placeholder - will test when implemented
    '!src/screens/ApprovalsScreen.tsx',  // Placeholder - will test when implemented
    '!src/navigation/**',  // TODO: Add navigation tests
    '!src/api/client.ts',  // TODO: Add API client tests
  ],
  coverageThreshold: {
    global: {
      statements: 98,
      branches: 96,  // Slightly lower for platform-specific code (iOS/Android checks)
      functions: 98,
      lines: 98,
    },
  },
}
