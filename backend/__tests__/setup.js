// Test setup file
process.env.NODE_ENV = 'test';

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// Global test utilities
global.mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER'
};

global.mockManager = {
  id: 2,
  email: 'manager@example.com',
  name: 'Test Manager',
  role: 'MANAGER'
};

// Suppress console.error during tests unless needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes?.('Test error') || process.env.SHOW_ERRORS === 'true') {
      originalError(...args);
    }
  };
});

afterAll(() => {
  console.error = originalError;
});
