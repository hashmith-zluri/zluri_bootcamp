// Tests for worker thread error handling in mongoScript.service.js
describe('MongoDB Script Service - Worker Thread Scenarios', () => {
  let mongoScriptService;
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock db config
    mockQuery = jest.fn();
    jest.doMock('../src/config/db', () => ({
      query: mockQuery
    }));

    // Mock fs.promises
    jest.doMock('fs', () => ({
      promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined)
      }
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Worker error handling', () => {
    it('should handle worker error event', async () => {
      const EventEmitter = require('events');
      
      class MockWorkerWithError extends EventEmitter {
        constructor() {
          super();
          setTimeout(() => {
            this.emit('error', new Error('Worker crashed'));
          }, 10);
        }
        terminate() { return Promise.resolve(); }
      }

      jest.doMock('worker_threads', () => ({
        Worker: MockWorkerWithError,
        isMainThread: true,
        parentPort: null,
        workerData: null
      }));

      mongoScriptService = require('../src/services/mongoScript.service');
      
      mockQuery
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
        .mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker error');
    }, 15000);

    it('should handle worker exit with non-zero code', async () => {
      const EventEmitter = require('events');
      
      class MockWorkerWithExit extends EventEmitter {
        constructor() {
          super();
          setTimeout(() => {
            this.emit('exit', 1);
          }, 10);
        }
        terminate() { return Promise.resolve(); }
      }

      jest.doMock('worker_threads', () => ({
        Worker: MockWorkerWithExit,
        isMainThread: true,
        parentPort: null,
        workerData: null
      }));

      mongoScriptService = require('../src/services/mongoScript.service');
      
      mockQuery
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
        .mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exit code');
    }, 15000);

    it('should handle worker exit with zero code (success)', async () => {
      const EventEmitter = require('events');
      
      class MockWorkerWithSuccessExit extends EventEmitter {
        constructor() {
          super();
          // First emit message, then exit with 0
          setTimeout(() => {
            this.emit('message', {
              success: true,
              output: 'test output',
              metadata: { database: 'test_db' }
            });
          }, 5);
          setTimeout(() => {
            this.emit('exit', 0);
          }, 10);
        }
        terminate() { return Promise.resolve(); }
      }

      jest.doMock('worker_threads', () => ({
        Worker: MockWorkerWithSuccessExit,
        isMainThread: true,
        parentPort: null,
        workerData: null
      }));

      mongoScriptService = require('../src/services/mongoScript.service');
      
      mockQuery
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
        .mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(true);
    }, 15000);

    it('should handle file creation error', async () => {
      jest.doMock('fs', () => ({
        promises: {
          mkdir: jest.fn().mockRejectedValue(new Error('Permission denied')),
          writeFile: jest.fn(),
          unlink: jest.fn()
        }
      }));

      // Mock worker_threads normally
      const EventEmitter = require('events');
      class MockWorker extends EventEmitter {
        constructor() { super(); }
        terminate() { return Promise.resolve(); }
      }
      jest.doMock('worker_threads', () => ({
        Worker: MockWorker,
        isMainThread: true,
        parentPort: null,
        workerData: null
      }));

      mongoScriptService = require('../src/services/mongoScript.service');
      
      mockQuery
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
        .mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await mongoScriptService.executeMongoScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create worker');
    }, 15000);

    it('should handle worker timeout', async () => {
      jest.useFakeTimers();
      
      const EventEmitter = require('events');
      
      class MockWorkerWithTimeout extends EventEmitter {
        constructor() {
          super();
          // Worker never sends message, simulating timeout
        }
        terminate() { return Promise.resolve(); }
      }

      jest.doMock('worker_threads', () => ({
        Worker: MockWorkerWithTimeout,
        isMainThread: true,
        parentPort: null,
        workerData: null
      }));

      mongoScriptService = require('../src/services/mongoScript.service');
      
      mockQuery
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
        .mockResolvedValue({ rows: [{ id: 1 }] });

      const resultPromise = mongoScriptService.executeMongoScript(1);
      
      // Fast-forward past the 5 minute timeout
      await jest.advanceTimersByTimeAsync(300001);
      
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 15000);
  });
});
