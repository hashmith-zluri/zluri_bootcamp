import { querySubmissionSchema } from '../../src/utils/validation';

describe('Validation - Additional Coverage', () => {
  describe('querySubmissionSchema edge cases', () => {
    it('should validate minimum values correctly', () => {
      const validData = {
        dbType: 'POSTGRES',
        instanceId: '1',
        databaseName: 'a', // minimum length
        requestType: 'query',
        query: 'SELECT 1;', // minimum length
        script: '',
        comments: 'a', // minimum length
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty database name', () => {
      const invalidData = {
        dbType: 'POSTGRES',
        instanceId: '1',
        databaseName: '', // empty
        requestType: 'query',
        query: 'SELECT * FROM users;',
        script: '',
        comments: 'Test comment',
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain('databaseName');
    });

    it('should reject empty comments', () => {
      const invalidData = {
        dbType: 'POSTGRES',
        instanceId: '1',
        databaseName: 'testdb',
        requestType: 'query',
        query: 'SELECT * FROM users;',
        script: '',
        comments: '', // empty
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain('comments');
    });

    it('should reject very long query', () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'a'.repeat(10000); // > 10000 chars
      
      const invalidData = {
        dbType: 'POSTGRES',
        instanceId: '1',
        databaseName: 'testdb',
        requestType: 'query',
        query: longQuery,
        script: '',
        comments: 'Test comment',
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain('query');
    });

    it('should reject very long comments', () => {
      const longComments = 'a'.repeat(1001); // > 1000 chars
      
      const invalidData = {
        dbType: 'POSTGRES',
        instanceId: '1',
        databaseName: 'testdb',
        requestType: 'query',
        query: 'SELECT * FROM users;',
        script: '',
        comments: longComments,
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(validData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain('comments');
    });

    it('should validate script request type', () => {
      const validData = {
        dbType: 'MONGO',
        instanceId: '2',
        databaseName: 'mongodb',
        requestType: 'script',
        query: '',
        script: 'console.log("test");',
        comments: 'Script test',
        podId: 'pod-2'
      };

      const result = querySubmissionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid database type', () => {
      const invalidData = {
        dbType: 'INVALID_DB', // not in enum
        instanceId: '1',
        databaseName: 'testdb',
        requestType: 'query',
        query: 'SELECT * FROM users;',
        script: '',
        comments: 'Test comment',
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain('dbType');
    });

    it('should reject invalid request type', () => {
      const invalidData = {
        dbType: 'POSTGRES',
        instanceId: '1',
        databaseName: 'testdb',
        requestType: 'invalid', // not in enum
        query: 'SELECT * FROM users;',
        script: '',
        comments: 'Test comment',
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain('requestType');
    });

    it('should handle numeric instanceId as string', () => {
      const validData = {
        dbType: 'POSTGRES',
        instanceId: 123, // number instead of string
        databaseName: 'testdb',
        requestType: 'query',
        query: 'SELECT * FROM users;',
        script: '',
        comments: 'Test comment',
        podId: 'pod-1'
      };

      const result = querySubmissionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data.instanceId).toBe('123'); // should be converted to string
    });

    it('should trim whitespace from string fields', () => {
      const dataWithWhitespace = {
        dbType: 'POSTGRES',
        instanceId: '  1  ',
        databaseName: '  testdb  ',
        requestType: 'query',
        query: '  SELECT * FROM users;  ',
        script: '',
        comments: '  Test comment  ',
        podId: '  pod-1  '
      };

      const result = querySubmissionSchema.safeParse(dataWithWhitespace);
      expect(result.success).toBe(true);
      expect(result.data.instanceId).toBe('1');
      expect(result.data.databaseName).toBe('testdb');
      expect(result.data.query).toBe('SELECT * FROM users;');
      expect(result.data.comments).toBe('Test comment');
      expect(result.data.podId).toBe('pod-1');
    });
  });
});