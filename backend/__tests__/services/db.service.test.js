const dbService = require('../../src/services/db.service');
const DbInstanceRepository = require('../../src/repositories/dbInstance.repository');
const InstanceDatabaseRepository = require('../../src/repositories/instanceDatabase.repository');

// Mock repositories
jest.mock('../../src/repositories/dbInstance.repository');
jest.mock('../../src/repositories/instanceDatabase.repository');

describe('DB Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstancesByType', () => {
    it('should return instances for POSTGRES engine', async () => {
      const mockInstances = [
        { id: 1, name: 'postgres-prod', engine: 'POSTGRES' },
        { id: 2, name: 'postgres-dev', engine: 'POSTGRES' }
      ];
      
      DbInstanceRepository.findByEngine.mockResolvedValue(mockInstances);

      const result = await dbService.getInstancesByType('POSTGRES');

      expect(result).toEqual(mockInstances);
      expect(DbInstanceRepository.findByEngine).toHaveBeenCalledWith('POSTGRES');
    });

    it('should return instances for MONGO engine', async () => {
      const mockInstances = [
        { id: 3, name: 'mongo-prod', engine: 'MONGO' }
      ];
      
      DbInstanceRepository.findByEngine.mockResolvedValue(mockInstances);

      const result = await dbService.getInstancesByType('MONGO');

      expect(result).toEqual(mockInstances);
      expect(DbInstanceRepository.findByEngine).toHaveBeenCalledWith('MONGO');
    });

    it('should return empty array when no instances found', async () => {
      DbInstanceRepository.findByEngine.mockResolvedValue([]);

      const result = await dbService.getInstancesByType('POSTGRES');

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      DbInstanceRepository.findByEngine.mockRejectedValue(new Error('Repository error'));

      await expect(dbService.getInstancesByType('POSTGRES'))
        .rejects.toThrow('Repository error');
    });
  });

  describe('getInstanceById', () => {
    it('should return instance details by ID', async () => {
      const mockInstance = {
        id: 1,
        name: 'postgres-prod',
        engine: 'POSTGRES',
        host: 'localhost',
        port: 5432
      };
      
      DbInstanceRepository.findDetailsById.mockResolvedValue(mockInstance);

      const result = await dbService.getInstanceById(1);

      expect(result).toEqual(mockInstance);
      expect(DbInstanceRepository.findDetailsById).toHaveBeenCalledWith(1);
    });

    it('should return null when instance not found', async () => {
      DbInstanceRepository.findDetailsById.mockResolvedValue(null);

      const result = await dbService.getInstanceById(999);

      expect(result).toBeNull();
    });

    it('should handle repository errors', async () => {
      DbInstanceRepository.findDetailsById.mockRejectedValue(new Error('Database error'));

      await expect(dbService.getInstanceById(1))
        .rejects.toThrow('Database error');
    });

    it('should handle string ID parameter', async () => {
      const mockInstance = { id: 1, name: 'test' };
      DbInstanceRepository.findDetailsById.mockResolvedValue(mockInstance);

      const result = await dbService.getInstanceById('1');

      expect(result).toEqual(mockInstance);
      expect(DbInstanceRepository.findDetailsById).toHaveBeenCalledWith('1');
    });
  });

  describe('getDatabasesByInstanceId', () => {
    it('should return databases for instance', async () => {
      const mockDatabases = ['app_db', 'analytics_db', 'user_db'];
      
      InstanceDatabaseRepository.findByInstanceId.mockResolvedValue(mockDatabases);

      const result = await dbService.getDatabasesByInstanceId(1);

      expect(result).toEqual(mockDatabases);
      expect(InstanceDatabaseRepository.findByInstanceId).toHaveBeenCalledWith(1);
    });

    it('should return empty array when no databases found', async () => {
      InstanceDatabaseRepository.findByInstanceId.mockResolvedValue([]);

      const result = await dbService.getDatabasesByInstanceId(1);

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      InstanceDatabaseRepository.findByInstanceId.mockRejectedValue(new Error('Connection failed'));

      await expect(dbService.getDatabasesByInstanceId(1))
        .rejects.toThrow('Connection failed');
    });

    it('should handle string ID parameter', async () => {
      const mockDatabases = ['test_db'];
      InstanceDatabaseRepository.findByInstanceId.mockResolvedValue(mockDatabases);

      const result = await dbService.getDatabasesByInstanceId('1');

      expect(result).toEqual(mockDatabases);
      expect(InstanceDatabaseRepository.findByInstanceId).toHaveBeenCalledWith('1');
    });

    it('should handle null response from repository', async () => {
      InstanceDatabaseRepository.findByInstanceId.mockResolvedValue(null);

      const result = await dbService.getDatabasesByInstanceId(1);

      expect(result).toBeNull();
    });
  });
});