const { Pool } = require('pg');

// Mock pg before requiring db.js
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockPool = {
    query: mockQuery
  };
  return {
    Pool: jest.fn(() => mockPool),
    mockQuery
  };
});

describe('DB Config', () => {
  let dbConfig;
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Get the mock query function
    const pg = require('pg');
    mockQuery = pg.mockQuery;
  });

  describe('query function', () => {
    it('should be exported', () => {
      dbConfig = require('../src/config/db');
      expect(dbConfig.query).toBeDefined();
      expect(dbConfig.pool).toBeDefined();
    });

    it('should execute query and return result', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
      dbConfig = require('../src/config/db');
      
      const result = await dbConfig.query('SELECT * FROM users', []);
      
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', []);
    });

    it('should use empty array as default params', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      dbConfig = require('../src/config/db');
      
      await dbConfig.query('SELECT 1');
      
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should log query in non-test environment', async () => {
      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Reset modules to pick up new env
      jest.resetModules();
      
      // Re-mock pg
      jest.doMock('pg', () => {
        const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
        return {
          Pool: jest.fn(() => ({ query: mockQuery })),
          mockQuery
        };
      });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const db = require('../src/config/db');
      await db.query('SELECT * FROM test', []);
      
      expect(consoleSpy).toHaveBeenCalledWith('executed query', expect.objectContaining({
        text: 'SELECT * FROM test'
      }));
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});
