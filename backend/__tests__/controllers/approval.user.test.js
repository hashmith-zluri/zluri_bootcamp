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

  describe('GET /api/approvals', () => {
    it('should return 403 for non-manager users', async () => {
      const response = await request(app)
        .get('/api/approvals');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });

  describe('POST /api/approvals/:reqId/action', () => {
    it('should return 403 for non-manager users', async () => {
      const response = await request(app)
        .post('/api/approvals/1/action')
        .send({ action: 'approve' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });

  describe('GET /api/request/:reqid/result', () => {
    it('should return execution result for own request', async () => {
      const mockRequestResult = {
        rows: [{ requester_id: 1 }] // User's own request
      };
      
      query.mockResolvedValue(mockRequestResult);

      const response = await request(app)
        .get('/api/request/1/result');

      expect(response.status).toBe(200);
    });

    it('should return 403 when accessing other user request', async () => {
      const mockRequestResult = {
        rows: [{ requester_id: 999 }] // Different user
      };
      query.mockResolvedValue(mockRequestResult);

      const response = await request(app)
        .get('/api/request/1/result');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        message: 'Access denied'
      });
    });
  });
});