const request = require('supertest');
const app = require('../../src/app');
const { query } = require('../../src/config/db');

// Mock dependencies
jest.mock('../../src/config/db');
jest.mock('../../src/config/pods', () => [
  { id: 1, manager_email: 'manager@example.com', name: 'Pod 1' },
  { id: 2, manager_email: 'other@example.com', name: 'Pod 2' }
]);

// Mock auth middleware for regular user
jest.mock('../../src/middlewares/auth.middleware', () => {
  return (req, res, next) => {
    req.user = global.mockUser;
    next();
  };
});

describe('Approval Controller - User Access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/approvals', () => {
    it('should return 403 for non-manager users', async () => {
      const response = await request(app)
        .get('/api/v1/approvals');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });

  describe('POST /api/v1/approvals/:reqId/action', () => {
    it('should return 403 for non-manager users', async () => {
      const response = await request(app)
        .post('/api/v1/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });

  describe('GET /api/v1/request/:reqid/result', () => {
    it('should return execution result for own request', async () => {
      // First query: getRequestOwnership
      const mockOwnershipResult = {
        rows: [{ requester_id: 1 }] // User's own request
      };
      
      // Second query: get engine info for execution result
      const mockEngineResult = {
        rows: [{ engine: 'POSTGRES', query_text: 'SELECT 1', script_path: null }]
      };
      
      // Third query: get execution result
      const mockExecutionResult = {
        rows: [{
          success: true,
          output: 'Query result',
          error: null,
          execution_time_ms: 100,
          executed_at: '2024-01-01T00:00:00Z',
          status: 'EXECUTED'
        }]
      };
      
      query
        .mockResolvedValueOnce(mockOwnershipResult)
        .mockResolvedValueOnce(mockEngineResult)
        .mockResolvedValueOnce(mockExecutionResult);

      const response = await request(app)
        .get('/api/v1/request/1/result');

      expect(response.status).toBe(200);
    });

    it('should return 403 when accessing other user request', async () => {
      const mockRequestResult = {
        rows: [{ requester_id: 999 }] // Different user
      };
      query.mockResolvedValue(mockRequestResult);

      const response = await request(app)
        .get('/api/v1/request/1/result');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });
});