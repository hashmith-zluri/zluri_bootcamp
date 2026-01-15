const mongoExecutionService = require('../../src/services/mongo.service');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db');
jest.mock('../../src/config/mongoDb', () => ({
  executeMongoQuery: jest.fn(),
  validateMongoQuery: jest.fn()
}));

const { executeMongoQuery: mockExecuteMongoQuery, validateMongoQuery: mockValidateMongoQuery } = require('../../src/config/mongoDb');

describe('MongoDB Execution Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeMongoQuery', () => {
    it('should return error when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await mongoExecutionService.executeMongoQuery(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error when request is not approved', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'PENDING',
          engine: 'MONGO',
          query_text: 'db.users.find({})'
        }]
      });

      const result = await mongoExecutionService.executeMongoQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not approved');
    });

    it('should return error for non-MongoDB engine', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'POSTGRES',
          query_text: 'db.users.find({})'
        }]
      });

      const result = await mongoExecutionService.executeMongoQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected MongoDB');
    });

    it('should return error when no query text', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'MONGO',
          query_text: null
        }]
      });

      const result = await mongoExecutionService.executeMongoQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No query text');
    });

    it('should execute query and return success result', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'MONGO',
            query_text: 'db.users.find({})',
            instance_name: 'local-mongo',
            database_name: 'test_db',
            db_instance_id: 2
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] }); // For status updates

      mockValidateMongoQuery.mockReturnValue(true);
      mockExecuteMongoQuery.mockResolvedValue({
        success: true,
        rows: [{ _id: '123', name: 'Test' }],
        rowCount: 1,
        executionTime: 50,
        operation: 'find',
        collection: 'users'
      });

      const result = await mongoExecutionService.executeMongoQuery(1);

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it('should handle validation errors', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'MONGO',
            query_text: 'db.123invalid.find({})',
            instance_name: 'local-mongo',
            database_name: 'test_db',
            db_instance_id: 2
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      mockValidateMongoQuery.mockImplementation(() => {
        throw new Error('Invalid collection name');
      });

      const result = await mongoExecutionService.executeMongoQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid collection name');
    });

    it('should handle execution failure', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'MONGO',
            query_text: 'db.users.find({})',
            instance_name: 'local-mongo',
            database_name: 'test_db',
            db_instance_id: 2
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      mockValidateMongoQuery.mockReturnValue(true);
      mockExecuteMongoQuery.mockResolvedValue({
        success: false,
        error: 'Connection failed',
        executionTime: 10
      });

      const result = await mongoExecutionService.executeMongoQuery(1);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('getExecutionResult', () => {
    it('should return pending status when no execution log exists', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await mongoExecutionService.getExecutionResult(1);

      expect(result.status).toBe('pending');
      expect(result.message).toBe('Request not yet executed');
    });

    it('should return success result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: true,
          output: 'MongoDB find executed successfully. 5 documents returned.',
          error: null,
          execution_time_ms: 75,
          executed_at: '2026-01-10T00:00:00Z',
          status: 'EXECUTED'
        }]
      });

      const result = await mongoExecutionService.getExecutionResult(1);

      expect(result.status).toBe('success');
      expect(result.output).toContain('5 documents');
      expect(result.executionTime).toBe(75);
    });

    it('should return failure result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: false,
          output: null,
          error: 'MongoServerError: ns not found',
          execution_time_ms: 20,
          executed_at: '2026-01-10T00:00:00Z',
          status: 'FAILED'
        }]
      });

      const result = await mongoExecutionService.getExecutionResult(1);

      expect(result.status).toBe('failure');
      expect(result.error).toContain('ns not found');
    });

    it('should throw error on database failure', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(mongoExecutionService.getExecutionResult(1)).rejects.toThrow('Database error');
    });
  });

  describe('formatMongoOutput', () => {
    it('should return null for failed execution', () => {
      const result = mongoExecutionService.formatMongoOutput({ success: false });
      expect(result).toBeNull();
    });

    it('should format output for empty result', () => {
      const result = mongoExecutionService.formatMongoOutput({
        success: true,
        rows: [],
        operation: 'find',
        collection: 'users'
      });

      expect(result).toContain('No documents returned');
    });

    it('should format output with documents', () => {
      const result = mongoExecutionService.formatMongoOutput({
        success: true,
        rows: [{ _id: '1', name: 'Test' }],
        rowCount: 1,
        operation: 'find',
        collection: 'users'
      });

      const parsed = JSON.parse(result);
      expect(parsed.console_output).toContain('1 documents returned');
      expect(parsed.result_data).toHaveLength(1);
      expect(parsed.result_data[0].name).toBe('Test');
    });

    it('should not truncate result sets anymore', () => {
      const largeResult = Array(150).fill({ _id: 'test' });
      const result = mongoExecutionService.formatMongoOutput({
        success: true,
        rows: largeResult,
        rowCount: 150,
        operation: 'find',
        collection: 'users'
      });

      const parsed = JSON.parse(result);
      expect(parsed.console_output).toContain('150 documents returned');
      expect(parsed.result_data).toHaveLength(150);
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status', async () => {
      query.mockResolvedValue({ rows: [] });

      await mongoExecutionService.updateRequestStatus(1, 'EXECUTING');

      expect(query).toHaveBeenCalledWith(
        'UPDATE query_requests SET status = $1 WHERE id = $2',
        ['EXECUTING', 1]
      );
    });

    it('should throw error on failure', async () => {
      query.mockRejectedValue(new Error('Update failed'));

      await expect(mongoExecutionService.updateRequestStatus(1, 'EXECUTING')).rejects.toThrow('Update failed');
    });
  });

  describe('logExecution', () => {
    it('should log execution result', async () => {
      query.mockResolvedValue({ rows: [{ id: 1 }] });

      await mongoExecutionService.logExecution(1, {
        success: true,
        rows: [{ _id: '1' }],
        rowCount: 1,
        executionTime: 100,
        operation: 'find',
        collection: 'users'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_logs'),
        expect.arrayContaining([1, true])
      );
    });

    it('should handle logging errors gracefully', async () => {
      query.mockRejectedValue(new Error('Log failed'));

      // Should not throw
      await expect(mongoExecutionService.logExecution(1, { success: true })).resolves.not.toThrow();
    });
  });

  describe('executeMultipleQueries', () => {
    it('should execute multiple queries', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'MONGO',
            query_text: 'db.users.find({})',
            db_instance_id: 1,
            database_name: 'test'
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      mockValidateMongoQuery.mockReturnValue(true);
      mockExecuteMongoQuery.mockResolvedValue({
        success: true,
        rows: [{ _id: '1' }],
        rowCount: 1,
        executionTime: 10,
        operation: 'find',
        collection: 'users'
      });

      const results = await mongoExecutionService.executeMultipleQueries([1]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should handle errors in batch', async () => {
      query.mockRejectedValue(new Error('Query failed'));

      const results = await mongoExecutionService.executeMultipleQueries([1]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Query failed');
    });
  });
});
