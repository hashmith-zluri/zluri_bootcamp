const { defineConfig } = require('@mikro-orm/postgresql');
const { 
  UserSchema, 
  DbInstanceSchema, 
  QueryRequestSchema, 
  ExecutionLogSchema, 
  InstanceDatabaseSchema 
} = require('./src/entities');

module.exports = defineConfig({
  entities: [UserSchema, DbInstanceSchema, QueryRequestSchema, ExecutionLogSchema, InstanceDatabaseSchema],
  
  // Connection configuration for Neon
  dbName: process.env.DB_NAME || 'neondb',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // SSL configuration for Neon (REQUIRED)
  driverOptions: {
    connection: {
      ssl: {
        rejectUnauthorized: false
      }
    }
  },
  
  debug: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
  
  // Optimized pool settings for serverless
  pool: {
    min: 0, // Start with 0 connections for serverless
    max: 5, // Reduced max connections for Neon free tier
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  
  allowGlobalContext: true,
  
  // Migration settings
  migrations: {
    path: './src/migrations',
    pathTs: undefined,
    glob: '!(*.d).{js,ts}',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    dropTables: false,
    safe: true,
    snapshot: true,
    emit: 'js',
  },
});
