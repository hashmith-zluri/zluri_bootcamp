const { submitRequestSchema } = require('../../src/validators/schemas');

describe('Multiple Query Validation', () => {
  describe('Single Query Validation', () => {
    it('should accept valid single SELECT query', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: 'SELECT * FROM users WHERE id = 1;',
        comments: 'Test query',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept query without semicolon', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: 'SELECT * FROM users WHERE id = 1',
        comments: 'Test query',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept query with comments', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: `-- Get user by ID
                SELECT * FROM users WHERE id = 1;`,
        comments: 'Test query with comments',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept query with multi-line comments', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: `/* 
                 * Get user by ID
                 * This is a test query
                 */
                SELECT * FROM users WHERE id = 1;`,
        comments: 'Test query with multi-line comments',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Multiple Query Rejection', () => {
    it('should reject multiple SELECT queries', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test_db',
        query: 'SELECT * FROM users; SELECT * FROM orders;',
        comments: 'Multiple queries',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject query with semicolon followed by another statement', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test_db',
        query: 'SELECT * FROM users; DROP TABLE users;',
        comments: 'Malicious query',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject UNION injection attempts', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test_db',
        query: "SELECT * FROM users WHERE id = 1 UNION SELECT password FROM admin_users",
        comments: 'UNION injection attempt',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject query with semicolon and comment injection', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test_db',
        query: "SELECT * FROM users; -- DROP TABLE users;",
        comments: 'Comment injection attempt',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject query with semicolon and block comment injection', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test_db',
        query: "SELECT * FROM users; /* DROP TABLE users; */",
        comments: 'Block comment injection attempt',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject multiple statements with different operations', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test_db',
        query: 'INSERT INTO users (name) VALUES ("test"); SELECT * FROM users;',
        comments: 'Multiple different operations',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject complex injection with multiple techniques', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test_db',
        query: "SELECT * FROM users WHERE id = 1; DELETE FROM users WHERE 1=1; -- evil",
        comments: 'Complex injection attempt',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: '',
        comments: 'Empty query',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true); // Empty query is handled by other validations
    });

    it('should handle query with only whitespace', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: '   \n\t   ',
        comments: 'Whitespace query',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true); // Whitespace-only query is handled by other validations
    });

    it('should handle query with semicolon but no second statement', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: 'SELECT * FROM users WHERE name LIKE "test;test";',
        comments: 'Semicolon in string literal',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle query with trailing semicolon and whitespace', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: 'SELECT * FROM users;   \n\t  ',
        comments: 'Trailing semicolon with whitespace',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle complex string literals with semicolons', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: `SELECT * FROM users WHERE description = 'This is a test; with semicolon' AND name = "Another; test"`,
        comments: 'Complex string literals with semicolons',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle escaped quotes in string literals', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test_db',
        query: `SELECT * FROM users WHERE name = 'O\\'Brien; test' AND description = "He said \\"Hello; World\\""`,
        comments: 'Escaped quotes in string literals',
        pod_id: 'pod-1'
      };

      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Security Pattern Detection', () => {
    it('should detect suspicious semicolon patterns', () => {
      const testCases = [
        'SELECT * FROM users; SELECT',
        'SELECT * FROM users; INSERT',
        'SELECT * FROM users; UPDATE',
        'SELECT * FROM users; DELETE',
        'SELECT * FROM users; DROP',
        'SELECT * FROM users; CREATE',
        'SELECT * FROM users; ALTER',
        'SELECT * FROM users; TRUNCATE'
      ];

      testCases.forEach(query => {
        const invalidData = {
          instance_id: 1,
          db_name: 'test_db',
          query,
          comments: 'Suspicious pattern test',
          pod_id: 'pod-1'
        };

        const result = submitRequestSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toContain('Only single statements are allowed');
      });
    });
  });

  describe('MongoDB Multiple Operations Validation', () => {
    it('should reject multiple MongoDB operations separated by semicolon', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test',
        query: 'db.users.find(); db.products.find()',
        comments: 'Test comment',
        pod_id: 'pod-1'
      };
      
      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject multiple MongoDB operations with different spacing', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test',
        query: 'db.users.find();\ndb.products.insertOne({name: "test"})',
        comments: 'Test comment',
        pod_id: 'pod-1'
      };
      
      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should accept single MongoDB operation', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test',
        query: 'db.users.find({status: "active"})',
        comments: 'Test comment',
        pod_id: 'pod-1'
      };
      
      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept MongoDB operation with semicolon in string', () => {
      const validData = {
        instance_id: 1,
        db_name: 'test',
        query: 'db.users.find({description: "This; has; semicolons"})',
        comments: 'Test comment',
        pod_id: 'pod-1'
      };
      
      const result = submitRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject MongoDB operations with suspicious patterns', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test',
        query: 'db.users.find(); db.users.drop()',
        comments: 'Test comment',
        pod_id: 'pod-1'
      };
      
      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });

    it('should reject multiple MongoDB operations without semicolon', () => {
      const invalidData = {
        instance_id: 1,
        db_name: 'test',
        query: 'db.users.find() db.products.find()',
        comments: 'Test comment',
        pod_id: 'pod-1'
      };
      
      const result = submitRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single statements are allowed');
    });
  });
});