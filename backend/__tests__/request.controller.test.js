const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');

// Mock the database
jest.mock('../src/config/db');

// Mock auth middleware
jest.mock('../src/middlewares/auth.middleware', () => {
  return (req, res, next) => {
    req.user = global.mockUser;
    next();
  };
});

describe('Request Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/request', () => {
    const validRequestData = {
      instance_id: 1,
      db_name: 'test_db',
      query: 'SELECT * FROM users',
      comments: 'Test query',
      pod_id: 1
    };

    it('should submit request successfully with query', async () => {
      const mockResult = {
        rows: [{ id: 123, status: 'PENDING' }]
      };
      query.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/request')
        .send(validRequestData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        req_id: 123,
        status: 'PENDING'
      });
    });

    it('should submit request successfully with script file', async () => {
      const mockResult = {
        rows: [{ id: 124, status: 'PENDING' }]
      };
      query.mockResolvedValue(mockResult);

      const scriptContent = 'console.log("test script");';
      const response = await request(app)
        .post('/api/request')
        .field('instance_id', '1')
        .field('db_name', 'test_db')
        .field('comments', 'Test script')
        .field('pod_id', '1')
        .attach('script', Buffer.from(scriptContent), 'test.js');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        req_id: 124,
        status: 'PENDING'
      });
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/request')
        .send({
          instance_id: 1,
          db_name: 'test_db'
          // missing comments and pod_id
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Missing required fields'
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('should return 400 when neither query nor script provided', async () => {
      const response = await request(app)
        .post('/api/request')
        .send({
          instance_id: 1,
          db_name: 'test_db',
          comments: 'Test request',
          pod_id: 1
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Either query or script file must be provided'
      });
    });

    it('should return 400 when both query and script provided', async () => {
      const response = await request(app)
        .post('/api/request')
        .field('instance_id', '1')
        .field('db_name', 'test_db')
        .field('query', 'SELECT * FROM users')
        .field('comments', 'Test request')
        .field('pod_id', '1')
        .attach('script', Buffer.from('test script'), 'test.js');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Provide either query or script file, not both'
      });
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/request')
        .send(validRequestData);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to submit request'
      });
    });
  });

  describe('GET /api/request/mine', () => {
    it('should return user requests successfully', async () => {
      const mockRequests = [
        {
          reqid: 1,
          query_text: 'SELECT * FROM users',
          script_path: null,
          status: 'PENDING',
          database_name: 'test_db',
          comments: 'Test query',
          created_at: '2024-01-01T00:00:00Z',
          approved_at: null,
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
        .get('/api/request/mine');

      expect(response.status).toBe(200);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0]).toMatchObject({
        req_id: 1,
        query: 'SELECT * FROM users',
        status: 'PENDING',
        database_name: 'test_db',
        result: null
      });
    });

    it('should return requests with execution results', async () => {
      const mockRequests = [
        {
          reqid: 1,
          query_text: 'SELECT * FROM users',
          script_path: null,
          status: 'APPROVED',
          database_name: 'test_db',
          comments: 'Test query',
          created_at: '2024-01-01T00:00:00Z',
          approved_at: '2024-01-01T01:00:00Z',
          instance_name: 'postgres-prod',
          database_type: 'POSTGRES',
          output: '{"rows": [{"id": 1}]}',
          error: null,
          execution_time_ms: 150,
          executed_at: '2024-01-01T01:05:00Z',
          success: true
        }
      ];
      query.mockResolvedValue({ rows: mockRequests });

      const response = await request(app)
        .get('/api/request/mine');

      expect(response.status).toBe(200);
      expect(response.body.requests[0].result).toMatchObject({
        output: '{"rows": [{"id": 1}]}',
        response_time: 150,
        status: 'success',
        executed_at: '2024-01-01T01:05:00Z'
      });
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/request/mine');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to fetch requests'
      });
    });
  });
});

describe('Request Controller - No User', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock auth middleware to not set user
    jest.doMock('../src/middlewares/auth.middleware', () => {
      return (req, res, next) => {
        req.user = null; // No user
        next();
      };
    });
  });

  it('should return 401 when user is not set', async () => {
    const appNoUser = require('../src/app');
    
    const response = await request(appNoUser)
      .get('/api/request/mine');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Unauthorized'
    });
  });
});


describe('Request Controller - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock auth middleware with user
    jest.doMock('../src/middlewares/auth.middleware', () => {
      return (req, res, next) => {
        req.user = { id: 1, email: 'test@example.com', role: 'DEVELOPER' };
        next();
      };
    });
  });

  it('should return requests with failed execution results', async () => {
    jest.doMock('../src/config/db', () => ({
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            reqid: 1,
            query_text: 'SELECT * FROM users',
            script_path: null,
            status: 'FAILED',
            database_name: 'test_db',
            comments: 'Test query',
            created_at: '2024-01-01T00:00:00Z',
            approved_at: '2024-01-01T01:00:00Z',
            instance_name: 'postgres-prod',
            database_type: 'POSTGRES',
            output: null,
            error: 'Query execution failed',
            execution_time_ms: 50,
            executed_at: '2024-01-01T01:05:00Z',
            success: false
          }
        ]
      })
    }));

    const appWithUser = require('../src/app');
    
    const response = await request(appWithUser)
      .get('/api/request/mine');

    expect(response.status).toBe(200);
    expect(response.body.requests[0].result).toMatchObject({
      status: 'failure',
      error: 'Query execution failed'
    });
  });

  it('should handle submit request when req.body is undefined', async () => {
    jest.doMock('../src/config/db', () => ({
      query: jest.fn()
    }));

    const appWithUser = require('../src/app');
    
    const response = await request(appWithUser)
      .post('/api/request')
      .set('Content-Type', 'application/json')
      .send(undefined);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Missing required fields');
  });
});
