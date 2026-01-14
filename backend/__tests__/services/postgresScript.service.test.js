const postgresScriptService = require('../../src/services/postgresScript.service');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db');

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock worker_threads
jest.mock('worker_threads', () => {
  const EventEmitter = require('events');
  
  class MockWorker extends EventEmitter {
    constructor(file, options) {
      super();
      this.workerData = options?.workerData;
      
      // Simulate async worker behavior
      setTimeout(() => {
        this.emit('message', {
          success: true,
          output: 'Test output',
          metadata: { database: 'test_db' },
          queries: []
        });
      }, 10);
    }
    
    terminate() {
      return Promise.resolve();
    }
  }
  
  return {
    Worker: MockWorker,
    isMainThread: true,
    parentPort: null,
    workerData: null
  };
});

describe('PostgreSQL Script Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateScriptContent', () => {
    it('should pass validation for valid script with console.log', () => {
      const script = `
        const result = await query('SELECT * FROM users');
        console.log(result.rows);
      `;
      
      expect(() => postgresScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should throw error for empty script', () => {
      expect(() => postgresScriptService.validateScriptContent('')).toThrow('Script content is empty');
      expect(() => postgresScriptService.validateScriptContent('   ')).toThrow('Script content is empty');
    });

    it('should throw error for script without console.log', () => {
      const script = `const result = await query('SELECT * FROM users');`;
      
      expect(() => postgresScriptService.validateScriptContent(script)).toThrow('console.log()');
    });

    it('should allow DROP TABLE operations', () => {
      const script = `
        await query('DROP TABLE temp_table');
        console.log('Table dropped');
      `;
      
      expect(() => postgresScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should allow DELETE operations', () => {
      const script = `
        await query('DELETE FROM users WHERE id = 1');
        console.log('Deleted');
      `;
      
      expect(() => postgresScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should allow ALTER operations', () => {
      const script = `
        await query('ALTER TABLE users ADD COLUMN age INT');
        console.log('Altered');
      `;
      
      expect(() => postgresScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should return true for valid script', () => {
      const script = `console.log('test');`;
      const result = postgresScriptService.validateScriptContent(script);
      expect(result).toBe(true);
    });
  });

  describe('executePostgresScript', () => {
    it('should return error when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await postgresScriptService.executePostgresScript(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error when request is not approved', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'PENDING',
          engine: 'POSTGRES',
          script_path: 'console.log("test")'
        }]
      });

      const result = await postgresScriptService.executePostgresScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not approved');
    });

    it('should return error for non-PostgreSQL engine', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'MONGO',
          script_path: 'console.log("test")'
        }]
      });

      const result = await postgresScriptService.executePostgresScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported database engine');
    });

    it('should return error when no script content', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'POSTGRES',
          script_path: null
        }]
      });

      const result = await postgresScriptService.executePostgresScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No script content');
    });

    it('should return error for invalid script content', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'POSTGRES',
          script_path: 'const x = 1;', // No console.log
          instance_name: 'test',
          database_name: 'test_db',
          db_instance_id: 1
        }]
      });

      const result = await postgresScriptService.executePostgresScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('console.log()');
    });

    it('should execute script successfully', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'POSTGRES',
            script_path: 'console.log("test");',
            instance_name: 'test-postgres',
            database_name: 'test_db',
            db_instance_id: 1,
            host: 'localhost',
            port: 5432
          }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Instance query
        .mockResolvedValue({ rows: [{ id: 1 }] }); // Status updates

      const result = await postgresScriptService.executePostgresScript(1);

      expect(result.success).toBe(true);
      expect(result.status).toBe('EXECUTED');
    }, 15000);
  });

  describe('getScriptExecutionResult', () => {
    it('should return pending status when no execution log exists', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await postgresScriptService.getScriptExecutionResult(1);

      expect(result.status).toBe('pending');
      expect(result.message).toBe('Script not yet executed');
    });

    it('should return success result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: true,
          output: '{"console_output": "test output"}',
          error: null,
          execution_time_ms: 150,
          executed_at: '2026-01-10T00:00:00Z',
          script_path: 'console.log("test")',
          status: 'EXECUTED'
        }]
      });

      const result = await postgresScriptService.getScriptExecutionResult(1);

      expect(result.status).toBe('success');
      expect(result.output).toContain('test output');
      expect(result.executionTime).toBe(150);
    });

    it('should return failure result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: false,
          output: null,
          error: 'Script error',
          execution_time_ms: 50,
          executed_at: '2026-01-10T00:00:00Z',
          script_path: 'console.log("test")',
          status: 'FAILED'
        }]
      });

      const result = await postgresScriptService.getScriptExecutionResult(1);

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Script error');
    });

    it('should throw error on database failure', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(postgresScriptService.getScriptExecutionResult(1)).rejects.toThrow('Database error');
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status successfully', async () => {
      query.mockResolvedValue({ rows: [] });

      await postgresScriptService.updateRequestStatus(1, 'EXECUTING');

      expect(query).toHaveBeenCalledWith(
        'UPDATE query_requests SET status = $1 WHERE id = $2',
        ['EXECUTING', 1]
      );
    });

    it('should throw error on failure', async () => {
      query.mockRejectedValue(new Error('Update failed'));

      await expect(postgresScriptService.updateRequestStatus(1, 'EXECUTING')).rejects.toThrow('Update failed');
    });
  });

  describe('logExecution', () => {
    it('should log execution result', async () => {
      query.mockResolvedValue({ rows: [{ id: 1 }] });

      await postgresScriptService.logExecution(1, {
        success: true,
        output: 'test output',
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
      await expect(postgresScriptService.logExecution(1, { success: true })).resolves.not.toThrow();
    });
  });

  describe('formatScriptOutput', () => {
    it('should return null for failed execution', () => {
      const result = postgresScriptService.formatScriptOutput({ success: false });
      expect(result).toBeNull();
    });

    it('should return formatted JSON for successful execution', () => {
      const executionResult = {
        success: true,
        output: 'test output',
        metadata: { database: 'test_db' },
        queries: [{ query_number: 1, sql: 'SELECT 1' }]
      };

      const result = postgresScriptService.formatScriptOutput(executionResult);
      const parsed = JSON.parse(result);

      expect(parsed.console_output).toBe('test output');
      expect(parsed.metadata.database).toBe('test_db');
      expect(parsed.queries).toHaveLength(1);
    });

    it('should handle missing fields', () => {
      const executionResult = {
        success: true
      };

      const result = postgresScriptService.formatScriptOutput(executionResult);
      const parsed = JSON.parse(result);

      expect(parsed.console_output).toBeNull();
      expect(parsed.metadata).toBeNull();
      expect(parsed.queries).toEqual([]);
    });
  });

  describe('executeScript', () => {
    it('should handle instance query error', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await postgresScriptService.executeScript(999, 'test_db', 'console.log("test");');

      expect(result.success).toBe(false);
    });

    it('should handle instance query throwing error', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));

      const result = await postgresScriptService.executeScript(1, 'test_db', 'console.log("test");');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should handle worker error event', async () => {
      // Mock worker_threads to simulate worker error
      jest.doMock('worker_threads', () => {
        const EventEmitter = require('events');
        
        class MockWorkerWithError extends EventEmitter {
          constructor(file, options) {
            super();
            this.workerData = options?.workerData;
            
            // Simulate worker error
            setTimeout(() => {
              this.emit('error', new Error('Worker thread crashed'));
            }, 10);
          }
          
          terminate() {
            return Promise.resolve();
          }
        }
        
        return {
          Worker: MockWorkerWithError,
          isMainThread: true,
          parentPort: null,
          workerData: null
        };
      });

      // Re-require to get new mock
      jest.resetModules();
      
      // Re-mock the db query for the new module instance
      const mockQuery = jest.fn();
      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));
      
      const postgresScriptServiceNew = require('../../src/services/postgresScript.service');

      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test'
        }]
      });

      const result = await postgresScriptServiceNew.executeScript(1, 'test_db', 'console.log("test");');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker error');
    }, 15000);

    it('should handle worker exit with non-zero code', async () => {
      // Mock worker_threads to simulate worker exit with error code
      jest.doMock('worker_threads', () => {
        const EventEmitter = require('events');
        
        class MockWorkerWithExit extends EventEmitter {
          constructor(file, options) {
            super();
            this.workerData = options?.workerData;
            
            // Simulate worker exit with error code
            setTimeout(() => {
              this.emit('exit', 1); // Non-zero exit code
            }, 10);
          }
          
          terminate() {
            return Promise.resolve();
          }
        }
        
        return {
          Worker: MockWorkerWithExit,
          isMainThread: true,
          parentPort: null,
          workerData: null
        };
      });

      // Re-require to get new mock
      jest.resetModules();
      
      // Re-mock the db query for the new module instance
      const mockQuery = jest.fn();
      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));
      
      const postgresScriptServiceNew = require('../../src/services/postgresScript.service');

      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test'
        }]
      });

      const result = await postgresScriptServiceNew.executeScript(1, 'test_db', 'console.log("test");');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker stopped with exit code 1');
    }, 15000);


  });
});
