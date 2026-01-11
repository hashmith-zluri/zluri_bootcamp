const request = require('supertest');

// Mock auth service before requiring app
jest.mock('../src/services/auth.service', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  verifyToken: jest.fn()
}));

const authService = require('../src/services/auth.service');

describe('Auth Controller', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset modules to get fresh app instance
    jest.resetModules();
    
    // Re-mock after reset
    jest.doMock('../src/services/auth.service', () => ({
      login: jest.fn(),
      logout: jest.fn(),
      verifyToken: jest.fn()
    }));
    
    app = require('../src/app');
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const authSvc = require('../src/services/auth.service');
      authSvc.login.mockResolvedValue({
        token: 'mock-jwt-token',
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'DEVELOPER'
        }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jwtToken: 'mock-jwt-token',
        success: true
      });
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Email and password are required'
      });
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Email and password are required'
      });
    });

    it('should return 401 for invalid credentials', async () => {
      const authSvc = require('../src/services/auth.service');
      authSvc.login.mockRejectedValue(new Error('Invalid email or password'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        message: 'Invalid email or password'
      });
    });

    it('should return 401 with default message when error has no message', async () => {
      const authSvc = require('../src/services/auth.service');
      const error = new Error();
      error.message = '';
      authSvc.login.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication failed');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const authSvc = require('../src/services/auth.service');
      authSvc.verifyToken.mockReturnValue({
        userId: 1,
        email: 'test@example.com',
        role: 'DEVELOPER'
      });
      authSvc.logout.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully'
      });
      expect(authSvc.logout).toHaveBeenCalledWith('valid-token');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    it('should return 500 when logout throws error', async () => {
      const authSvc = require('../src/services/auth.service');
      authSvc.verifyToken.mockReturnValue({
        userId: 1,
        email: 'test@example.com',
        role: 'DEVELOPER'
      });
      authSvc.logout.mockImplementation(() => {
        throw new Error('Logout failed');
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Logout failed'
      });
    });

    it('should return 500 with default message when error has no message', async () => {
      const authSvc = require('../src/services/auth.service');
      authSvc.verifyToken.mockReturnValue({
        userId: 1,
        email: 'test@example.com',
        role: 'DEVELOPER'
      });
      authSvc.logout.mockImplementation(() => {
        const error = new Error();
        error.message = '';
        throw error;
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Logout failed');
    });
  });
});
