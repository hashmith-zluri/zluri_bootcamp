const request = require('supertest');
const app = require('../../src/app');
const { query } = require('../../src/config/db');
const executionService = require('../../src/services/execution.service');

// Mock dependencies
jest.mock('../../src/config/db');
jest.mock('../../src/services/execution.service');
jest.mock('../../src/config/pods', () => [
  { id: 'pod-1', manager_email: 'manager@example.com', name: 'Pod 1' },
  { id: 'pod-2', manager_email: 'other@example.com', name: 'Pod 2' }
]);

describe('Approval Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/approvals - Access Control', () => {
    it('should return 403 for non-manager users', async () => {
      // Mock auth middleware for non-manager
      jest.resetModules();
      jest.doMock('../../src/middlewares/auth.middleware', () => {
        return (req, res, next) => {
          req.user = { id: 1, email: 'user@example.com', role: 'DEVELOPER' };
          next();
        };
      });

      const appWithUser = require('../../src/app');
      
      const response = await request(appWithUser)
        .get('/api/v1/approvals');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });

    it('should return empty array when manager has no pods', async () => {
      jest.resetModules();
      jest.doMock('../../src/middlewares/auth.middleware', () => {
        return (req, res, next) => {
          req.user = { id: 3, email: 'nopods@example.com', role: 'MANAGER' };
          next();
        };
      });

      const appWithNoPods = require('../../src/app');
      
      const response = await request(appWithNoPods)
        .get('/api/v1/approvals');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, requests: [] });
    });
  });

  describe('POST /api/v1/approvals/:req_id/action - Access Control', () => {
    it('should return 403 for non-manager users', async () => {
      jest.resetModules();
      jest.doMock('../../src/middlewares/auth.middleware', () => {
        return (req, res, next) => {
          req.user = { id: 1, email: 'user@example.com', role: 'DEVELOPER' };
          next();
        };
      });

      const appWithUser = require('../../src/app');
      
      const response = await request(appWithUser)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });

  describe('GET /api/v1/request/:req_id/result - Access Control', () => {
    it('should return 403 when user does not own request and is not manager', async () => {
      jest.resetModules();
      jest.doMock('../../src/middlewares/auth.middleware', () => {
        return (req, res, next) => {
          req.user = { id: 99, email: 'other@example.com', role: 'DEVELOPER' };
          next();
        };
      });
      jest.doMock('../../src/config/db', () => ({
        query: jest.fn().mockResolvedValue({
          rows: [{ requester_id: 1 }] // Different user owns this request
        })
      }));

      const appWithOtherUser = require('../../src/app');
      
      const response = await request(appWithOtherUser)
        .get('/api/v1/request/1/result');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });
});

describe('Approval Controller - Manager Access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset mocks for manager access
    jest.doMock('../../src/middlewares/auth.middleware', () => {
      return (req, res, next) => {
        req.user = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
        next();
      };
    });
  });

  describe('GET /api/v1/approvals', () => {
    it('should return approval requests for manager', async () => {
      jest.doMock('../../src/config/db', () => ({
        query: jest.fn().mockResolvedValue({
          rows: [{
            reqid: 1,
            query_text: 'SELECT * FROM users',
            script_path: null,
            status: 'PENDING',
            database_name: 'test_db',
            comments: 'Test query',
            pod_id: 'pod-1',
            created_at: '2024-01-01T00:00:00Z',
            approved_at: null,
            requester_email: 'user@example.com',
            requester_name: 'Test User',
            instance_name: 'postgres-prod',
            database_type: 'POSTGRES',
            output: null,
            error: null,
            execution_time_ms: null,
            executed_at: null,
            success: null
          }]
        })
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .get('/api/v1/approvals');

      expect(response.status).toBe(200);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0]).toMatchObject({
        req_id: 1,
        query: 'SELECT * FROM users',
        status: 'PENDING'
      });
    });

    it('should include execution results when available', async () => {
      jest.doMock('../../src/config/db', () => ({
        query: jest.fn().mockResolvedValue({
          rows: [{
            reqid: 1,
            query_text: 'SELECT * FROM users',
            script_path: null,
            status: 'EXECUTED',
            database_name: 'test_db',
            comments: 'Test query',
            pod_id: 'pod-1',
            created_at: '2024-01-01T00:00:00Z',
            approved_at: '2024-01-01T01:00:00Z',
            requester_email: 'user@example.com',
            requester_name: 'Test User',
            instance_name: 'postgres-prod',
            database_type: 'POSTGRES',
            output: '{"rows": []}',
            error: null,
            execution_time_ms: 100,
            executed_at: '2024-01-01T01:05:00Z',
            success: true
          }]
        })
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .get('/api/v1/approvals');

      expect(response.status).toBe(200);
      expect(response.body.requests[0].result).toMatchObject({
        output: '{"rows": []}',
        response_time: 100,
        status: 'success'
      });
    });
  });
});


describe('Approval Controller - Execution Triggering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset mocks for manager access
    jest.doMock('../../src/middlewares/auth.middleware', () => {
      return (req, res, next) => {
        req.user = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
        next();
      };
    });
  });

  describe('POST /api/v1/approvals/:req_id/action - Approval without execution', () => {
    it('should not trigger execution for request without query or script', async () => {
      jest.doMock('../../src/config/db', () => ({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // Check request exists
          .mockResolvedValueOnce({ 
            rows: [{ 
              id: 1, 
              query_text: null,
              script_path: null,
              status: 'APPROVED'
            }] 
          }) // Update and return
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');
    }, 10000);

    it('should reject request successfully', async () => {
      jest.doMock('../../src/config/db', () => ({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // Check request exists
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert execution log
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: 'Security concerns'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: 'rejected',
        reason: 'Security concerns'
      });
    }, 10000);

    it('should handle invalid action', async () => {
      jest.doMock('../../src/config/db', () => ({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // Check request exists
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Invalid action'
      });
    }, 10000);
  });
});

describe('Approval Controller - Rejection Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset mocks for manager access
    jest.doMock('../../src/middlewares/auth.middleware', () => {
      return (req, res, next) => {
        req.user = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
        next();
      };
    });
  });

  describe('POST /api/v1/approvals/:req_id/action - Rejection Tests', () => {
    it('should reject request with reason and store in comments', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update request status
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert audit log

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: 'Query needs modification before approval'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: 'rejected',
        reason: 'Query needs modification before approval'
      });
    });

    it('should reject request without reason and use default message', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update request status
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert audit log

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'reject' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: 'rejected',
        reason: null
      });
    });

    it('should reject request with empty reason and use default message', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update request status
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert audit log

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: ''
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: 'rejected',
        reason: null // Empty string becomes null due to reason || null logic
      });
    });

    it('should return 404 when rejecting non-existent request', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }); // POD check - no rows (request not found)

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/999/action')
        .send({ 
          action: 'reject',
          reason: 'Test reason'
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Request not found or already processed'
      });

      // Verify only POD check was called since request wasn't found
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return 404 when rejecting already processed request', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }); // POD check - no rows (already processed)

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: 'Already processed'
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Request not found or already processed'
      });
    });

    it('should handle database error during rejection update', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValueOnce(new Error('Database connection failed'));

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: 'Test reason'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Approval action failed'
      });
    });

    it('should handle database error during audit log creation', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update succeeds
        .mockRejectedValueOnce(new Error('Audit log insertion failed')); // Audit log fails

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: 'Test reason'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Approval action failed'
      });
    });

    it('should reject request with long reason text', async () => {
      const longReason = 'This is a very long rejection reason that explains in detail why the request cannot be approved. '.repeat(5);
      
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update request status
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert audit log

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: longReason
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: 'rejected',
        reason: longReason
      });
    });

    it('should reject request with special characters in reason', async () => {
      const specialReason = "Query contains SQL injection: '; DROP TABLE users; --";
      
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update request status
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert audit log

      jest.doMock('../../src/config/db', () => ({
        query: mockQuery
      }));

      const appWithManager = require('../../src/app');
      
      const response = await request(appWithManager)
        .post('/api/v1/approvals/1/action')
        .send({ 
          action: 'reject',
          reason: specialReason
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: 'rejected',
        reason: specialReason
      });
    });
  });
});
