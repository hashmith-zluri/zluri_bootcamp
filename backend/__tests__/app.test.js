const request = require('supertest');
const app = require('../src/app');

describe('App Integration Tests', () => {
  describe('Root Redirect', () => {
    it('should redirect root path to API docs', async () => {
      const response = await request(app)
        .get('/');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/api-docs');
    });
  });

  describe('Swagger Documentation', () => {
    it('should serve Swagger UI at /api-docs', async () => {
      const response = await request(app)
        .get('/api-docs/');

      expect(response.status).toBe(200);
      expect(response.text).toContain('swagger-ui');
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ 
        status: 'ok',
        version: '2.0.0',
        documentation: '/api-docs'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('string');
    });
  });

  describe('CORS', () => {
    it('should have CORS enabled', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('JSON Parsing', () => {
    it('should parse JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      // Should not return 400 for malformed JSON (since we're sending valid JSON)
      expect(response.status).not.toBe(400);
    });
  });

  describe('Route Mounting', () => {
    it('should mount auth routes', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      // Should reach the controller (not 404)
      expect(response.status).not.toBe(404);
    });

    it('should mount db routes', async () => {
      const response = await request(app)
        .get('/api/v1/db/types');

      // Should reach the controller (not 404)
      expect(response.status).not.toBe(404);
    });

    it('should mount request routes', async () => {
      const response = await request(app)
        .post('/api/v1/request')
        .send({});

      // Should reach the controller (not 404)
      expect(response.status).not.toBe(404);
    });

    it('should mount approval routes', async () => {
      const response = await request(app)
        .get('/api/v1/approvals');

      // Should reach the controller (not 404)
      expect(response.status).not.toBe(404);
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown');

      expect(response.status).toBe(404);
    });
  });
});
