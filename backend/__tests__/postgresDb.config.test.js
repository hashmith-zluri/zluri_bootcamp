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
    jest.doMock('../src/config/db', () => ({
      query: mockQuery
    }));

    postgresDbConfig = require('../src/config/postgresDb');
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

  describe('validateQuery', () => {
    it('should pass valid SELECT query', () => {
      expect(() => postgresDbConfig.validateQuery('SELECT * FROM users;')).not.toThrow();
    });

    it('should pass valid INSERT query', () => {
      expect(() => postgresDbConfig.validateQuery('INSERT INTO users (name) VALUES (\'test\');')).not.toThrow();
    });

    it('should pass valid UPDATE with WHERE', () => {
      expect(() => postgresDbConfig.validateQuery('UPDATE users SET name = \'test\' WHERE id = 1;')).not.toThrow();
    });

    it('should pass valid DELETE with WHERE', () => {
      expect(() => postgresDbConfig.validateQuery('DELETE FROM users WHERE id = 1;')).not.toThrow();
    });

    it('should reject query without semicolon', () => {
      expect(() => postgresDbConfig.validateQuery('SELECT * FROM users')).toThrow('must end with a semicolon');
    });

    it('should reject DROP TABLE', () => {
      expect(() => postgresDbConfig.validateQuery('DROP TABLE users;')).toThrow('dangerous operation');
    });

    it('should reject DROP DATABASE', () => {
      expect(() => postgresDbConfig.validateQuery('DROP DATABASE mydb;')).toThrow('dangerous operation');
    });

    it('should reject TRUNCATE', () => {
      expect(() => postgresDbConfig.validateQuery('TRUNCATE users;')).toThrow('dangerous operation');
    });

    it('should reject CREATE USER', () => {
      expect(() => postgresDbConfig.validateQuery('CREATE USER admin;')).toThrow('dangerous operation');
    });

    it('should reject GRANT', () => {
      expect(() => postgresDbConfig.validateQuery('GRANT ALL ON users TO admin;')).toThrow('dangerous operation');
    });

    it('should reject REVOKE', () => {
      expect(() => postgresDbConfig.validateQuery('REVOKE ALL ON users FROM admin;')).toThrow('dangerous operation');
    });

    it('should reject ALTER USER', () => {
      expect(() => postgresDbConfig.validateQuery('ALTER USER admin PASSWORD \'new\';')).toThrow('dangerous operation');
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics object', () => {
      const stats = postgresDbConfig.getPoolStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
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
