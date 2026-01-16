const { User, UserRole, UserSchema } = require('./User');
const { DbInstance, DbEngine, DbInstanceSchema } = require('./DbInstance');
const { QueryRequest, RequestStatus, QueryRequestSchema } = require('./QueryRequest');
const { ExecutionLog, ExecutionLogSchema } = require('./ExecutionLog');
const { InstanceDatabase, InstanceDatabaseSchema } = require('./InstanceDatabase');

module.exports = {
  // Entity classes
  User,
  DbInstance,
  QueryRequest,
  ExecutionLog,
  InstanceDatabase,
  
  // Enums
  UserRole,
  DbEngine,
  RequestStatus,
  
  // Schemas for MikroORM
  UserSchema,
  DbInstanceSchema,
  QueryRequestSchema,
  ExecutionLogSchema,
  InstanceDatabaseSchema
};
