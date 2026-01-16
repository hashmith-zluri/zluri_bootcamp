// Test setup file
process.env.NODE_ENV = 'test';

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// Mock MikroORM core module
jest.mock('@mikro-orm/core', () => {
  class EntitySchema {
    constructor(config) {
      this.config = config;
      this.meta = {
        className: config.class?.name || 'Entity',
        tableName: config.tableName
      };
    }
  }
  
  return {
    EntitySchema
  };
});

// Mock MikroORM at the module level to prevent loading issues
jest.mock('@mikro-orm/postgresql', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const mockClient = { query: mockQuery };
  const mockKnexClient = {
    acquireConnection: jest.fn().mockResolvedValue(mockClient),
    releaseConnection: jest.fn().mockResolvedValue(undefined)
  };
  const mockKnex = { client: mockKnexClient };
  const mockConnection = { 
    execute: jest.fn().mockResolvedValue([]),
    getKnex: jest.fn().mockReturnValue(mockKnex)
  };
  const mockEM = {
    fork: jest.fn().mockReturnThis(),
    getConnection: jest.fn().mockReturnValue(mockConnection),
    getKnex: jest.fn().mockReturnValue(mockKnex)
  };
  const mockORM = {
    em: mockEM,
    close: jest.fn().mockResolvedValue(undefined)
  };
  
  return {
    MikroORM: {
      init: jest.fn().mockResolvedValue(mockORM)
    }
  };
});

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
