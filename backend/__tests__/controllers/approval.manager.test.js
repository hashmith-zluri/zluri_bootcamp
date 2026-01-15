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

// Mock auth middleware for manager
jest.mock('../../src/middlewares/auth.middleware', () => {
  return (req, res, next) => {
    req.user = global.mockManager;
    next();
  };
});

describe('Approval Controller - Manager Access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/approvals', () => {
    it('should return approval requests for manager', async () => {
      const mockRequests = [
        {
          reqid: 1,
          query_text: 'SELECT * FROM users',
          script_path: null,
          status: 'PENDING',
          database_name: 'test_db',
          comments: 'Test query',
          pod_id: 1,
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
        }
      ];
      query.mockResolvedValue({ rows: mockRequests });

      const response = await request(app)
        .get('/api/v1/approvals');

      expect(response.status).toBe(200);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0]).toMatchObject({
        req_id: 1,
        query: 'SELECT * FROM users',
        status: 'PENDING',
        requester_email: 'user@example.com'
      });
    });

    it('should return requests with successful execution results', async () => {
      const mockRequests = [
        {
          reqid: 1,
          query_text: 'SELECT * FROM users',
          script_path: null,
          status: 'EXECUTED',
          database_name: 'test_db',
          comments: 'Test query',
          pod_id: 1,
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
        }
      ];
      query.mockResolvedValue({ rows: mockRequests });

      const response = await request(app)
        .get('/api/v1/approvals');

      expect(response.status).toBe(200);
      expect(response.body.requests[0].result.status).toBe('success');
    });

    it('should return requests with failed execution results', async () => {
      const mockRequests = [
        {
          reqid: 1,
          query_text: 'SELECT * FROM users',
          script_path: null,
          status: 'FAILED',
          database_name: 'test_db',
          comments: 'Test query',
          pod_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          approved_at: '2024-01-01T01:00:00Z',
          requester_email: 'user@example.com',
          requester_name: 'Test User',
          instance_name: 'postgres-prod',
          database_type: 'POSTGRES',
          output: null,
          error: 'Query failed',
          execution_time_ms: 50,
          executed_at: '2024-01-01T01:05:00Z',
          success: false
        }
      ];
      query.mockResolvedValue({ rows: mockRequests });

      const response = await request(app)
        .get('/api/v1/approvals');

      expect(response.status).toBe(200);
      expect(response.body.requests[0].result.status).toBe('failure');
      expect(response.body.requests[0].result.error).toBe('Query failed');
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/approvals');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to fetch approval requests'
      });
    });
  });

  describe('POST /api/v1/approvals/:reqId/action', () => {
    it('should approve request successfully', async () => {
      // First call: POD check query
      // Second call: Update query
      query
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1', status: 'PENDING' }] }) // POD check - manager owns POD 1
        .mockResolvedValueOnce({ rows: [{ id: 1, query_text: 'SELECT * FROM users', script_path: null }] }); // Update
      executionService.executeQuery.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, status: 'approved' });
      expect(executionService.executeQuery).toHaveBeenCalledWith(1);
    });

    it('should approve script request and trigger script execution', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1', status: 'PENDING' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1, query_text: null, script_path: 'test script content' }] }); // Update
      executionService.executeQuery.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, status: 'approved' });
      expect(executionService.executeQuery).toHaveBeenCalledWith(1);
    });

    it('should return 403 when manager tries to approve request from different POD', async () => {
      // Request belongs to POD 2, but manager only manages POD 1
      query.mockResolvedValueOnce({ rows: [{ pod_id: 'pod-2', status: 'PENDING' }] });

      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied - request belongs to different POD'
      });
    });

    it('should return 400 for invalid action', async () => {
      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should return 404 when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Request not found'
      });
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Approval action failed'
      });
    });

    it('should handle query execution error in async callback', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1', status: 'PENDING' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1, query_text: 'SELECT * FROM users', script_path: null }] }); // Update
      executionService.executeQuery.mockRejectedValue(new Error('Execution failed'));

      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, status: 'approved' });
      // The error is logged but doesn't affect the response
    });

    it('should handle script execution error in async callback', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ pod_id: 'pod-1', status: 'PENDING' }] }) // POD check
        .mockResolvedValueOnce({ rows: [{ id: 1, query_text: null, script_path: 'console.log("test")' }] }); // Update
      executionService.executeQuery.mockRejectedValue(new Error('Script execution failed'));

      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, status: 'approved' });
    });
  });

  describe('GET /api/v1/request/:req_id/result', () => {
    it('should return execution result for request owner', async () => {
      const mockRequestResult = {
        rows: [{ requester_id: 2 }] // Manager's ID
      };
      const mockExecutionResult = {
        success: true,
        output: '{"rows": [{"id": 1}]}',
        execution_time: 150
      };
      
      query.mockResolvedValue(mockRequestResult);
      executionService.getExecutionResult.mockResolvedValue(mockExecutionResult);

      const response = await request(app)
        .get('/api/v1/request/1/result');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, ...mockExecutionResult });
    });

    it('should return 404 when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/request/999/result');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Request not found'
      });
    });

    it('should handle execution service errors', async () => {
      const mockRequestResult = {
        rows: [{ requester_id: 2 }]
      };
      query.mockResolvedValue(mockRequestResult);
      executionService.getExecutionResult.mockRejectedValue(new Error('Execution error'));

      const response = await request(app)
        .get('/api/v1/request/1/result');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to get execution result'
      });
    });
  });
});