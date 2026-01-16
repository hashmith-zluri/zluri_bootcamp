const { initORM, getORM, getEM, closeORM, query } = require('../../src/config/db');

// Mock MikroORM
jest.mock('@mikro-orm/postgresql', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [{ id: 1, name: 'test' }], rowCount: 1 });
  const mockClient = { query: mockQuery };
  const mockKnexClient = {
    acquireConnection: jest.fn().mockResolvedValue(mockClient),
    releaseConnection: jest.fn().mockResolvedValue(undefined)
  };
  const mockKnex = { client: mockKnexClient };
  const mockConnection = { 
    execute: jest.fn().mockResolvedValue([{ id: 1, name: 'test' }]),
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
    },
    __mockORM: mockORM,
    __mockEM: mockEM,
    __mockQuery: mockQuery,
    __mockClient: mockClient
  };
});

describe('Database Configuration (db.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initORM', () => {
    it('should initialize MikroORM successfully', async () => {
      const { MikroORM } = require('@mikro-orm/postgresql');
      
      const orm = await initORM();
      
      expect(MikroORM.init).toHaveBeenCalled();
      expect(orm).toBeDefined();
    });

    it('should return existing ORM if already initialized', async () => {
      const orm1 = await initORM();
      const orm2 = await initORM();
      
      expect(orm1).toBe(orm2);
    });
  });

  describe('getORM', () => {
    it('should return the ORM instance after initialization', async () => {
      await initORM();
      const orm = getORM();
      
      expect(orm).toBeDefined();
      expect(orm.em).toBeDefined();
    });

    it('should throw error when ORM not initialized', async () => {
      // Close ORM first to reset state
      await closeORM();
      
      expect(() => getORM()).toThrow('ORM not initialized. Call initORM() first.');
    });
  });

  describe('getEM', () => {
    it('should return a forked EntityManager', async () => {
      await initORM();
      const em = getEM();
      
      expect(em).toBeDefined();
      expect(em.getConnection).toBeDefined();
    });
  });

  describe('closeORM', () => {
    it('should close the ORM connection', async () => {
      await initORM();
      await closeORM();
      
      // After closing, getORM should throw
      // But since we're mocking, we just verify close was called
      const { __mockORM } = require('@mikro-orm/postgresql');
      expect(__mockORM.close).toHaveBeenCalled();
    });

    it('should handle closing when ORM is not initialized', async () => {
      // This should not throw
      await expect(closeORM()).resolves.not.toThrow();
    });
  });

  describe('query', () => {
    it('should execute a query and return formatted results', async () => {
      await initORM();
      
      const result = await query('SELECT * FROM users WHERE id = $1', [1]);
      
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it('should handle empty results', async () => {
      const { __mockQuery } = require('@mikro-orm/postgresql');
      __mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      await initORM();
      const result = await query('SELECT * FROM users WHERE id = $1', [999]);
      
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle non-array results (INSERT/UPDATE)', async () => {
      const { __mockQuery } = require('@mikro-orm/postgresql');
      __mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      
      await initORM();
      const result = await query('UPDATE users SET name = $1 WHERE id = $2', ['test', 1]);
      
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(1);
    });

    it('should use default empty params array', async () => {
      await initORM();
      
      const result = await query('SELECT 1');
      
      expect(result).toBeDefined();
    });

    it('should log query execution in non-test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await initORM();
      await query('SELECT * FROM users', []);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'executed query',
        expect.objectContaining({
          text: 'SELECT * FROM users',
          duration: expect.any(Number),
          rows: expect.any(Number)
        })
      );
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});
