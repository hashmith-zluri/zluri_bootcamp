const request = require('supertest');
const app = require('../../src/app');
const { query } = require('../../src/config/db');

// Mock the database
jest.mock('../../src/config/db');

// Mock auth middleware
jest.mock('../../src/middlewares/auth.middleware', () => {
  return (req, res, next) => {
    req.user = global.mockUser;
    next();
  };
});

describe('DB Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/db/types', () => {
    it('should return database types', async () => {
      const response = await request(app)
        .get('/api/v1/db/types');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        types: ['POSTGRES', 'MONGO']
      });
    });
  });

  describe('GET /api/v1/db/instances', () => {
    it('should return database instances for valid type', async () => {
      const mockInstances = [
        { id: 1, name: 'postgres-prod' },
        { id: 2, name: 'postgres-dev' }
      ];
      query.mockResolvedValue({ rows: mockInstances });

      const response = await request(app)
        .get('/api/v1/db/instances?type=POSTGRES');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        instances: [
          { id: '1', name: 'postgres-prod' },
          { id: '2', name: 'postgres-dev' }
        ]
      });
      expect(query).toHaveBeenCalledWith(
        'SELECT id, name FROM db_instances WHERE engine = $1 ORDER BY name',
        ['POSTGRES']
      );
    });

    it('should return 400 when type parameter is missing', async () => {
      const response = await request(app)
        .get('/api/v1/db/instances');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
      expect(query).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid database type', async () => {
      const response = await request(app)
        .get('/api/v1/db/instances?type=MONGO111');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database type not found. Valid types: POSTGRES, MONGO');
      expect(query).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/v1/db/instances?type=POSTGRES');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Database connection failed'
      });
    });
  });

  describe('GET /api/v1/db/instances/:id/name', () => {
    it('should return databases for PostgreSQL instance', async () => {
      const mockInstance = {
        name: 'postgres-prod',
        host: 'localhost',
        port: 5432,
        engine: 'POSTGRES',
        database: 'postgres'
      };
      const mockDatabases = [
        { database_name: 'app_db' },
        { database_name: 'analytics_db' }
      ];

      query
        .mockResolvedValueOnce({ rows: [mockInstance] })
        .mockResolvedValueOnce({ rows: mockDatabases });

      const response = await request(app)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        databases: ['app_db', 'analytics_db']
      });
    });

    it('should return databases for MongoDB instance', async () => {
      const mockInstance = {
        name: 'mongo-prod',
        host: 'localhost',
        port: 27017,
        engine: 'MONGO',
        database: 'admin'
      };
      const mockDatabases = [
        { database_name: 'user_db' },
        { database_name: 'product_db' }
      ];

      query
        .mockResolvedValueOnce({ rows: [mockInstance] })
        .mockResolvedValueOnce({ rows: mockDatabases });

      const response = await request(app)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        databases: ['user_db', 'product_db']
      });
    });

    it('should return empty array when no databases found', async () => {
      const mockInstance = {
        name: 'postgres-empty',
        host: 'localhost',
        port: 5432,
        engine: 'POSTGRES',
        database: 'postgres'
      };

      query
        .mockResolvedValueOnce({ rows: [mockInstance] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        databases: []
      });
    });

    it('should return 404 when instance not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/db/instances/999/name');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Instance not found'
      });
    });

    it('should return 400 for unsupported database engine', async () => {
      const mockInstance = {
        name: 'mysql-prod',
        engine: 'MYSQL'
      };
      query.mockResolvedValue({ rows: [mockInstance] });

      const response = await request(app)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Unsupported database engine: MYSQL'
      });
    });

    it('should return 400 for Redis engine', async () => {
      const mockInstance = {
        name: 'redis-cache',
        engine: 'REDIS'
      };
      query.mockResolvedValue({ rows: [mockInstance] });

      const response = await request(app)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Unsupported database engine: REDIS'
      });
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to fetch databases'
      });
    });

    it('should handle database connection timeout', async () => {
      query.mockRejectedValue(new Error('Connection timeout'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to fetch databases'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Get databases by instance failed:',
        'Connection timeout'
      );

      consoleSpy.mockRestore();
    });

    it('should handle instance service returning null', async () => {
      // Mock the service to return null instead of using query directly
      jest.resetModules();
      jest.doMock('../../src/services/db.service', () => ({
        getInstanceById: jest.fn().mockResolvedValue(null),
        getDatabasesByInstanceId: jest.fn()
      }));

      const appWithMockedService = require('../../src/app');

      const response = await request(appWithMockedService)
        .get('/api/v1/db/instances/999/name');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Instance not found'
      });
    });

    it('should handle service throwing error during database fetch', async () => {
      jest.resetModules();
      jest.doMock('../../src/services/db.service', () => ({
        getInstanceById: jest.fn().mockResolvedValue({
          name: 'test-instance',
          engine: 'POSTGRES'
        }),
        getDatabasesByInstanceId: jest.fn().mockRejectedValue(new Error('Service error'))
      }));

      const appWithMockedService = require('../../src/app');

      const response = await request(appWithMockedService)
        .get('/api/v1/db/instances/1/name');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to fetch databases'
      });
    });
  });
});