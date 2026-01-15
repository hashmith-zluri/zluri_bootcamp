const executionService = require('../../src/services/execution.service');
const postgresExecutionService = require('../../src/services/postgres.service');
const mongoExecutionService = require('../../src/services/mongo.service');
const postgresScriptService = require('../../src/services/postgresScript.service');
const mongoScriptService = require('../../src/services/mongoScript.service');
const { query } = require('../../src/config/db');

// Mock all dependencies
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

jest.mock('../../src/services/postgres.service', () => ({
  executePostgresQuery: jest.fn(),
  getExecutionResult: jest.fn(),
  executeMultipleQueries: jest.fn(),
  updateRequestStatus: jest.fn(),
  logExecution: jest.fn()
}));

jest.mock('../../src/services/mongo.service', () => ({
  executeMongoQuery: jest.fn(),
  getExecutionResult: jest.fn(),
  executeMultipleQueries: jest.fn()
}));

jest.mock('../../src/services/postgresScript.service', () => ({
  executePostgresScript: jest.fn(),
  getScriptExecutionResult: jest.fn()
}));

jest.mock('../../src/services/mongoScript.service', () => ({
  executeMongoScript: jest.fn(),
  getScriptExecutionResult: jest.fn()
}));


describe('Execution Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeQuery', () => {
    it('should route PostgreSQL query to postgres service', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'POSTGRES', query_text: 'SELECT * FROM users', script_path: null }]
      });
      postgresExecutionService.executePostgresQuery.mockResolvedValue({
        success: true,
        rows: [{ id: 1 }]
      });

      const result = await executionService.executeQuery(1);

      expect(query).toHaveBeenCalledWith(expect.any(String), [1]);
      expect(postgresExecutionService.executePostgresQuery).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it('should route MongoDB query to mongo service', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'MONGO', query_text: 'db.users.find({})', script_path: null }]
      });
      mongoExecutionService.executeMongoQuery.mockResolvedValue({
        success: true,
        rows: [{ _id: '123' }]
      });

      const result = await executionService.executeQuery(2);

      expect(mongoExecutionService.executeMongoQuery).toHaveBeenCalledWith(2);
      expect(result.success).toBe(true);
    });

    it('should route PostgreSQL script to postgres script service', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'POSTGRES', query_text: null, script_path: 'console.log("test")' }]
      });
      postgresScriptService.executePostgresScript.mockResolvedValue({
        success: true,
        output: 'test'
      });

      const result = await executionService.executeQuery(3);

      expect(postgresScriptService.executePostgresScript).toHaveBeenCalledWith(3);
      expect(result.success).toBe(true);
    });

    it('should route MongoDB script to mongo script service', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'MONGO', query_text: null, script_path: 'console.log("test")' }]
      });
      mongoScriptService.executeMongoScript.mockResolvedValue({
        success: true,
        output: 'test'
      });

      const result = await executionService.executeQuery(4);

      expect(mongoScriptService.executeMongoScript).toHaveBeenCalledWith(4);
      expect(result.success).toBe(true);
    });

    it('should throw error for unsupported engine with query', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'MYSQL', query_text: 'SELECT 1', script_path: null }]
      });

      await expect(executionService.executeQuery(5)).rejects.toThrow('QUERY execution not supported for engine: MYSQL');
    });

    it('should throw error for unsupported engine with script', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'MYSQL', query_text: null, script_path: 'console.log("test")' }]
      });

      await expect(executionService.executeQuery(5)).rejects.toThrow('SCRIPT execution not supported for engine: MYSQL');
    });

    it('should throw error when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(executionService.executeQuery(999)).rejects.toThrow('Request 999 not found');
    });

    it('should throw error when neither query nor script provided', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'POSTGRES', query_text: null, script_path: null }]
      });

      await expect(executionService.executeQuery(6)).rejects.toThrow('neither query text nor script path');
    });
  });

  describe('executePostgresQuery', () => {
    it('should delegate to postgres service', async () => {
      postgresExecutionService.executePostgresQuery.mockResolvedValue({
        success: true,
        requestId: 1
      });

      const result = await executionService.executePostgresQuery(1);

      expect(postgresExecutionService.executePostgresQuery).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });
  });

  describe('executeMongoQuery', () => {
    it('should delegate to mongo service', async () => {
      mongoExecutionService.executeMongoQuery.mockResolvedValue({
        success: true,
        requestId: 1
      });

      const result = await executionService.executeMongoQuery(1);

      expect(mongoExecutionService.executeMongoQuery).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });
  });

  describe('executePostgresScript', () => {
    it('should delegate to postgres script service', async () => {
      postgresScriptService.executePostgresScript.mockResolvedValue({
        success: true,
        requestId: 1
      });

      const result = await executionService.executePostgresScript(1);

      expect(postgresScriptService.executePostgresScript).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });
  });

  describe('executeMongoScript', () => {
    it('should delegate to mongo script service', async () => {
      mongoScriptService.executeMongoScript.mockResolvedValue({
        success: true,
        requestId: 1
      });

      const result = await executionService.executeMongoScript(1);

      expect(mongoScriptService.executeMongoScript).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });
  });

  describe('getExecutionResult', () => {
    it('should get result for PostgreSQL query', async () => {
      query.mockResolvedValue({
        rows: [{ script_path: null, engine: 'POSTGRES' }]
      });
      postgresExecutionService.getExecutionResult.mockResolvedValue({
        status: 'success',
        output: 'Query result'
      });

      const result = await executionService.getExecutionResult(1);

      expect(postgresExecutionService.getExecutionResult).toHaveBeenCalledWith(1);
      expect(result.status).toBe('success');
    });

    it('should get result for PostgreSQL script', async () => {
      query.mockResolvedValue({
        rows: [{ script_path: 'console.log("test")', engine: 'POSTGRES' }]
      });
      postgresScriptService.getScriptExecutionResult.mockResolvedValue({
        status: 'success',
        output: 'Script result'
      });

      const result = await executionService.getExecutionResult(2);

      expect(postgresScriptService.getScriptExecutionResult).toHaveBeenCalledWith(2);
      expect(result.status).toBe('success');
    });

    it('should get result for MongoDB script', async () => {
      query.mockResolvedValue({
        rows: [{ script_path: 'console.log("test")', engine: 'MONGO' }]
      });
      mongoScriptService.getScriptExecutionResult.mockResolvedValue({
        status: 'success',
        output: 'Mongo script result'
      });

      const result = await executionService.getExecutionResult(3);

      expect(mongoScriptService.getScriptExecutionResult).toHaveBeenCalledWith(3);
      expect(result.status).toBe('success');
    });

    it('should handle errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(executionService.getExecutionResult(1)).rejects.toThrow('Database error');
    });
  });

  describe('executeMultipleQueries', () => {
    it('should execute multiple queries and return results', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ engine: 'POSTGRES', query_text: 'SELECT 1', script_path: null }] })
        .mockResolvedValueOnce({ rows: [{ engine: 'POSTGRES', query_text: 'SELECT 2', script_path: null }] });
      
      postgresExecutionService.executePostgresQuery
        .mockResolvedValueOnce({ success: true, requestId: 1 })
        .mockResolvedValueOnce({ success: true, requestId: 2 });

      const results = await executionService.executeMultipleQueries([1, 2]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle errors in batch execution', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ engine: 'POSTGRES', query_text: 'SELECT 1', script_path: null }] })
        .mockRejectedValueOnce(new Error('Database error'));
      
      postgresExecutionService.executePostgresQuery.mockResolvedValue({ success: true });

      const results = await executionService.executeMultipleQueries([1, 2]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Database error');
    });
  });

  describe('executePostgresBatch', () => {
    it('should delegate to postgres service', async () => {
      postgresExecutionService.executeMultipleQueries.mockResolvedValue([
        { success: true, requestId: 1 },
        { success: true, requestId: 2 }
      ]);

      const results = await executionService.executePostgresBatch([1, 2]);

      expect(postgresExecutionService.executeMultipleQueries).toHaveBeenCalledWith([1, 2]);
      expect(results).toHaveLength(2);
    });
  });

  describe('executeMongoBatch', () => {
    it('should delegate to mongo service', async () => {
      mongoExecutionService.executeMultipleQueries.mockResolvedValue([
        { success: true, requestId: 1 },
        { success: true, requestId: 2 }
      ]);

      const results = await executionService.executeMongoBatch([1, 2]);

      expect(mongoExecutionService.executeMultipleQueries).toHaveBeenCalledWith([1, 2]);
      expect(results).toHaveLength(2);
    });
  });



  describe('updateRequestStatus', () => {
    it('should update request status in database', async () => {
      query.mockResolvedValue({ rows: [] });

      await executionService.updateRequestStatus(1, 'EXECUTING');

      expect(query).toHaveBeenCalledWith(
        'UPDATE query_requests SET status = $1 WHERE id = $2',
        ['EXECUTING', 1]
      );
    });

    it('should throw error on database failure', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(executionService.updateRequestStatus(1, 'EXECUTING')).rejects.toThrow('Database error');
    });
  });

  describe('logExecution', () => {
    it('should log execution result to database', async () => {
      query.mockResolvedValue({ rows: [{ id: 1 }] });

      await executionService.logExecution(1, { success: true, executionTime: 100 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_logs'),
        expect.arrayContaining([1, true])
      );
    });

    it('should handle logging errors gracefully', async () => {
      query.mockRejectedValue(new Error('Log error'));

      // Should not throw, just log error
      await executionService.logExecution(1, { success: true });
    });
  });

  describe('getExecutionResult - additional cases', () => {
    it('should get result for MongoDB query', async () => {
      query.mockResolvedValue({
        rows: [{ script_path: null, engine: 'MONGO' }]
      });
      mongoExecutionService.getExecutionResult.mockResolvedValue({
        status: 'success',
        output: 'Mongo query result'
      });

      const result = await executionService.getExecutionResult(1);

      expect(mongoExecutionService.getExecutionResult).toHaveBeenCalledWith(1);
      expect(result.status).toBe('success');
    });

    it('should throw error for unsupported engine result fetch', async () => {
      query.mockResolvedValue({
        rows: [{ script_path: null, engine: 'MYSQL' }]
      });

      await expect(executionService.getExecutionResult(1)).rejects.toThrow('Result fetch not supported for QUERY on engine MYSQL');
    });

    it('should throw error when request not found for result fetch', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(executionService.getExecutionResult(999)).rejects.toThrow('Request 999 not found');
    });
  });

  describe('formatOutput', () => {
    it('should return null for failed execution', () => {
      const result = executionService.formatOutput({ success: false });
      expect(result).toBeNull();
    });

    it('should return message for empty rows', () => {
      const result = executionService.formatOutput({ success: true, rows: [] });
      expect(result).toBe('Query executed successfully. No rows returned.');
    });

    it('should return message when rows is undefined', () => {
      const result = executionService.formatOutput({ success: true });
      expect(result).toBe('Query executed successfully. No rows returned.');
    });

    it('should format small result sets', () => {
      const result = executionService.formatOutput({
        success: true,
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2
      });
      expect(result).toContain('Query executed successfully. 2 rows returned.');
      expect(result).toContain('"id": 1');
    });

    it('should truncate large result sets over 100 rows', () => {
      const rows = Array.from({ length: 150 }, (_, i) => ({ id: i + 1 }));
      const result = executionService.formatOutput({
        success: true,
        rows,
        rowCount: 150
      });
      expect(result).toContain('150 rows returned. (First 100 rows shown)');
      expect(result).toContain('... and 50 more rows');
    });
  });
});
