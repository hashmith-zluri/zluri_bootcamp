const postgresService = require('../src/services/postgres.service');
const { query } = require('../src/config/db');
const { executeTargetQuery, validateQuery } = require('../src/config/postgresDb');

jest.mock('../src/config/db');
jest.mock('../src/config/postgresDb');

describe('PostgreSQL Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executePostgresQuery', () => {
    it('should return error when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await postgresService.executePostgresQuery(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error when request is not approved', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'PENDING',
          engine: 'POSTGRES',
          query_text: 'SELECT * FROM users'
        }]
      });

      const result = await postgresService.executePostgresQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not approved');
    });

    it('should return error for non-PostgreSQL engine', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'MONGO',
          query_text: 'SELECT * FROM users'
        }]
      });

      const result = await postgresService.executePostgresQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported database engine');
    });

    it('should return error when no query text', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'POSTGRES',
          query_text: null
        }]
      });

      const result = await postgresService.executePostgresQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No query text');
    });

    it('should execute query successfully', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'POSTGRES',
            query_text: 'SELECT * FROM users;',
            instance_name: 'test-postgres',
            database_name: 'test_db',
            db_instance_id: 1
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] }); // For status updates and logging

      validateQuery.mockReturnValue(true);
      executeTargetQuery.mockResolvedValue({
        success: true,
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        executionTime: 50
      });

      const result = await postgresService.executePostgresQuery(1);

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it('should handle validation errors', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'POSTGRES',
          query_text: 'DROP TABLE users;',
          instance_name: 'test-postgres',
          database_name: 'test_db',
          db_instance_id: 1
        }]
      });

      validateQuery.mockImplementation(() => {
        throw new Error('dangerous operation');
      });

      const result = await postgresService.executePostgresQuery(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('dangerous operation');
    });

    it('should handle execution failure', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'POSTGRES',
            query_text: 'SELECT * FROM nonexistent;',
            instance_name: 'test-postgres',
            database_name: 'test_db',
            db_instance_id: 1
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      validateQuery.mockReturnValue(true);
      executeTargetQuery.mockResolvedValue({
        success: false,
        error: 'relation "nonexistent" does not exist',
        executionTime: 10
      });

      const result = await postgresService.executePostgresQuery(1);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('getExecutionResult', () => {
    it('should return pending status when no execution log exists', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await postgresService.getExecutionResult(1);

      expect(result.status).toBe('pending');
      expect(result.message).toBe('Request not yet executed');
    });

    it('should return success result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: true,
          output: '[{"id": 1, "name": "Test"}]',
          error: null,
          execution_time_ms: 50,
          executed_at: '2026-01-10T00:00:00Z',
          status: 'EXECUTED'
        }]
      });

      const result = await postgresService.getExecutionResult(1);

      expect(result.status).toBe('success');
      expect(result.executionTime).toBe(50);
    });

    it('should return failure result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: false,
          output: null,
          error: 'relation "users" does not exist',
          execution_time_ms: 10,
          executed_at: '2026-01-10T00:00:00Z',
          status: 'FAILED'
        }]
      });

      const result = await postgresService.getExecutionResult(1);

      expect(result.status).toBe('failure');
      expect(result.error).toContain('does not exist');
    });

    it('should throw error on database failure', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(postgresService.getExecutionResult(1)).rejects.toThrow('Database error');
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status', async () => {
      query.mockResolvedValue({ rows: [] });

      await postgresService.updateRequestStatus(1, 'EXECUTING');

      expect(query).toHaveBeenCalledWith(
        'UPDATE query_requests SET status = $1 WHERE id = $2',
        ['EXECUTING', 1]
      );
    });

    it('should throw error on failure', async () => {
      query.mockRejectedValue(new Error('Update failed'));

      await expect(postgresService.updateRequestStatus(1, 'EXECUTING')).rejects.toThrow('Update failed');
    });
  });

  describe('logExecution', () => {
    it('should log execution result', async () => {
      query.mockResolvedValue({ rows: [{ id: 1 }] });

      await postgresService.logExecution(1, {
        success: true,
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 100
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_logs'),
        expect.arrayContaining([1, true])
      );
    });

    it('should handle logging errors gracefully', async () => {
      query.mockRejectedValue(new Error('Log failed'));

      // Should not throw
      await expect(postgresService.logExecution(1, { success: true })).resolves.not.toThrow();
    });
  });

  describe('formatOutput', () => {
    it('should return null for failed execution', () => {
      const result = postgresService.formatOutput({ success: false });
      expect(result).toBeNull();
    });

    it('should format output for empty result', () => {
      const result = postgresService.formatOutput({
        success: true,
        rows: []
      });

      expect(result).toContain('No rows returned');
    });

    it('should format output with rows', () => {
      const result = postgresService.formatOutput({
        success: true,
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1
      });

      expect(result).toContain('1 rows returned');
      expect(result).toContain('Test');
    });

    it('should truncate large result sets', () => {
      const largeResult = Array(150).fill({ id: 1 });
      const result = postgresService.formatOutput({
        success: true,
        rows: largeResult,
        rowCount: 150
      });

      expect(result).toContain('150 rows returned');
      expect(result).toContain('First 100 rows shown');
      expect(result).toContain('50 more rows');
    });
  });

  describe('executeMultipleQueries', () => {
    it('should execute multiple queries', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'POSTGRES',
            query_text: 'SELECT 1;',
            db_instance_id: 1,
            database_name: 'test'
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      validateQuery.mockReturnValue(true);
      executeTargetQuery.mockResolvedValue({
        success: true,
        rows: [{ result: 1 }],
        rowCount: 1,
        executionTime: 10
      });

      const results = await postgresService.executeMultipleQueries([1]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should handle errors in batch', async () => {
      query.mockRejectedValue(new Error('Query failed'));

      const results = await postgresService.executeMultipleQueries([1]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Query failed');
    });
  });
});
