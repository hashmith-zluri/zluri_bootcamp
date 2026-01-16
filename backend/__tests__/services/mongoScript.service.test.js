const mongoScriptService = require('../../src/services/mongoScript.service');
const { query } = require('../../src/config/db');
const slackService = require('../../src/services/slack.service');

jest.mock('../../src/config/db');
jest.mock('../../src/services/slack.service');

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
          output: 'Mongo test output',
          metadata: { database: 'test_mongo', host: 'localhost', port: 27017 }
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

describe('MongoDB Script Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateScriptContent', () => {
    it('should pass validation for valid script with console.log', () => {
      const script = `
        const users = await db.collection('users').find({}).toArray();
        console.log(users);
      `;
      
      expect(() => mongoScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should throw error for empty script', () => {
      expect(() => mongoScriptService.validateScriptContent('')).toThrow('Script content is empty');
      expect(() => mongoScriptService.validateScriptContent('   ')).toThrow('Script content is empty');
    });

    it('should throw error for script without console.log', () => {
      const script = `const users = await db.collection('users').find({}).toArray();`;
      
      expect(() => mongoScriptService.validateScriptContent(script)).toThrow('console.log()');
    });

    it('should allow drop operations', () => {
      const script = `
        await db.collection('temp').drop();
        console.log('Collection dropped');
      `;
      
      expect(() => mongoScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should allow deleteMany operations', () => {
      const script = `
        await db.collection('users').deleteMany({});
        console.log('Deleted all');
      `;
      
      expect(() => mongoScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should allow insertMany operations', () => {
      const script = `
        await db.collection('users').insertMany([{name: 'test'}]);
        console.log('Inserted');
      `;
      
      expect(() => mongoScriptService.validateScriptContent(script)).not.toThrow();
    });

    it('should return true for valid script', () => {
      const script = `console.log('test');`;
      const result = mongoScriptService.validateScriptContent(script);
      expect(result).toBe(true);
    });
  });

  describe('executeMongoScript', () => {
    it('should return error when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await mongoScriptService.executeMongoScript(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error when request is not approved', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'PENDING',
          engine: 'MONGO',
          script_path: 'console.log("test")'
        }]
      });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not approved');
    });

    it('should return error for non-MongoDB engine', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'POSTGRES',
          script_path: 'console.log("test")'
        }]
      });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected MongoDB');
    });

    it('should return error when no script content', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'MONGO',
          script_path: null
        }]
      });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No script content');
    });

    it('should return error for invalid script content', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          status: 'APPROVED',
          engine: 'MONGO',
          script_path: 'const x = 1;', // No console.log
          instance_name: 'test',
          database_name: 'test_db',
          host: 'localhost',
          port: 27017
        }]
      });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('console.log()');
    });

    it('should execute script successfully', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'APPROVED',
            engine: 'MONGO',
            script_path: 'console.log("test");',
            instance_name: 'test-mongo',
            database_name: 'test_db',
            host: 'localhost',
            port: 27017
          }]
        })
        .mockResolvedValue({ rows: [{ id: 1 }] }); // Status updates

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(true);
      expect(result.status).toBe('EXECUTED');
    }, 15000);
  });

  describe('getScriptExecutionResult', () => {
    it('should return pending status when no execution log exists', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await mongoScriptService.getScriptExecutionResult(1);

      expect(result.status).toBe('pending');
      expect(result.message).toBe('Script not yet executed');
    });

    it('should return success result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: true,
          output: '{"console_output": "mongo output"}',
          error: null,
          execution_time_ms: 200,
          executed_at: '2026-01-10T00:00:00Z',
          script_path: 'console.log("test")',
          status: 'EXECUTED'
        }]
      });

      const result = await mongoScriptService.getScriptExecutionResult(1);

      expect(result.status).toBe('success');
      expect(result.output).toContain('mongo output');
      expect(result.executionTime).toBe(200);
    });

    it('should return failure result from execution log', async () => {
      query.mockResolvedValue({
        rows: [{
          success: false,
          output: null,
          error: 'MongoDB connection failed',
          execution_time_ms: 100,
          executed_at: '2026-01-10T00:00:00Z',
          script_path: 'console.log("test")',
          status: 'FAILED'
        }]
      });

      const result = await mongoScriptService.getScriptExecutionResult(1);

      expect(result.status).toBe('failure');
      expect(result.error).toBe('MongoDB connection failed');
    });

    it('should throw error on database failure', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(mongoScriptService.getScriptExecutionResult(1)).rejects.toThrow('Database error');
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status successfully', async () => {
      query.mockResolvedValue({ rows: [] });

      await mongoScriptService.updateRequestStatus(1, 'EXECUTING');

      expect(query).toHaveBeenCalledWith(
        'UPDATE query_requests SET status = $1 WHERE id = $2',
        ['EXECUTING', 1]
      );
    });

    it('should throw error on failure', async () => {
      query.mockRejectedValue(new Error('Update failed'));

      await expect(mongoScriptService.updateRequestStatus(1, 'EXECUTING')).rejects.toThrow('Update failed');
    });
  });

  describe('logExecution', () => {
    it('should log execution result', async () => {
      query.mockResolvedValue({ rows: [{ id: 1 }] });

      await mongoScriptService.logExecution(1, {
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
      await expect(mongoScriptService.logExecution(1, { success: true })).resolves.not.toThrow();
    });
  });

  describe('formatScriptOutput', () => {
    it('should return null for failed execution', () => {
      const result = mongoScriptService.formatScriptOutput({ success: false });
      expect(result).toBeNull();
    });

    it('should return formatted JSON for successful execution', () => {
      const executionResult = {
        success: true,
        output: 'mongo test output'
      };

      const result = mongoScriptService.formatScriptOutput(executionResult);
      const parsed = JSON.parse(result);

      expect(parsed.console_output).toBe('mongo test output');
    });

    it('should handle missing fields', () => {
      const executionResult = {
        success: true
      };

      const result = mongoScriptService.formatScriptOutput(executionResult);
      const parsed = JSON.parse(result);

      expect(parsed.console_output).toBeNull();
    });
  });

  describe('executeScript', () => {
    it('should handle script execution', async () => {
      const instance = {
        host: 'localhost',
        port: 27017
      };

      const result = await mongoScriptService.executeScript(instance, 'test_db', 'console.log("test");');

      expect(result.success).toBe(true);
    }, 15000);

    it('should handle executeJSScript errors', async () => {
      // Mock worker_threads to throw an error
      jest.resetModules();
      
      jest.doMock('worker_threads', () => {
        throw new Error('Worker threads not available');
      });

      const mongoScript = require('../../src/services/mongoScript.service');
      
      const instance = {
        host: 'localhost',
        port: 27017
      };

      const result = await mongoScript.executeScript(instance, 'test_db', 'console.log("test");');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 15000);
  });
});

describe('sendExecutionNotification', () => {
  beforeEach(() => {
    slackService.isEnabled.mockReset();
    slackService.notifyApprovalSuccess.mockReset();
    slackService.notifyApprovalFailure.mockReset();
  });

  it('should not send notification when Slack is disabled', async () => {
    slackService.isEnabled.mockReturnValue(false);
    
    await mongoScriptService.sendExecutionNotification(1, { success: true });
    
    expect(slackService.notifyApprovalSuccess).not.toHaveBeenCalled();
    expect(slackService.notifyApprovalFailure).not.toHaveBeenCalled();
  });

  it('should send success notification when execution succeeds', async () => {
    slackService.isEnabled.mockReturnValue(true);
    slackService.notifyApprovalSuccess.mockResolvedValue();
    
    query.mockResolvedValue({
      rows: [{
        id: 1,
        query_text: null,
        script_path: 'console.log("test")',
        database_name: 'test_db',
        requester_name: 'John Doe',
        requester_email: 'john@test.com',
        instance_name: 'local-mongo',
        database_type: 'MONGO'
      }]
    });

    await mongoScriptService.sendExecutionNotification(1, { success: true, output: 'Success' });

    expect(slackService.notifyApprovalSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        req_id: 1,
        requester_name: 'John Doe',
        database_type: 'MONGO',
        script: 'console.log("test")'
      }),
      expect.objectContaining({ success: true })
    );
  });

  it('should send failure notification when execution fails', async () => {
    slackService.isEnabled.mockReturnValue(true);
    slackService.notifyApprovalFailure.mockResolvedValue();
    
    query.mockResolvedValue({
      rows: [{
        id: 1,
        query_text: null,
        script_path: 'console.log("test")',
        database_name: 'test_db',
        requester_name: 'John Doe',
        requester_email: 'john@test.com',
        instance_name: 'local-mongo',
        database_type: 'MONGO'
      }]
    });

    await mongoScriptService.sendExecutionNotification(1, { success: false, error: 'Script failed' });

    expect(slackService.notifyApprovalFailure).toHaveBeenCalled();
  });

  it('should handle request not found gracefully', async () => {
    slackService.isEnabled.mockReturnValue(true);
    
    query.mockResolvedValue({ rows: [] });

    await mongoScriptService.sendExecutionNotification(999, { success: true });
    
    expect(slackService.notifyApprovalSuccess).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    slackService.isEnabled.mockReturnValue(true);
    
    query.mockRejectedValue(new Error('Database error'));

    // Should not throw
    await expect(mongoScriptService.sendExecutionNotification(1, { success: true }))
      .resolves.not.toThrow();
  });
});
