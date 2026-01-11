const postgresDb = require('./postgresDb');
const mongoDb = require('./mongoDb');

// Re-export PostgreSQL functions
const {
  createTargetDbConnection,
  executeTargetQuery
} = postgresDb;

// Re-export MongoDB functions
const {
  createMongoConnection,
  getMongoConnection,
  executeMongoQuery,
  validateMongoQuery,
  parseMongoQuery
} = mongoDb;

// Gracefully close all connections (both PostgreSQL and MongoDB)
const closeAllPools = async () => {
  console.log('Closing all database connections...');
  
  // Close PostgreSQL pools
  await postgresDb.closeAllPools();
  
  // Close MongoDB clients
  await mongoDb.closeAllClients();
  
  console.log('All database connections closed.');
};

// Get combined pool statistics for monitoring
const getPoolStats = () => {
  return {
    postgres: postgresDb.getPoolStats(),
    mongodb: mongoDb.getClientStats()
  };
};

module.exports = {
  // PostgreSQL exports
  createTargetDbConnection,
  executeTargetQuery,
  
  // MongoDB exports
  createMongoConnection,
  getMongoConnection,
  executeMongoQuery,
  validateMongoQuery,
  parseMongoQuery,
  
  // Combined utilities
  closeAllPools,
  getPoolStats
};