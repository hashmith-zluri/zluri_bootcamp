const { submitRequestSchema } = require('../../src/validators/schemas');

describe('MongoDB Script Validation', () => {
  const baseValidData = {
    instance_id: 1,
    db_name: 'testdb',
    comments: 'Test comment',
    pod_id: 'pod1'
  };

  describe('Valid MongoDB operations', () => {
    test('should allow single find operation', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.find({})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should allow single insert operation', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.insertOne({name: "John", email: "john@example.com"})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should allow single update operation', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.updateOne({_id: ObjectId("507f1f77bcf86cd799439011")}, {$set: {status: "active"}})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should allow single delete operation', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.deleteOne({_id: ObjectId("507f1f77bcf86cd799439011")})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should allow single aggregate operation', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.aggregate([{$match: {status: "active"}}, {$group: {_id: "$department", count: {$sum: 1}}}])'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should allow operation with comments', () => {
      const data = {
        ...baseValidData,
        script: `// Find all active users
        db.users.find({status: "active"})`
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should allow operation with multi-line comments', () => {
      const data = {
        ...baseValidData,
        script: `/* 
         * Find all users with active status
         * and return only name and email fields
         */
        db.users.find({status: "active"}, {name: 1, email: 1})`
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid MongoDB operations (multiple operations)', () => {
    test('should reject multiple operations separated by semicolons', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.find({}); db.orders.find({})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });

    test('should reject multiple operations on separate lines', () => {
      const data = {
        ...baseValidData,
        script: `db.users.find({})
        db.orders.find({})`
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });

    test('should reject multiple database switches', () => {
      const data = {
        ...baseValidData,
        script: 'use("database1"); use("database2")'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });

    test('should reject chained operations', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.find({}); db.users.updateMany({}, {$set: {updated: true}})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });

    test('should reject multiple drop operations', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.drop(); db.orders.drop()'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });

    test('should reject eval with multiple operations', () => {
      const data = {
        ...baseValidData,
        script: 'eval("db.users.find({}); db.orders.find({})")'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });

    test('should reject multiple show commands', () => {
      const data = {
        ...baseValidData,
        script: 'show collections; show users'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });

    test('should reject operations with suspicious patterns', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.find({}) db.orders.find({})'  // Missing semicolon but still multiple operations
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Only single MongoDB operations are allowed');
    });
  });

  describe('Edge cases', () => {
    test('should allow empty script (handled by other validations)', () => {
      const data = {
        ...baseValidData,
        script: ''
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true); // MongoDB validation passes, other validations may fail
    });

    test('should allow script with only comments', () => {
      const data = {
        ...baseValidData,
        script: '// This is just a comment'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should handle semicolons inside strings correctly', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.find({description: "This; has; semicolons"})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('should handle complex query with nested objects', () => {
      const data = {
        ...baseValidData,
        script: 'db.users.find({$and: [{status: "active"}, {$or: [{age: {$gte: 18}}, {verified: true}]}]})'
      };
      
      const result = submitRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});