const targetDb = require('../src/config/targetDb');
const postgresDb = require('../src/config/postgresDb');
const mongoDb = require('../src/config/mongoDb');

jest.mock('../src/config/postgresDb');
jest.mock('../src/config/mongoDb');

describe('TargetDb Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exports', () => {
    it('should export PostgreSQL functions', () => {
      expect(targetDb.createTargetDbConnection).toBeDefined();
      expect(targetDb.executeTargetQuery).toBeDefined();
      expect(targetDb.validateQuery).toBeDefined();
    });

    it('should export MongoDB functions', () => {
      expect(targetDb.createMongoConnection).toBeDefined();
      expect(targetDb.getMongoConnection).toBeDefined();
      expect(targetDb.executeMongoQuery).toBeDefined();
      expect(targetDb.validateMongoQuery).toBeDefined();
      expect(targetDb.parseMongoQuery).toBeDefined();
    });

    it('should export combined utilities', () => {
      expect(targetDb.closeAllPools).toBeDefined();
      expect(targetDb.getPoolStats).toBeDefined();
    });
  });

  describe('closeAllPools', () => {
    it('should close both PostgreSQL and MongoDB connections', async () => {
      postgresDb.closeAllPools.mockResolvedValue();
      mongoDb.closeAllClients.mockResolvedValue();

      await targetDb.closeAllPools();

      expect(postgresDb.closeAllPools).toHaveBeenCalled();
      expect(mongoDb.closeAllClients).toHaveBeenCalled();
    });
  });

  describe('getPoolStats', () => {
    it('should return combined stats from both databases', () => {
      postgresDb.getPoolStats.mockReturnValue({ pool1: { type: 'postgres' } });
      mongoDb.getClientStats.mockReturnValue({ client1: { type: 'mongodb' } });

      const stats = targetDb.getPoolStats();

      expect(stats.postgres).toEqual({ pool1: { type: 'postgres' } });
      expect(stats.mongodb).toEqual({ client1: { type: 'mongodb' } });
    });
  });
});
