import { loginSchema, querySubmissionSchema, rejectReasonSchema } from '../../src/utils/validation';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = { email: 'test@example.com', password: 'password123' };
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = { email: 'invalid-email', password: 'password123' };
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const invalidData = { email: 'test@example.com', password: '' };
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      expect(loginSchema.safeParse({ email: 'test@example.com' }).success).toBe(false);
      expect(loginSchema.safeParse({ password: 'pass' }).success).toBe(false);
    });
  });

  describe('querySubmissionSchema', () => {
    const validQueryData = {
      dbType: 'POSTGRES',
      instanceId: '1',
      databaseName: 'test_db',
      requestType: 'query',
      query: 'SELECT * FROM users',
      comments: 'Test query',
      podId: 'pod-1',
    };

    it('should validate correct query submission', () => {
      const result = querySubmissionSchema.safeParse(validQueryData);
      expect(result.success).toBe(true);
    });

    it('should validate correct script submission', () => {
      const validScriptData = {
        dbType: 'MONGO',
        instanceId: '2',
        databaseName: 'test_db',
        requestType: 'script',
        script: 'script.js',
        comments: 'Test script',
        podId: 'db',
      };
      const result = querySubmissionSchema.safeParse(validScriptData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid dbType', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, dbType: 'MYSQL' });
      expect(result.success).toBe(false);
    });

    it('should reject empty instanceId', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, instanceId: '' });
      expect(result.success).toBe(false);
    });

    it('should reject empty databaseName', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, databaseName: '' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid requestType', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, requestType: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject empty comments', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, comments: '' });
      expect(result.success).toBe(false);
    });

    it('should reject empty podId', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, podId: '' });
      expect(result.success).toBe(false);
    });

    it('should reject query request without query text', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, query: '' });
      expect(result.success).toBe(false);
    });

    it('should reject query request with whitespace-only query', () => {
      const result = querySubmissionSchema.safeParse({ ...validQueryData, query: '   ' });
      expect(result.success).toBe(false);
    });

    it('should accept script request without query text', () => {
      const scriptData = { ...validQueryData, requestType: 'script', query: undefined };
      const result = querySubmissionSchema.safeParse(scriptData);
      expect(result.success).toBe(true);
    });
  });

  describe('rejectReasonSchema', () => {
    it('should validate correct rejection reason', () => {
      const result = rejectReasonSchema.safeParse({ reason: 'Query is too risky' });
      expect(result.success).toBe(true);
    });

    it('should reject empty reason', () => {
      const result = rejectReasonSchema.safeParse({ reason: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing reason field', () => {
      const result = rejectReasonSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
