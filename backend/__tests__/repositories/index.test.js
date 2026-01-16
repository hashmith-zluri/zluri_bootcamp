const repositories = require('../../src/repositories');

describe('Repositories Index', () => {
  it('should export UserRepository', () => {
    expect(repositories.UserRepository).toBeDefined();
    expect(repositories.UserRepository.findByEmail).toBeDefined();
    expect(repositories.UserRepository.findById).toBeDefined();
  });

  it('should export DbInstanceRepository', () => {
    expect(repositories.DbInstanceRepository).toBeDefined();
    expect(repositories.DbInstanceRepository.findByEngine).toBeDefined();
    expect(repositories.DbInstanceRepository.findById).toBeDefined();
  });

  it('should export QueryRequestRepository', () => {
    expect(repositories.QueryRequestRepository).toBeDefined();
    expect(repositories.QueryRequestRepository.create).toBeDefined();
    expect(repositories.QueryRequestRepository.findById).toBeDefined();
  });

  it('should export ExecutionLogRepository', () => {
    expect(repositories.ExecutionLogRepository).toBeDefined();
    expect(repositories.ExecutionLogRepository.create).toBeDefined();
    expect(repositories.ExecutionLogRepository.findLatestByRequestId).toBeDefined();
  });

  it('should export InstanceDatabaseRepository', () => {
    expect(repositories.InstanceDatabaseRepository).toBeDefined();
    expect(repositories.InstanceDatabaseRepository.findByInstanceId).toBeDefined();
  });
});
