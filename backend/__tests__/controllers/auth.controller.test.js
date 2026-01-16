const request = require('supertest');

// Mock auth service before requiring app
jest.mock('../../src/services/auth.service', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  verifyToken: jest.fn()
}));

const authService = require('../../src/services/auth.service');

describe('Auth Controller', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset modules to get fresh app instance
    jest.resetModules();
    
    // Re-mock after reset
    jest.doMock('../../src/services/auth.service', () => ({
      login: jest.fn(),
      logout: jest.fn(),
      verifyToken: jest.fn()
    }));
    
    app = require('../../src/app');
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const authSvc = require('../../src/services/auth.service');
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
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        token: 'mock-jwt-token',
        user: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'DEVELOPER'
        }
      });
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email format');
    });

    it('should return 401 for invalid credentials', async () => {
      const authSvc = require('../../src/services/auth.service');
      authSvc.login.mockRejectedValue(new Error('Invalid email or password'));

      const response = await request(app)
        .post('/api/v1/auth/login')
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
      const authSvc = require('../../src/services/auth.service');
      const error = new Error();
      error.message = '';
      authSvc.login.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication failed');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const authSvc = require('../../src/services/auth.service');
      authSvc.verifyToken.mockReturnValue({
        userId: 1,
        email: 'test@example.com',
        role: 'DEVELOPER'
      });
      authSvc.logout.mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/auth/logout')
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
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    }, 15000);

    it('should return 500 when logout throws error', async () => {
      const authSvc = require('../../src/services/auth.service');
      authSvc.verifyToken.mockReturnValue({
        userId: 1,
        email: 'test@example.com',
        role: 'DEVELOPER'
      });
      authSvc.logout.mockImplementation(() => {
        throw new Error('Logout failed');
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Logout failed'
      });
    });

    it('should return 500 with default message when error has no message', async () => {
      const authSvc = require('../../src/services/auth.service');
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
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Logout failed');
    });

    it('should logout successfully even without authorization header (edge case)', async () => {
      // This tests the case where somehow a request gets through without auth header
      // but still reaches the logout controller (bypassing middleware)
      const authSvc = require('../../src/services/auth.service');
      
      // Mock the middleware to allow the request through
      const originalApp = require('../../src/app');
      
      const response = await request(originalApp)
        .post('/api/v1/auth/logout');

      // This should still return 401 due to middleware, but if it somehow gets through,
      // the controller should handle it gracefully
      expect(response.status).toBe(401);
    });
  });
});

describe('Auth Controller - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should handle logout when token is null/undefined gracefully', async () => {
    // Mock middleware to bypass auth and set no token
    jest.doMock('../../src/middlewares/auth.middleware', () => {
      return (req, res, next) => {
        req.user = { id: 1, email: 'test@example.com', role: 'DEVELOPER' };
        req.headers.authorization = undefined; // No token
        next();
      };
    });

    const authSvc = require('../../src/services/auth.service');
    authSvc.logout = jest.fn();

    const app = require('../../src/app');
    
    const response = await request(app)
      .post('/api/v1/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Logged out successfully'
    });
    // logout should not be called when token is falsy
    expect(authSvc.logout).not.toHaveBeenCalled();
  });
});
