import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../../src/hooks/useAuth';

describe('useAuth', () => {
  let localStorageMock;
  let originalLocation;

  beforeAll(() => {
    // Save original location
    originalLocation = window.location;
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

  describe('when user is not authenticated', () => {
    it('should return null user and token', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.role).toBeUndefined();
    });
  });

  describe('when user is authenticated', () => {
    it('should return user and token', () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'DEVELOPER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('test-token');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.role).toBe('DEVELOPER');
    });

    it('should return MANAGER role', () => {
      const mockUser = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.role).toBe('MANAGER');
    });

    it('should return ADMIN role', () => {
      const mockUser = { id: 3, email: 'admin@example.com', role: 'ADMIN' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.role).toBe('ADMIN');
    });
  });

  describe('logout', () => {
    it('should clear localStorage and redirect to login', () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'DEVELOPER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      act(() => {
        result.current.logout();
      });
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('canAccess', () => {
    it('should return false when user has no role', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/submit')).toBe(false);
    });

    it('should return false when user is null', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/approvals')).toBe(false);
    });

    it('should allow DEVELOPER to access /submit', () => {
      const mockUser = { id: 1, email: 'dev@example.com', role: 'DEVELOPER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/submit')).toBe(true);
    });

    it('should allow DEVELOPER to access /my-submissions', () => {
      const mockUser = { id: 1, email: 'dev@example.com', role: 'DEVELOPER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/my-submissions')).toBe(true);
    });

    it('should not allow DEVELOPER to access /approvals', () => {
      const mockUser = { id: 1, email: 'dev@example.com', role: 'DEVELOPER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/approvals')).toBe(false);
    });

    it('should allow MANAGER to access /approvals', () => {
      const mockUser = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/approvals')).toBe(true);
    });

    it('should allow MANAGER to access /submit', () => {
      const mockUser = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/submit')).toBe(true);
    });

    it('should not allow MANAGER to access /admin', () => {
      const mockUser = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/admin')).toBe(false);
    });

    it('should allow ADMIN to access all paths', () => {
      const mockUser = { id: 3, email: 'admin@example.com', role: 'ADMIN' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/submit')).toBe(true);
      expect(result.current.canAccess('/my-submissions')).toBe(true);
      expect(result.current.canAccess('/approvals')).toBe(true);
      expect(result.current.canAccess('/admin')).toBe(true);
    });

    it('should handle paths with additional segments', () => {
      const mockUser = { id: 1, email: 'dev@example.com', role: 'DEVELOPER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/submit/new')).toBe(true);
      expect(result.current.canAccess('/my-submissions/123')).toBe(true);
    });

    it('should return false for unknown role', () => {
      const mockUser = { id: 4, email: 'unknown@example.com', role: 'UNKNOWN' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.canAccess('/submit')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle user without token', () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'DEVELOPER' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return JSON.stringify(mockUser);
        if (key === 'token') return null;
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle token without user', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'user') return null;
        if (key === 'token') return 'test-token';
        return null;
      });
      
      const { result } = renderHook(() => useAuth());
      
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
