const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');

jest.mock('../src/config/db');

// Mock auth middleware
jest.mock('../src/middlewares/auth.middleware', () => {
  return (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'DEVELOPER' };
    next();
  };
});

describe('Request Routes - File Upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/request - File upload errors', () => {
    it('should reject non-JS files', async () => {
      const response = await request(app)
        .post('/api/request')
        .field('instance_id', '1')
        .field('db_name', 'test_db')
        .field('comments', 'Test')
        .field('pod_id', '1')
        .attach('script', Buffer.from('print("hello")'), 'test.py');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('JavaScript');
    });

    it('should handle file size limit error', async () => {
      // Create a buffer larger than 16MB
      const largeBuffer = Buffer.alloc(17 * 1024 * 1024, 'x');
      
      const response = await request(app)
        .post('/api/request')
        .field('instance_id', '1')
        .field('db_name', 'test_db')
        .field('comments', 'Test')
        .field('pod_id', '1')
        .attach('script', largeBuffer, 'large.js');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('File too large');
    });

    it('should accept valid JS file', async () => {
      query.mockResolvedValue({
        rows: [{ id: 1, status: 'PENDING' }]
      });

      const response = await request(app)
        .post('/api/request')
        .field('instance_id', '1')
        .field('db_name', 'test_db')
        .field('comments', 'Test script')
        .field('pod_id', '1')
        .attach('script', Buffer.from('console.log("test");'), 'test.js');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle request without file', async () => {
      query.mockResolvedValue({
        rows: [{ id: 1, status: 'PENDING' }]
      });

      const response = await request(app)
        .post('/api/request')
        .send({
          instance_id: 1,
          db_name: 'test_db',
          query: 'SELECT * FROM users;',
          comments: 'Test query',
          pod_id: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle multer unexpected field error', async () => {
      const response = await request(app)
        .post('/api/request')
        .field('instance_id', '1')
        .field('db_name', 'test_db')
        .field('comments', 'Test')
        .field('pod_id', '1')
        .attach('wrong_field_name', Buffer.from('test'), 'test.js');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Upload error');
    });

    it('should handle LIMIT_FILE_COUNT error', async () => {
      // This tests the multer error handling for too many files
      // Since multer is configured for single file, sending multiple triggers this
      const response = await request(app)
        .post('/api/request')
        .field('instance_id', '1')
        .field('db_name', 'test_db')
        .field('comments', 'Test')
        .field('pod_id', '1')
        .attach('script', Buffer.from('console.log(1);'), 'test1.js')
        .attach('script', Buffer.from('console.log(2);'), 'test2.js');

      expect(response.status).toBe(400);
      // Multer will reject with unexpected field since it expects single file
    });
  });
});
