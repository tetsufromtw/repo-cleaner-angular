// Mock localStorage for tests
const mockStorage = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockStorage.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage.store[key];
  }),
  clear: jest.fn(() => {
    mockStorage.store = {};
  })
};

Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
  writable: true
});

// Mock console methods to reduce noise in tests
Object.defineProperty(global, 'console', {
  value: {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  },
  writable: true
});