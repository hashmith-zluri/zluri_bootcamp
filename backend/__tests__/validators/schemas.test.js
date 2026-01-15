const {
  loginSchema,
  submitRequestSchema,
  approvalActionSchema,
  paginationSchema,
  reqIdParamSchema,
  dbTypeSchema
} = require('../../src/validators/schemas');

describe('Zod Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Invalid email format');
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: ''
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Password is required');
    });
  });

  describe('submitRequestSchema', () => {
    it('should validate valid request data', () => {
      const result = submitRequestSchema.safeParse({
        instance_id: 1,
        db_name: 'test_db',
        query: 'SELECT * FROM users',
        comments: 'Test query',
        pod_id: 1
      });
      expect(result.success).toBe(true);
      expect(result.data.pod_id).toBe('1'); // transformed to string
    });

    it('should transform string pod_id to string', () => {
      const result = submitRequestSchema.safeParse({
        instance_id: 1,
        db_name: 'test_db',
        comments: 'Test',
        pod_id: 'pod-1'
      });
      expect(result.success).toBe(true);
      expect(result.data.pod_id).toBe('pod-1');
    });

    it('should transform number pod_id to string', () => {
      const result = submitRequestSchema.safeParse({
        instance_id: 1,
        db_name: 'test_db',
        comments: 'Test',
        pod_id: 123
      });
      expect(result.success).toBe(true);
      expect(result.data.pod_id).toBe('123');
    });

    it('should reject missing instance_id', () => {
      const result = submitRequestSchema.safeParse({
        db_name: 'test_db',
        comments: 'Test',
        pod_id: 1
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty db_name', () => {
      const result = submitRequestSchema.safeParse({
        instance_id: 1,
        db_name: '',
        comments: 'Test',
        pod_id: 1
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('db_name is required');
    });

    it('should reject empty comments', () => {
      const result = submitRequestSchema.safeParse({
        instance_id: 1,
        db_name: 'test_db',
        comments: '',
        pod_id: 1
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('comments is required');
    });
  });

  describe('approvalActionSchema', () => {
    it('should validate approve action', () => {
      const result = approvalActionSchema.safeParse({ action: 'approve' });
      expect(result.success).toBe(true);
    });

    it('should validate reject action with reason', () => {
      const result = approvalActionSchema.safeParse({
        action: 'reject',
        reason: 'Security concerns'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid action', () => {
      const result = approvalActionSchema.safeParse({ action: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Invalid action. Must be "approve" or "reject"');
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination params', () => {
      const result = paginationSchema.safeParse({
        limit: '10',
        offset: '5'
      });
      expect(result.success).toBe(true);
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    });

    it('should handle missing optional params', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data.limit).toBeNull();
      expect(result.data.offset).toBeNull();
    });

    it('should reject negative limit', () => {
      const result = paginationSchema.safeParse({ limit: '-5' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Limit must be +ve integer.');
    });

    it('should reject negative offset', () => {
      const result = paginationSchema.safeParse({ offset: '-10' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Offset must be +ve integer.');
    });

    it('should reject decimal limit', () => {
      const result = paginationSchema.safeParse({ limit: '1.5' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Limit must be +ve integer.');
    });

    it('should reject decimal offset', () => {
      const result = paginationSchema.safeParse({ offset: '0.5' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Offset must be +ve integer.');
    });

    it('should reject zero limit', () => {
      const result = paginationSchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Limit must be +ve integer.');
    });

    it('should validate status enum', () => {
      const result = paginationSchema.safeParse({ status: 'PENDING' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = paginationSchema.safeParse({ status: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should validate sortBy enum', () => {
      const result = paginationSchema.safeParse({ sortBy: 'created_at' });
      expect(result.success).toBe(true);
    });
  });

  describe('reqIdParamSchema', () => {
    it('should validate valid request ID', () => {
      const result = reqIdParamSchema.safeParse({ req_id: '123' });
      expect(result.success).toBe(true);
      expect(result.data.req_id).toBe(123);
    });

    it('should reject invalid request ID (non-numeric)', () => {
      const result = reqIdParamSchema.safeParse({ req_id: 'abc' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Invalid request ID');
    });

    it('should reject zero request ID', () => {
      const result = reqIdParamSchema.safeParse({ req_id: '0' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Invalid request ID');
    });

    it('should reject negative request ID', () => {
      const result = reqIdParamSchema.safeParse({ req_id: '-1' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Invalid request ID');
    });
  });

  describe('dbTypeSchema', () => {
    it('should validate POSTGRES type', () => {
      const result = dbTypeSchema.safeParse({ type: 'POSTGRES' });
      expect(result.success).toBe(true);
      expect(result.data.type).toBe('POSTGRES');
    });

    it('should validate MONGO type', () => {
      const result = dbTypeSchema.safeParse({ type: 'MONGO' });
      expect(result.success).toBe(true);
      expect(result.data.type).toBe('MONGO');
    });

    it('should reject invalid database type', () => {
      const result = dbTypeSchema.safeParse({ type: 'MONGO111' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Database type not found. Valid types: POSTGRES, MONGO');
    });

    it('should reject missing type', () => {
      const result = dbTypeSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
