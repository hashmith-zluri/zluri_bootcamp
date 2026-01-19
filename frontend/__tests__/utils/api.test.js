import { apiRequest, authAPI, dbAPI, requestAPI, approvalAPI } from '../../src/utils/api';

// Mock fetch
global.fetch = jest.fn();

describe('API Utils', () => {
  let localStorageMock;
  let originalLocation;

  beforeAll(() => {
    // Save original location
    originalLocation = window.location;
    
    // Mock window.location
    delete window.location;
    window.location = { href: '' };
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup localStorage mock
    localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', { 
      value: localStorageMock,
      writable: true 
    });
    
    localStorageMock.getItem.mockReturnValue(null);
    window.location.href = '';
  });

  describe('API Base URL Configuration', () => {
    it('should use test environment URL when NODE_ENV is test', () => {
      // This is already covered by the default test environment
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should handle non-test environment', () => {
      // Test the non-test environment branch by temporarily changing NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Re-import to trigger the conditional logic
      jest.resetModules();
      const { apiRequest: devApiRequest } = require('../../src/utils/api');
      
      expect(typeof devApiRequest).toBe('function');
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle undefined process environment', () => {
      // Test the case where process is undefined
      const originalProcess = global.process;
      global.process = undefined;
      
      jest.resetModules();
      const { apiRequest: undefinedProcessApiRequest } = require('../../src/utils/api');
      
      expect(typeof undefinedProcessApiRequest).toBe('function');
      
      // Restore original process
      global.process = originalProcess;
    });
  });

  describe('apiRequest', () => {
    it('should make successful API request', async () => {
      const mockData = { success: true, data: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await apiRequest('/test');
      expect(result).toEqual(mockData);
    });

    it('should include auth token in headers when available', async () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await apiRequest('/test');
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle 401 unauthorized and clear storage', async () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(apiRequest('/test')).rejects.toThrow('Session expired. Please login again.');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });

    it('should not redirect on 401 for login endpoint', async () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(apiRequest('/auth/login')).rejects.toThrow('Invalid credentials');
      // Should not call removeItem for login endpoint
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });

    it('should handle 401 without token', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(apiRequest('/test')).rejects.toThrow('Unauthorized');
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });

    it('should handle 403 forbidden', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      });

      await expect(apiRequest('/test')).rejects.toThrow('You do not have permission to perform this action.');
    });

    it('should handle validation errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errors: [
            { field: 'email', message: 'Invalid email' },
            { field: 'password', message: 'Too short' },
          ],
        }),
      });

      await expect(apiRequest('/test')).rejects.toThrow('email: Invalid email, password: Too short');
    });

    it('should handle generic error messages', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      });

      await expect(apiRequest('/test')).rejects.toThrow('Server error');
    });

    it('should handle errors without message', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(apiRequest('/test')).rejects.toThrow('Something went wrong');
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(apiRequest('/test')).rejects.toThrow('Network error. Please check your connection.');
    });

    it('should handle other errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Custom error'));

      await expect(apiRequest('/test')).rejects.toThrow('Custom error');
    });

    it('should pass through options', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await apiRequest('/test', { method: 'POST', body: JSON.stringify({ data: 'test' }) });
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        })
      );
    });

    it('should merge custom headers with default headers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await apiRequest('/test', { 
        headers: { 
          'Custom-Header': 'custom-value',
          'Content-Type': 'application/xml' // Should override default
        } 
      });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'custom-value',
            'Content-Type': 'application/xml',
          }),
        })
      );
    });
  });

  describe('authAPI', () => {
    it('should call login endpoint', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token', user: {} }),
      });

      const credentials = { email: 'test@example.com', password: 'password' };
      await authAPI.login(credentials);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('dbAPI', () => {
    it('should get database types', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ types: ['POSTGRES', 'MONGO'] }),
      });

      await dbAPI.getTypes();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/db/types'), expect.any(Object));
    });

    it('should get instances by type', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ instances: [] }),
      });

      await dbAPI.getInstances('POSTGRES');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/db/instances?type=POSTGRES'), expect.any(Object));
    });

    it('should get databases for instance', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ databases: [] }),
      });

      await dbAPI.getDatabases('1');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/db/instances/1/name'), expect.any(Object));
    });
  });

  describe('requestAPI', () => {
    it('should submit request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, id: 1 }),
      });

      await requestAPI.submit({ query: 'SELECT 1' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should get my requests without params', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/request/mine'), expect.any(Object));
    });

    it('should get my requests with status filter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ status: 'PENDING' });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('status=PENDING'), expect.any(Object));
    });

    it('should not include status when set to "all"', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ status: 'all' });
      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).not.toContain('status=');
    });

    it('should get my requests with pagination', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ limit: 10, offset: 20 });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=20'), expect.any(Object));
    });

    it('should get request result', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: {} }),
      });

      await requestAPI.getResult(123);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/request/123/result'), expect.any(Object));
    });
  });

  describe('approvalAPI', () => {
    it('should get pending requests', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await approvalAPI.getPendingRequests();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/approvals'), expect.any(Object));
    });

    it('should approve request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await approvalAPI.approveOrReject(123, 'approve');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approvals/123/action'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should reject request with reason', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await approvalAPI.approveOrReject(123, 'reject', 'Too risky');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approvals/123/action'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'reject', reason: 'Too risky' }),
        })
      );
    });
  });

  describe('buildQueryParams edge cases', () => {
    it('should handle empty params object', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({});
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/request/mine'), expect.any(Object));
    });

    it('should handle null values', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ status: null, sortBy: null, limit: null, offset: null });
      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('/request/mine');
      expect(callUrl).not.toContain('status=');
      expect(callUrl).not.toContain('sortBy=');
      expect(callUrl).not.toContain('limit=');
      expect(callUrl).not.toContain('offset=');
    });

    it('should handle undefined values', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ 
        status: undefined, 
        sortBy: undefined, 
        limit: undefined, 
        offset: undefined 
      });
      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('/request/mine');
      expect(callUrl).not.toContain('status=');
      expect(callUrl).not.toContain('sortBy=');
      expect(callUrl).not.toContain('limit=');
      expect(callUrl).not.toContain('offset=');
    });

    it('should handle unknown parameters', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ 
        unknownParam: 'value',
        anotherParam: 123
      });
      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).not.toContain('unknownParam=');
      expect(callUrl).not.toContain('anotherParam=');
    });
  });

  describe('requestAPI - additional coverage', () => {
    it('should include sortBy parameter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ sortBy: 'created_at' });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('sortBy=created_at'), expect.any(Object));
    });

    it('should include limit when set to 0', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ limit: 0 });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=0'), expect.any(Object));
    });

    it('should include offset when set to 0', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ offset: 0 });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=0'), expect.any(Object));
    });

    it('should include all parameters together', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await requestAPI.getMyRequests({ 
        status: 'PENDING', 
        sortBy: 'created_at', 
        limit: 10, 
        offset: 20 
      });
      
      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('status=PENDING');
      expect(callUrl).toContain('sortBy=created_at');
      expect(callUrl).toContain('limit=10');
      expect(callUrl).toContain('offset=20');
    });
  });

  describe('approvalAPI - additional coverage', () => {
    it('should get pending requests with status filter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await approvalAPI.getPendingRequests({ status: 'PENDING' });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('status=PENDING'), expect.any(Object));
    });

    it('should not include status when set to "all"', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await approvalAPI.getPendingRequests({ status: 'all' });
      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).not.toContain('status=');
    });

    it('should include sortBy parameter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await approvalAPI.getPendingRequests({ sortBy: 'created_at' });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('sortBy=created_at'), expect.any(Object));
    });

    it('should include limit when set to 0', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await approvalAPI.getPendingRequests({ limit: 0 });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=0'), expect.any(Object));
    });

    it('should include offset when set to 0', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await approvalAPI.getPendingRequests({ offset: 0 });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=0'), expect.any(Object));
    });

    it('should include all parameters together', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });

      await approvalAPI.getPendingRequests({ 
        status: 'EXECUTED', 
        sortBy: 'updated_at', 
        limit: 50, 
        offset: 100 
      });
      
      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('status=EXECUTED');
      expect(callUrl).toContain('sortBy=updated_at');
      expect(callUrl).toContain('limit=50');
      expect(callUrl).toContain('offset=100');
    });
  });
});
