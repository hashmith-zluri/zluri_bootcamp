import {
  ROLES,
  API_BASE_URL,
  ROLE_ACCESS,
  STATUS_COLORS,
  PODS,
  DB_TYPES,
  REQUEST_TYPES,
} from '../../src/utils/constants';

// Set test environment
process.env.NODE_ENV = 'test';

describe('Constants', () => {
  describe('ROLES', () => {
    it('should have correct role definitions', () => {
      expect(ROLES.DEVELOPER).toBe('DEVELOPER');
      expect(ROLES.MANAGER).toBe('MANAGER');
      expect(ROLES.ADMIN).toBe('ADMIN');
    });

    it('should have all required roles', () => {
      expect(Object.keys(ROLES)).toHaveLength(3);
    });
  });

  describe('API_BASE_URL', () => {
    it('should have correct API base URL fallback', () => {
      // Since this uses environment variables, we test the fallback value
      expect(API_BASE_URL).toBe('https://zluribootcamp-production.up.railway.app/api/v1');
    });

    it('should be a string', () => {
      expect(typeof API_BASE_URL).toBe('string');
    });

    it('should contain api/v1 path', () => {
      expect(API_BASE_URL).toContain('/api/v1');
    });
  });

  describe('ROLE_ACCESS', () => {
    it('should define access for DEVELOPER role', () => {
      expect(ROLE_ACCESS.DEVELOPER).toEqual(['/submit', '/my-submissions']);
    });

    it('should define access for MANAGER role', () => {
      expect(ROLE_ACCESS.MANAGER).toEqual(['/submit', '/my-submissions', '/approvals']);
    });

    it('should define access for ADMIN role', () => {
      expect(ROLE_ACCESS.ADMIN).toEqual(['/submit', '/my-submissions', '/approvals', '/admin']);
    });
  });

  describe('STATUS_COLORS', () => {
    it('should have color for all statuses', () => {
      expect(STATUS_COLORS.PENDING).toBe('bg-yellow-100 text-yellow-800');
      expect(STATUS_COLORS.APPROVED).toBe('bg-blue-100 text-blue-800');
      expect(STATUS_COLORS.REJECTED).toBe('bg-red-100 text-red-800');
      expect(STATUS_COLORS.EXECUTING).toBe('bg-purple-100 text-purple-800');
      expect(STATUS_COLORS.EXECUTED).toBe('bg-green-100 text-green-800');
      expect(STATUS_COLORS.FAILED).toBe('bg-red-100 text-red-800');
    });
  });

  describe('PODS', () => {
    it('should have correct POD definitions', () => {
      expect(PODS).toHaveLength(3);
      expect(PODS[0]).toEqual({ id: 'pod-1', name: 'Pod 1', manager_email: 'manager1@zluri.com' });
    });
  });

  describe('DB_TYPES', () => {
    it('should have correct database types', () => {
      expect(DB_TYPES).toEqual(['POSTGRES', 'MONGO']);
    });
  });

  describe('REQUEST_TYPES', () => {
    it('should have correct request types', () => {
      expect(REQUEST_TYPES).toHaveLength(2);
      expect(REQUEST_TYPES[0]).toEqual({ value: 'query', label: 'Query' });
      expect(REQUEST_TYPES[1]).toEqual({ value: 'script', label: 'Script' });
    });
  });
});
