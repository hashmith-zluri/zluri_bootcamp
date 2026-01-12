const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authService = require('../../src/services/auth.service');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
        role: 'DEVELOPER'
      };

      query.mockResolvedValue({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-token');

      const result = await authService.login('test@example.com', 'password123');

      expect(result.token).toBe('mock-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('DEVELOPER');
    });

    it('should throw error for non-existent user', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(authService.login('nonexistent@example.com', 'password'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error for invalid password', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'DEVELOPER'
      };

      query.mockResolvedValue({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should handle bcrypt comparison error', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'DEVELOPER'
      };

      query.mockResolvedValue({ rows: [mockUser] });
      bcrypt.compare.mockRejectedValue(new Error('bcrypt error'));

      await expect(authService.login('test@example.com', 'password'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should handle database query error', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(authService.login('test@example.com', 'password'))
        .rejects.toThrow('Database error');
    });
  });

  describe('logout', () => {
    it('should logout successfully', () => {
      const result = authService.logout('some-token');
      expect(result).toBe(true);
    });

    it('should handle logout for non-existent token', () => {
      const result = authService.logout('non-existent-token');
      expect(result).toBe(true);
    });
  });

  describe('verifyToken', () => {
    it('should return error for inactive token', () => {
      const mockDecoded = { userId: 1, email: 'test@example.com' };
      jwt.verify.mockReturnValue(mockDecoded);

      const result = authService.verifyToken('inactive-token');

      expect(result.error).toBe('TOKEN_NOT_ACTIVE');
    });

    it('should return decoded token for active token', async () => {
      // First login to add token to active set
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
        role: 'DEVELOPER'
      };

      query.mockResolvedValue({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('active-token');

      await authService.login('test@example.com', 'password123');

      // Now verify the active token
      const mockDecoded = { userId: 1, email: 'test@example.com', role: 'DEVELOPER' };
      jwt.verify.mockReturnValue(mockDecoded);

      const result = authService.verifyToken('active-token');

      expect(result.userId).toBe(1);
      expect(result.email).toBe('test@example.com');
    });

    it('should return error for expired token', () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      expiredError.expiredAt = new Date();
      jwt.verify.mockImplementation(() => { throw expiredError; });

      const result = authService.verifyToken('expired-token');

      expect(result.error).toBe('TOKEN_EXPIRED');
      expect(result.expiredAt).toBeDefined();
    });

    it('should return error for invalid token', () => {
      const invalidError = new Error('Invalid token');
      invalidError.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => { throw invalidError; });

      const result = authService.verifyToken('invalid-token');

      expect(result.error).toBe('TOKEN_INVALID');
    });

    it('should return error for unknown verification failure', () => {
      const unknownError = new Error('Unknown error');
      unknownError.name = 'UnknownError';
      jwt.verify.mockImplementation(() => { throw unknownError; });

      const result = authService.verifyToken('bad-token');

      expect(result.error).toBe('TOKEN_VERIFICATION_FAILED');
    });

    it('should remove invalid token from active set', async () => {
      // First login to add token to active set
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
        role: 'DEVELOPER'
      };

      query.mockResolvedValue({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('will-expire-token');

      await authService.login('test@example.com', 'password123');

      // Now simulate token expiration
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      expiredError.expiredAt = new Date();
      jwt.verify.mockImplementation(() => { throw expiredError; });

      const result = authService.verifyToken('will-expire-token');

      expect(result.error).toBe('TOKEN_EXPIRED');

      // Verify token was removed - next verify should still fail
      jwt.verify.mockReturnValue({ userId: 1 });
      const result2 = authService.verifyToken('will-expire-token');
      expect(result2.error).toBe('TOKEN_NOT_ACTIVE');
    });
  });
});
