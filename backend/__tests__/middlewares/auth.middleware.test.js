const authMiddleware = require('../../src/middlewares/auth.middleware');
const authService = require('../../src/services/auth.service');

jest.mock('../../src/services/auth.service');

describe('Auth Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  it('should return 401 when no authorization header', () => {
    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'No token provided'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header does not start with Bearer', () => {
    mockReq.headers.authorization = 'Basic sometoken';

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'No token provided'
    });
  });

  it('should return 401 for expired token', () => {
    mockReq.headers.authorization = 'Bearer expired-token';
    authService.verifyToken.mockReturnValue({ error: 'TOKEN_EXPIRED' });

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Token has expired. Please login again.'
    });
  });

  it('should return 401 for inactive token', () => {
    mockReq.headers.authorization = 'Bearer inactive-token';
    authService.verifyToken.mockReturnValue({ error: 'TOKEN_NOT_ACTIVE' });

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Token is not active. Please login again.'
    });
  });

  it('should return 401 for invalid token', () => {
    mockReq.headers.authorization = 'Bearer invalid-token';
    authService.verifyToken.mockReturnValue({ error: 'TOKEN_INVALID' });

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid token. Please login again.'
    });
  });

  it('should return 401 for token verification failed', () => {
    mockReq.headers.authorization = 'Bearer bad-token';
    authService.verifyToken.mockReturnValue({ error: 'TOKEN_VERIFICATION_FAILED' });

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Token verification failed. Please login again.'
    });
  });

  it('should return 401 for unknown error', () => {
    mockReq.headers.authorization = 'Bearer bad-token';
    authService.verifyToken.mockReturnValue({ error: 'UNKNOWN_ERROR' });

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid or expired token'
    });
  });

  it('should return 401 when decoded is null', () => {
    mockReq.headers.authorization = 'Bearer null-token';
    authService.verifyToken.mockReturnValue(null);

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid or expired token'
    });
  });

  it('should call next and attach user for valid token', () => {
    mockReq.headers.authorization = 'Bearer valid-token';
    authService.verifyToken.mockReturnValue({
      userId: 1,
      email: 'test@example.com',
      role: 'DEVELOPER'
    });

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual({
      id: 1,
      email: 'test@example.com',
      role: 'DEVELOPER'
    });
    expect(mockReq.token).toBe('valid-token');
  });

  it('should return 401 when verifyToken throws exception', () => {
    mockReq.headers.authorization = 'Bearer error-token';
    authService.verifyToken.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication failed'
    });
  });
});
