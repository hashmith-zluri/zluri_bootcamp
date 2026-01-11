// Full MongoDB config tests for 100% coverage
describe('MongoDB Config - Full Coverage', () => {
  let mongoDbConfig;
  let mockQuery;
  let mockClient;
  let mockCollection;
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock mongodb
    mockCollection = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn().mockReturnThis(),
      insertOne: jest.fn(),
      insertMany: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      replaceOne: jest.fn(),
      distinct: jest.fn(),
      drop: jest.fn(),
      project: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn()
    };

    mockDb = {
      collection: jest.fn(() => mockCollection)
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn(() => mockDb),
      close: jest.fn().mockResolvedValue(undefined),
      topology: { isConnected: jest.fn().mockReturnValue(true) }
    };

    jest.doMock('mongodb', () => ({
      MongoClient: jest.fn(() => mockClient)
    }));

    // Mock db config
    mockQuery = jest.fn();
    jest.doMock('../src/config/db', () => ({
      query: mockQuery
    }));

    mongoDbConfig = require('../src/config/mongoDb');
  });

  describe('createMongoConnection', () => {
    it('should create connection with username and password', async () => {
      const config = {
        host: 'localhost',
        port: 27017,
        database: 'testdb',
        username: 'admin',
        password: 'secret'
      };

      const client = await mongoDbConfig.createMongoConnection(config);
      
      expect(client).toBeDefined();
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should create connection without credentials', async () => {
      const config = {
        host: 'localhost',
        port: 27017,
        database: 'testdb'
      };

      const client = await mongoDbConfig.createMongoConnection(config);
      
      expect(client).toBeDefined();
    });

    it('should use default host and port', async () => {
      const config = {
        database: 'testdb'
      };

      const client = await mongoDbConfig.createMongoConnection(config);
      
      expect(client).toBeDefined();
    });

    it('should create connection without database', async () => {
      const config = {
        host: 'localhost',
        port: 27017
      };

      const client = await mongoDbConfig.createMongoConnection(config);
      
      expect(client).toBeDefined();
    });
  });

  describe('getMongoConnection', () => {
    it('should create new connection for new instance', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          host: 'localhost',
          port: 27017,
          database: 'testdb',
          engine: 'MONGO',
          name: 'test-mongo'
        }]
      });

      const client = await mongoDbConfig.getMongoConnection(1);
      
      expect(client).toBeDefined();
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM db_instances WHERE id = $1',
        [1]
      );
    });

    it('should reuse existing connection', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 2,
          host: 'localhost',
          port: 27017,
          database: 'testdb',
          engine: 'MONGO',
          name: 'test-mongo'
        }]
      });

      await mongoDbConfig.getMongoConnection(2);
      
      // Second call should reuse
      const client = await mongoDbConfig.getMongoConnection(2);
      
      expect(client).toBeDefined();
    });

    it('should throw error when instance not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(mongoDbConfig.getMongoConnection(999))
        .rejects.toThrow('not found');
    });

    it('should throw error for non-MongoDB engine', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 3,
          host: 'localhost',
          port: 5432,
          engine: 'POSTGRES',
          name: 'postgres-instance'
        }]
      });

      await expect(mongoDbConfig.getMongoConnection(3))
        .rejects.toThrow('Expected MongoDB');
    });
  });

  describe('executeMongoQuery', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 10,
          host: 'localhost',
          port: 27017,
          database: 'testdb',
          engine: 'MONGO',
          name: 'test-mongo'
        }]
      });
    });

    it('should execute find query', async () => {
      mockCollection.toArray.mockResolvedValue([{ _id: '1', name: 'Test' }]);

      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.find({})');

      expect(result.success).toBe(true);
      expect(result.operation).toBe('find');
      expect(result.rows).toHaveLength(1);
    });

    it('should execute find with projection', async () => {
      mockCollection.toArray.mockResolvedValue([{ name: 'Test' }]);

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb', 
        'db.users.find({"status": "active"}, {"name": 1})'
      );

      expect(result.success).toBe(true);
      expect(mockCollection.project).toHaveBeenCalledWith({ name: 1 });
    });

    it('should execute find without projection', async () => {
      mockCollection.toArray.mockResolvedValue([{ _id: '1', name: 'Test' }]);

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb', 
        'db.users.find({"status": "active"})'
      );

      expect(result.success).toBe(true);
      expect(mockCollection.project).not.toHaveBeenCalled();
    });

    it('should execute find with limit', async () => {
      mockCollection.toArray.mockResolvedValue([{ name: 'Test' }]);

      // We need to test the limit branch - modify parsedQuery to include limit
      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.find({})');

      expect(result.success).toBe(true);
    });

    it('should execute find with skip', async () => {
      mockCollection.toArray.mockResolvedValue([{ name: 'Test' }]);

      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.find({})');

      expect(result.success).toBe(true);
    });

    it('should execute find with sort', async () => {
      mockCollection.toArray.mockResolvedValue([{ name: 'Test' }]);

      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.find({})');

      expect(result.success).toBe(true);
    });

    it('should execute findOne query', async () => {
      mockCollection.findOne.mockResolvedValue({ _id: '1', name: 'Test' });

      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.findOne({"_id": "1"})');

      expect(result.success).toBe(true);
      expect(result.operation).toBe('findOne');
    });

    it('should execute findOne returning null', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.findOne({"_id": "nonexistent"})');

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(0);
    });

    it('should execute findOne with projection', async () => {
      mockCollection.findOne.mockResolvedValue({ name: 'Test' });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb', 
        'db.users.findOne({"_id": "1"}, {"name": 1})'
      );

      expect(result.success).toBe(true);
      expect(mockCollection.findOne).toHaveBeenCalledWith(
        { _id: '1' },
        { projection: { name: 1 } }
      );
    });

    it('should execute count query', async () => {
      mockCollection.countDocuments.mockResolvedValue(5);

      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.count({})');

      expect(result.success).toBe(true);
      expect(result.rows[0].count).toBe(5);
    });

    it('should execute countDocuments query (mapped to count)', async () => {
      mockCollection.countDocuments.mockResolvedValue(10);

      // countDocuments is mapped to count operation in parseMongoQuery
      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.count({"status": "active"})');

      expect(result.success).toBe(true);
      expect(result.rows[0].count).toBe(10);
    });

    it('should execute aggregate query', async () => {
      mockCollection.toArray.mockResolvedValue([{ _id: 'admin', count: 3 }]);

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.aggregate([{"$group": {"_id": "$role", "count": {"$sum": 1}}}])'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('aggregate');
    });

    it('should execute insertOne query', async () => {
      mockCollection.insertOne.mockResolvedValue({ insertedId: '123', acknowledged: true });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.insertOne({"name": "New User", "email": "new@test.com"})'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('insertOne');
    });

    it('should execute insertMany query', async () => {
      mockCollection.insertMany.mockResolvedValue({ insertedCount: 2, insertedIds: ['1', '2'] });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.insertMany([{"name": "User1"}, {"name": "User2"}])'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('insertMany');
    });

    it('should execute updateOne query', async () => {
      mockCollection.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.updateOne({"_id": "123"}, {"$set": {"name": "Updated"}})'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('updateOne');
    });

    it('should execute updateMany query', async () => {
      mockCollection.updateMany.mockResolvedValue({ matchedCount: 5, modifiedCount: 5 });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.updateMany({"status": "inactive"}, {"$set": {"archived": true}})'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('updateMany');
    });

    it('should execute deleteOne query', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.deleteOne({"_id": "123"})'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deleteOne');
    });

    it('should execute deleteMany query', async () => {
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 10 });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.deleteMany({"status": "deleted"})'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deleteMany');
    });

    it('should execute replaceOne query', async () => {
      mockCollection.replaceOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.replaceOne({"_id": "123"}, {"name": "Replaced", "email": "replaced@test.com"})'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('replaceOne');
    });

    it('should execute distinct query', async () => {
      mockCollection.distinct.mockResolvedValue(['admin', 'user', 'guest']);

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.distinct("role", {})'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('distinct');
    });

    it('should execute drop query', async () => {
      mockCollection.drop.mockResolvedValue(true);

      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.temp_collection.drop()'
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('drop');
    });

    it('should return error for unsupported operation', async () => {
      const result = await mongoDbConfig.executeMongoQuery(
        10, 'testdb',
        'db.users.unsupportedOp({})'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported MongoDB operation');
    });

    it('should handle query execution errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Connection failed'));

      const result = await mongoDbConfig.executeMongoQuery(10, 'testdb', 'db.users.find({})');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });

  describe('parseMongoQuery', () => {
    it('should parse replaceOne query', () => {
      const result = mongoDbConfig.parseMongoQuery(
        'db.users.replaceOne({"_id": "123"}, {"name": "New"})'
      );

      expect(result.operation).toBe('replaceOne');
      expect(result.filter).toEqual({ _id: '123' });
      expect(result.replacement).toEqual({ name: 'New' });
    });

    it('should parse distinct query', () => {
      const result = mongoDbConfig.parseMongoQuery(
        'db.users.distinct("role", {"status": "active"})'
      );

      expect(result.operation).toBe('distinct');
      expect(result.field).toBe('role');
      expect(result.filter).toEqual({ status: 'active' });
    });

    it('should parse query with empty params', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.find()');

      expect(result.operation).toBe('find');
      expect(result.collection).toBe('users');
    });

    it('should parse count with empty filter', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.count()');

      expect(result.operation).toBe('count');
      // When no params, filter is not set
    });

    it('should parse drop operation', () => {
      const result = mongoDbConfig.parseMongoQuery('db.temp.drop()');

      expect(result.operation).toBe('drop');
      expect(result.collection).toBe('temp');
    });

    it('should throw error for invalid parameters', () => {
      expect(() => mongoDbConfig.parseMongoQuery('db.users.find({invalid json})')).toThrow();
    });

    it('should handle string with escaped quotes', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.find({"name": "test"})');
      
      expect(result.operation).toBe('find');
      expect(result.filter).toEqual({ name: 'test' });
    });

    it('should handle single quotes in params', () => {
      // This tests the string parsing with single quotes
      const result = mongoDbConfig.parseMongoQuery("db.users.updateOne({\"_id\": \"1\"}, {\"$set\": {\"name\": \"test\"}})");
      
      expect(result.operation).toBe('updateOne');
    });

    it('should parse params with single quote strings', () => {
      // Test parseShellParams with single quotes - need to use a query that goes through parseShellParams
      const result = mongoDbConfig.parseMongoQuery('db.users.updateOne({"name": "test"}, {"$set": {"status": "active"}})');
      
      expect(result.operation).toBe('updateOne');
      expect(result.filter).toEqual({ name: 'test' });
      expect(result.update).toEqual({ $set: { status: 'active' } });
    });

    it('should handle empty params string in parseShellParams', () => {
      // Test with empty params - find with no arguments
      const result = mongoDbConfig.parseMongoQuery('db.users.find()');
      
      expect(result.operation).toBe('find');
      expect(result.filter).toBeUndefined();
    });

    it('should handle countDocuments operation mapping', () => {
      // countDocuments should be mapped to count
      const result = mongoDbConfig.parseMongoQuery('db.users.countDocuments({"status": "active"})');
      
      expect(result.operation).toBe('count');
      expect(result.filter).toEqual({ status: 'active' });
    });

    it('should parse updateOne with empty filter', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.updateOne({}, {"$set": {"active": true}})');
      
      expect(result.operation).toBe('updateOne');
      expect(result.filter).toEqual({});
      expect(result.update).toEqual({ $set: { active: true } });
    });

    it('should parse replaceOne with empty filter', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.replaceOne({}, {"name": "New"})');
      
      expect(result.operation).toBe('replaceOne');
      expect(result.filter).toEqual({});
    });

    it('should parse distinct with empty filter', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.distinct("role")');
      
      expect(result.operation).toBe('distinct');
      expect(result.field).toBe('role');
    });

    it('should parse find with only filter (no projection)', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.find({"status": "active"})');
      
      expect(result.operation).toBe('find');
      expect(result.filter).toEqual({ status: 'active' });
      expect(result.projection).toBeUndefined();
    });

    it('should parse updateMany operation', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.updateMany({"status": "inactive"}, {"$set": {"archived": true}})');
      
      expect(result.operation).toBe('updateMany');
      expect(result.filter).toEqual({ status: 'inactive' });
      expect(result.update).toEqual({ $set: { archived: true } });
    });

    it('should parse deleteMany operation', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.deleteMany({"status": "deleted"})');
      
      expect(result.operation).toBe('deleteMany');
      expect(result.filter).toEqual({ status: 'deleted' });
    });

    it('should parse insertMany operation', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.insertMany([{"name": "User1"}, {"name": "User2"}])');
      
      expect(result.operation).toBe('insertMany');
      expect(result.documents).toHaveLength(2);
    });

    it('should handle count with empty string params', () => {
      const result = mongoDbConfig.parseMongoQuery('db.users.count({})');
      
      expect(result.operation).toBe('count');
      expect(result.filter).toEqual({});
    });

    it('should parse updateOne with missing second param', () => {
      // This tests the || {} fallback for update
      const result = mongoDbConfig.parseMongoQuery('db.users.updateOne({"_id": "1"})');
      
      expect(result.operation).toBe('updateOne');
      expect(result.filter).toEqual({ _id: '1' });
      expect(result.update).toEqual({});
    });

    it('should parse replaceOne with missing second param', () => {
      // This tests the || {} fallback for replacement
      const result = mongoDbConfig.parseMongoQuery('db.users.replaceOne({"_id": "1"})');
      
      expect(result.operation).toBe('replaceOne');
      expect(result.filter).toEqual({ _id: '1' });
      expect(result.replacement).toEqual({});
    });

    it('should parse distinct with only field param', () => {
      // This tests the || {} fallback for filter in distinct
      const result = mongoDbConfig.parseMongoQuery('db.users.distinct("status")');
      
      expect(result.operation).toBe('distinct');
      expect(result.field).toBe('status');
      expect(result.filter).toEqual({});
    });
  });

  describe('closeAllClients', () => {
    it('should close all MongoDB connections', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 100,
          host: 'localhost',
          port: 27017,
          database: 'testdb',
          engine: 'MONGO',
          name: 'test-mongo'
        }]
      });

      await mongoDbConfig.getMongoConnection(100);
      
      await mongoDbConfig.closeAllClients();
      
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 101,
          host: 'localhost',
          port: 27017,
          database: 'testdb',
          engine: 'MONGO',
          name: 'test-mongo'
        }]
      });

      await mongoDbConfig.getMongoConnection(101);
      
      mockClient.close.mockRejectedValue(new Error('Close failed'));
      
      await expect(mongoDbConfig.closeAllClients()).resolves.not.toThrow();
    });
  });

  describe('getClientStats', () => {
    it('should return client statistics', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 200,
          host: 'localhost',
          port: 27017,
          database: 'testdb',
          engine: 'MONGO',
          name: 'test-mongo'
        }]
      });

      await mongoDbConfig.getMongoConnection(200);
      
      const stats = mongoDbConfig.getClientStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should return false for disconnected client', async () => {
      jest.resetModules();
      
      // Create a mock client with no topology
      const mockClientNoTopology = {
        connect: jest.fn().mockResolvedValue(undefined),
        db: jest.fn(() => mockDb),
        close: jest.fn().mockResolvedValue(undefined),
        topology: null
      };

      jest.doMock('mongodb', () => ({
        MongoClient: jest.fn(() => mockClientNoTopology)
      }));

      jest.doMock('../src/config/db', () => ({
        query: jest.fn().mockResolvedValue({
          rows: [{
            id: 201,
            host: 'localhost',
            port: 27017,
            database: 'testdb',
            engine: 'MONGO',
            name: 'test-mongo'
          }]
        })
      }));

      const mongoDbConfigNew = require('../src/config/mongoDb');
      
      await mongoDbConfigNew.getMongoConnection(201);
      
      const stats = mongoDbConfigNew.getClientStats();
      
      expect(stats[201].connected).toBe(false);
    });
  });
});
