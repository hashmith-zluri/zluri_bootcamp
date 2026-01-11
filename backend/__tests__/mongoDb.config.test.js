const { parseMongoQuery, validateMongoQuery } = require('../src/config/mongoDb');

describe('MongoDB Config', () => {
  describe('parseMongoQuery', () => {
    it('should parse find query', () => {
      const result = parseMongoQuery('db.users.find({})');
      
      expect(result.operation).toBe('find');
      expect(result.collection).toBe('users');
      expect(result.filter).toEqual({});
    });

    it('should parse find query with filter', () => {
      const result = parseMongoQuery('db.users.find({"status": "active"})');
      
      expect(result.operation).toBe('find');
      expect(result.collection).toBe('users');
      expect(result.filter).toEqual({ status: 'active' });
    });

    it('should parse find query with filter and projection', () => {
      const result = parseMongoQuery('db.users.find({"status": "active"}, {"name": 1, "email": 1})');
      
      expect(result.operation).toBe('find');
      expect(result.filter).toEqual({ status: 'active' });
      expect(result.projection).toEqual({ name: 1, email: 1 });
    });

    it('should parse findOne query', () => {
      const result = parseMongoQuery('db.users.findOne({"_id": "123"})');
      
      expect(result.operation).toBe('findOne');
      expect(result.collection).toBe('users');
      expect(result.filter).toEqual({ _id: '123' });
    });

    it('should parse count query', () => {
      const result = parseMongoQuery('db.users.count({"status": "active"})');
      
      expect(result.operation).toBe('count');
      expect(result.filter).toEqual({ status: 'active' });
    });

    it('should parse countDocuments query', () => {
      const result = parseMongoQuery('db.users.countDocuments({})');
      
      expect(result.operation).toBe('count');
      expect(result.filter).toEqual({});
    });

    it('should parse aggregate query', () => {
      const pipeline = '[{"$match": {"status": "active"}}, {"$group": {"_id": "$role", "count": {"$sum": 1}}}]';
      const result = parseMongoQuery(`db.users.aggregate(${pipeline})`);
      
      expect(result.operation).toBe('aggregate');
      expect(result.collection).toBe('users');
      expect(result.pipeline).toHaveLength(2);
    });

    it('should parse insertOne query', () => {
      const result = parseMongoQuery('db.users.insertOne({"name": "John", "email": "john@test.com"})');
      
      expect(result.operation).toBe('insertOne');
      expect(result.collection).toBe('users');
      expect(result.document).toEqual({ name: 'John', email: 'john@test.com' });
    });

    it('should parse insertMany query', () => {
      const result = parseMongoQuery('db.users.insertMany([{"name": "John"}, {"name": "Jane"}])');
      
      expect(result.operation).toBe('insertMany');
      expect(result.documents).toHaveLength(2);
    });

    it('should parse updateOne query', () => {
      const result = parseMongoQuery('db.users.updateOne({"_id": "123"}, {"$set": {"name": "Updated"}})');
      
      expect(result.operation).toBe('updateOne');
      expect(result.filter).toEqual({ _id: '123' });
      expect(result.update).toEqual({ $set: { name: 'Updated' } });
    });

    it('should parse updateMany query', () => {
      const result = parseMongoQuery('db.users.updateMany({"status": "inactive"}, {"$set": {"archived": true}})');
      
      expect(result.operation).toBe('updateMany');
      expect(result.filter).toEqual({ status: 'inactive' });
      expect(result.update).toEqual({ $set: { archived: true } });
    });

    it('should parse deleteOne query', () => {
      const result = parseMongoQuery('db.users.deleteOne({"_id": "123"})');
      
      expect(result.operation).toBe('deleteOne');
      expect(result.filter).toEqual({ _id: '123' });
    });

    it('should parse deleteMany query', () => {
      const result = parseMongoQuery('db.users.deleteMany({"status": "deleted"})');
      
      expect(result.operation).toBe('deleteMany');
      expect(result.filter).toEqual({ status: 'deleted' });
    });

    it('should parse drop query', () => {
      const result = parseMongoQuery('db.temp_collection.drop()');
      
      expect(result.operation).toBe('drop');
      expect(result.collection).toBe('temp_collection');
    });

    it('should handle query with trailing semicolon', () => {
      const result = parseMongoQuery('db.users.find({});');
      
      expect(result.operation).toBe('find');
      expect(result.collection).toBe('users');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseMongoQuery('SELECT * FROM users')).toThrow('Invalid MongoDB shell format');
      expect(() => parseMongoQuery('users.find({})')).toThrow('Invalid MongoDB shell format');
      expect(() => parseMongoQuery('db.find({})')).toThrow('Invalid MongoDB shell format');
    });
  });

  describe('validateMongoQuery', () => {
    it('should validate correct query', () => {
      expect(() => validateMongoQuery('db.users.find({})')).not.toThrow();
    });

    it('should allow all operations', () => {
      expect(() => validateMongoQuery('db.users.insertOne({"name": "test"})')).not.toThrow();
      expect(() => validateMongoQuery('db.users.deleteMany({})')).not.toThrow();
      expect(() => validateMongoQuery('db.users.updateOne({}, {"$set": {}})')).not.toThrow();
      expect(() => validateMongoQuery('db.temp.drop()')).not.toThrow();
    });

    it('should reject invalid collection names', () => {
      // Collection names starting with numbers fail regex pattern matching
      expect(() => validateMongoQuery('db.123invalid.find({})')).toThrow();
      // Collection names with hyphens fail regex pattern matching
      expect(() => validateMongoQuery('db.my-collection.find({})')).toThrow();
    });

    it('should accept valid collection names', () => {
      expect(() => validateMongoQuery('db.users.find({})')).not.toThrow();
      expect(() => validateMongoQuery('db.user_data.find({})')).not.toThrow();
      expect(() => validateMongoQuery('db._private.find({})')).not.toThrow();
      expect(() => validateMongoQuery('db.Users123.find({})')).not.toThrow();
    });
  });
});
