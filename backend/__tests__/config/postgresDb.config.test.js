describe('PostgresDb Config', () => {
  let postgresDbConfig;
  let mockQuery;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock pg
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn().mockResolvedValue(undefined),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0
    };

    jest.doMock('pg', () => ({
      Pool: jest.fn(() => mockPool)
    }));

    // Mock db config
    mockQuery = jest.fn();
    jest.doMock('../../src/config/db', () => ({
      query: mockQuery
    }));

    postgresDbConfig = require('../../src/config/postgresDb');
  });

  describe('createTargetDbConnection', () => {
    it('should create pool with provided config', () => {
      const config = {
        host: 'db.example.com',
        port: 5433,
        database: 'mydb',
        username: 'admin',
        password: 'secret'
      };

      const pool = postgresDbConfig.createTargetDbConnection(config);
      expect(pool).toBeDefined();
    });

    it('should use defaults for missing config', () => {
      const pool = postgresDbConfig.createTargetDbConnection({ database: 'testdb' });
      expect(pool).toBeDefined();
    });

    it('should enable SSL for Neon databases', () => {
      const config = {
        host: 'ep-test-123.us-east-1.aws.neon.tech',
        database: 'neondb',
        username: 'user',
        password: 'pass'
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const pool = postgresDbConfig.createTargetDbConnection(config);
      
      expect(pool).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SSL enabled for Neon database')
      );
      
      consoleSpy.mockRestore();
    });

    it('should not enable SSL for non-Neon databases', () => {
      const config = {
        host: 'localhost',
        database: 'localdb',
        username: 'user',
        password: 'pass'
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const pool = postgresDbConfig.createTargetDbConnection(config);
      
      expect(pool).toBeDefined();
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('SSL enabled')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('executeTargetQuery', () => {
    it('should execute query successfully', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES',
          username: 'user',
          password: 'pass'
        }]
      });

      mockClient.query
        .mockResolvedValueOnce({}) // SET statement_timeout
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test' }],
          rowCount: 1,
          fields: [{ name: 'id', dataTypeID: 23 }, { name: 'name', dataTypeID: 25 }]
        });

      const result = await postgresDbConfig.executeTargetQuery(1, 'test_db', 'SELECT * FROM users;');

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rowCount).toBe(1);
      expect(result.fields).toBeDefined();
    });

    it('should reuse existing pool', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 5,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES'
        }]
      });

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // First call creates pool
      await postgresDbConfig.executeTargetQuery(5, 'test_db', 'SELECT 1;');
      
      // Second call should reuse pool
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const result = await postgresDbConfig.executeTargetQuery(5, 'test_db', 'SELECT 2;');

      expect(result.success).toBe(true);
    });

    it('should return error when instance not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await postgresDbConfig.executeTargetQuery(999, 'test_db', 'SELECT 1;');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for non-PostgreSQL engine', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          host: 'localhost',
          port: 27017,
          engine: 'MONGO'
        }]
      });

      const result = await postgresDbConfig.executeTargetQuery(1, 'test_db', 'SELECT 1;');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('should handle query execution errors', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 2,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES'
        }]
      });

      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('relation "users" does not exist'));

      const result = await postgresDbConfig.executeTargetQuery(2, 'test_db', 'SELECT * FROM users;');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client on success', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 3,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES'
        }]
      });

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await postgresDbConfig.executeTargetQuery(3, 'test_db', 'SELECT 1;');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics object', () => {
      const stats = postgresDbConfig.getPoolStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should return pool statistics with actual pool data', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 999,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES'
        }]
      });

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Create a pool by executing a query
      await postgresDbConfig.executeTargetQuery(999, 'test_db', 'SELECT 1;');
      
      const stats = postgresDbConfig.getPoolStats();
      
      expect(stats).toBeDefined();
      expect(stats['999_test_db']).toBeDefined();
      expect(stats['999_test_db'].type).toBe('postgres');
      expect(stats['999_test_db'].totalCount).toBe(5);
      expect(stats['999_test_db'].idleCount).toBe(3);
      expect(stats['999_test_db'].waitingCount).toBe(0);
    });

    it('should return pool statistics with waitingCount property', async () => {
      // Test line 127 - waitingCount property access
      mockQuery.mockResolvedValue({
        rows: [{
          id: 998,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES'
        }]
      });

      // Mock pool with waitingCount > 0
      const mockPoolWithWaiting = {
        connect: jest.fn().mockResolvedValue(mockClient),
        end: jest.fn().mockResolvedValue(undefined),
        totalCount: 10,
        idleCount: 2,
        waitingCount: 3 // This tests line 127
      };

      jest.doMock('pg', () => ({
        Pool: jest.fn(() => mockPoolWithWaiting)
      }));

      // Re-require to get new mock
      jest.resetModules();
      const postgresDbConfigNew = require('../../src/config/postgresDb');

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await postgresDbConfigNew.executeTargetQuery(998, 'test_db', 'SELECT 1;');
      
      const stats = postgresDbConfigNew.getPoolStats();
      
      expect(stats['998_test_db'].waitingCount).toBe(3);
    });
  });

  describe('closeAllPools', () => {
    it('should close all pools', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 50,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES'
        }]
      });

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await postgresDbConfig.executeTargetQuery(50, 'test_db', 'SELECT 1;');
      
      await postgresDbConfig.closeAllPools();
      
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 51,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES'
        }]
      });

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await postgresDbConfig.executeTargetQuery(51, 'test_db', 'SELECT 1;');
      
      mockPool.end.mockRejectedValue(new Error('Close failed'));
      
      await expect(postgresDbConfig.closeAllPools()).resolves.not.toThrow();
    });
  });
});
