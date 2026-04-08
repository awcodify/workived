import '@testing-library/react-native/extend-expect'

// Mock axios to avoid stream issues
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  })),
}))

// Mock Expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}))

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}))

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  NavigationContainer: ({ children }: any) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}))

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  })),
}))

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  })),
}))

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
}
