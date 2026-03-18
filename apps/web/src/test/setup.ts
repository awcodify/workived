import '@testing-library/jest-dom/vitest'

// Polyfill localStorage for jsdom (needed by Zustand persist)
// jsdom defines localStorage but throws SecurityError for opaque origins
try {
  globalThis.localStorage.getItem('test')
} catch {
  const store: Record<string, string> = {}
  const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  })
}
