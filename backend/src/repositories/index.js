const UserRepository = require('./user.repository');
const DbInstanceRepository = require('./dbInstance.repository');
const QueryRequestRepository = require('./queryRequest.repository');
const ExecutionLogRepository = require('./executionLog.repository');
const InstanceDatabaseRepository = require('./instanceDatabase.repository');

module.exports = {
  UserRepository,
  DbInstanceRepository,
  QueryRequestRepository,
  ExecutionLogRepository,
  InstanceDatabaseRepository
};
