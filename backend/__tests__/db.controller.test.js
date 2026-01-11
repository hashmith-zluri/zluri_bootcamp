const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');

// Mock the database
jest.mock('../src/config/db');

// Mock auth middleware
jest.mock('../src/middlewares/auth.middleware', () => {
  return (req, res, next) => {
    req.user = global.mockUser;
    next();
  };
});

describe('DB Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/db/types', () => {
    it('should return database types', async () => {
      const response = await request(app)
        .get('/api/db/types');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        types: ['POSTGRES', 'MONGO']
      });
    });
  });

  describe('GET /api/db/instances', () => {
    it('should return database instances for valid type', async () => {
      const mockInstances = [
        { id: 1, name: 'postgres-prod' },
        { id: 2, name: 'postgres-dev' }
      ];
      query.mockResolvedValue({ rows: mockInstances });

      const response = await request(app)
        .get('/api/db/instances?type=POSTGRES');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
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
        .get('/api/db/instances');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Type parameter is required'
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/db/instances?type=POSTGRES');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Database connection failed'
      });
    });
  });

  describe('GET /api/db/instances/:id/name', () => {
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
        .get('/api/db/instances/1/name');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
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
        .get('/api/db/instances/1/name');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        databases: ['user_db', 'product_db']
      });
    });

    it('should return 404 when instance not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/db/instances/999/name');

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
        .get('/api/db/instances/1/name');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Unsupported database engine: MYSQL'
      });
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/db/instances/1/name');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to fetch databases'
      });
    });
  });
});