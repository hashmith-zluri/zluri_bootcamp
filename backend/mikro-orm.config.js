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
  dbName: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  debug: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
  pool: {
    min: 2,
    max: 10
  },
  allowGlobalContext: true
});
