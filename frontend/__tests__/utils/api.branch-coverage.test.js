import { authAPI, dbAPI, requestAPI, approvalAPI, apiRequest } from '../../src/utils/api';

// Mock fetch
global.fetch = jest.fn();

describe('API - Branch Coverage Tests', () => {
  let localStorageMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup localStorage mock
    localStorageMock = {
      getItem: jest.fn(() => 'mock-token'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', { 
      value: localStorageMock,
      writable: true 
    });

    // Mock window.location by deleting and recreating
    delete window.location;
    window.location = {
      href: 'http://localhost/',
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn()
    };

    // Default successful response
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: 'test' }),
    });
  });

  describe('apiRequest - Error Handling Branches', () => {


    it('should handle 401 for login endpoint without redirect', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      await expect(apiRequest('/auth/login')).rejects.toThrow('Invalid credentials');
      
      // Should not redirect for login endpoint
      expect(window.location.href).toBe('http://localhost/');
    });

    it('should handle 403 forbidden', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      });

      await expect(apiRequest('/test')).rejects.toThrow('You do not have permission to perform this action.');
    });

    it('should handle validation errors from backend', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          errors: [
            { field: 'email', message: 'Invalid email' },
            { field: 'password', message: 'Too short' }
          ]
        }),
      });

      await expect(apiRequest('/test')).rejects.toThrow('email: Invalid email, password: Too short');
    });

    it('should handle network errors (TypeError)', async () => {
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(apiRequest('/test')).rejects.toThrow('Network error. Please check your connection.');
    });

    it('should handle generic server errors without message', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      await expect(apiRequest('/test')).rejects.toThrow('Something went wrong');
    });

    it('should handle requests without token', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const mockResponse = { success: true };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiRequest('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle malformed JSON response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(apiRequest('/test')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('buildQueryParams - Branch Coverage', () => {
    it('should handle requestAPI.getMyRequests with null parameters', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await requestAPI.getMyRequests(null);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle requestAPI.getMyRequests with undefined parameters', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await requestAPI.getMyRequests(undefined);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle empty string search parameter', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await requestAPI.getMyRequests({ search: '' });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine'),
        expect.any(Object)
      );
    });

    it('should handle whitespace-only search parameter', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await requestAPI.getMyRequests({ search: '   ' });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine'),
        expect.any(Object)
      );
    });

    it('should handle zero values for limit and offset', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await requestAPI.getMyRequests({ limit: 0, offset: 0 });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine?limit=0&offset=0'),
        expect.any(Object)
      );
    });

    it('should handle status "all" parameter', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await requestAPI.getMyRequests({ status: 'all' });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine'),
        expect.any(Object)
      );
    });

    it('should handle valid search parameter with trimming', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await requestAPI.getMyRequests({ search: '  test query  ' });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine?search=test+query'),
        expect.any(Object)
      );
    });

    it('should handle all parameters together', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await requestAPI.getMyRequests({
        status: 'PENDING',
        sortBy: 'created_at',
        limit: 10,
        offset: 20,
        search: 'test',
        searchField: 'all'
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/request/mine?status=PENDING&sortBy=created_at&limit=10&offset=20&search=test&searchField=all'),
        expect.any(Object)
      );
    });
  });

  describe('approvalAPI - Branch Coverage', () => {
    it('should handle approvalAPI.getPendingRequests with null parameters', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await approvalAPI.getPendingRequests(null);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approvals'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle approvalAPI.getPendingRequests with undefined parameters', async () => {
      const mockResponse = { requests: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await approvalAPI.getPendingRequests(undefined);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approvals'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle approveOrReject with null reason', async () => {
      const mockResponse = { success: true };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await approvalAPI.approveOrReject(123, 'approve', null);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approvals/123/action'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'approve', reason: null }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle approveOrReject without reason parameter', async () => {
      const mockResponse = { success: true };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await approvalAPI.approveOrReject(123, 'reject');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approvals/123/action'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'reject', reason: null }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('API Error Scenarios', () => {
    it('should handle authAPI.login failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      await expect(authAPI.login({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle dbAPI.getTypes failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      await expect(dbAPI.getTypes()).rejects.toThrow('Server error');
    });

    it('should handle dbAPI.getInstances failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Database connection failed' }),
      });

      await expect(dbAPI.getInstances('POSTGRES')).rejects.toThrow('Database connection failed');
    });

    it('should handle dbAPI.getDatabases failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Instance not found' }),
      });

      await expect(dbAPI.getDatabases('999')).rejects.toThrow('Instance not found');
    });

    it('should handle requestAPI.submit failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid request data' }),
      });

      await expect(requestAPI.submit({})).rejects.toThrow('Invalid request data');
    });

    it('should handle requestAPI.getResult failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Result not found' }),
      });

      await expect(requestAPI.getResult(999)).rejects.toThrow('Result not found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle fetch timeout error', async () => {
      global.fetch.mockRejectedValue(new Error('Request timeout'));

      await expect(apiRequest('/test')).rejects.toThrow('Request timeout');
    });

    it('should handle response without json method', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: undefined,
      });

      await expect(apiRequest('/test')).rejects.toThrow();
    });

    it('should handle empty response body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      });

      const result = await apiRequest('/test');
      expect(result).toBeNull();
    });
  });
});