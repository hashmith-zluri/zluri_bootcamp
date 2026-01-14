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

      await expect(executionService.executeQuery(5)).rejects.toThrow('Query execution not supported for engine');
    });

    it('should throw error for unsupported engine with script', async () => {
      query.mockResolvedValue({
        rows: [{ engine: 'MYSQL', query_text: null, script_path: 'console.log("test")' }]
      });

      await expect(executionService.executeQuery(5)).rejects.toThrow('Script execution not supported');
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

  describe('executeScript', () => {
    it('should delegate to postgres script service', async () => {
      postgresScriptService.executePostgresScript.mockResolvedValue({
        success: true,
        requestId: 1
      });

      const result = await executionService.executeScript(1);

      expect(postgresScriptService.executePostgresScript).toHaveBeenCalledWith(1);
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

  describe('executeScriptBatch', () => {
    it('should execute multiple scripts', async () => {
      postgresScriptService.executePostgresScript
        .mockResolvedValueOnce({ success: true, requestId: 1 })
        .mockResolvedValueOnce({ success: true, requestId: 2 });

      const results = await executionService.executeScriptBatch([1, 2]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle errors in script batch', async () => {
      postgresScriptService.executePostgresScript
        .mockResolvedValueOnce({ success: true, requestId: 1 })
        .mockRejectedValueOnce(new Error('Script error'));

      const results = await executionService.executeScriptBatch([1, 2]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Script error');
    });
  });

  describe('updateRequestStatus', () => {
    it('should delegate to postgres service', async () => {
      postgresExecutionService.updateRequestStatus.mockResolvedValue(undefined);

      await executionService.updateRequestStatus(1, 'EXECUTING');

      expect(postgresExecutionService.updateRequestStatus).toHaveBeenCalledWith(1, 'EXECUTING');
    });
  });

  describe('logExecution', () => {
    it('should delegate to postgres service', async () => {
      postgresExecutionService.logExecution.mockResolvedValue(undefined);

      await executionService.logExecution(1, { success: true });

      expect(postgresExecutionService.logExecution).toHaveBeenCalledWith(1, { success: true });
    });
  });
});
