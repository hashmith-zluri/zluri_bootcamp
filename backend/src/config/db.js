const { MikroORM } = require('@mikro-orm/postgresql');
const { 
  UserSchema, 
  DbInstanceSchema, 
  QueryRequestSchema, 
  ExecutionLogSchema, 
  InstanceDatabaseSchema 
} = require('../entities');

/** @type {MikroORM} */
let orm = null;

/**
 * Initialize MikroORM connection
 * @returns {Promise<MikroORM>}
 */
const initORM = async () => {
  if (!orm) {
    orm = await MikroORM.init({
      entities: [UserSchema, DbInstanceSchema, QueryRequestSchema, ExecutionLogSchema, InstanceDatabaseSchema],
      dbName: process.env.DB_NAME,
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
      pool: { 
        min: 0, // Start with 0 connections for serverless
        max: 5  // Reduced max connections for Neon free tier
      },
      allowGlobalContext: true
    });
    console.log('MikroORM initialized successfully');
  }
  return orm;
};

/**
 * Get the ORM instance
 * @returns {MikroORM}
 */
const getORM = () => {
  if (!orm) {
    throw new Error('ORM not initialized. Call initORM() first.');
  }
  return orm;
};

/**
 * Get a forked EntityManager
 * @returns {import('@mikro-orm/postgresql').EntityManager}
 */
const getEM = () => {
  return getORM().em.fork();
};

/**
 * Close the ORM connection
 * @returns {Promise<void>}
 */
const closeORM = async () => {
  if (orm) {
    await orm.close();
    orm = null;
    console.log('MikroORM connection closed');
  }
};

/**
 * Execute a raw SQL query using MikroORM's connection
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
const query = async (text, params = []) => {
  const start = Date.now();
  const em = getEM();
  
  // Get the underlying PostgreSQL connection from MikroORM
  const connection = em.getConnection();
  
  // Use the native client for raw queries with PostgreSQL-style parameters
  const client = await connection.getKnex().client.acquireConnection();
  
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV !== 'test') {
      console.log('executed query', {
        text,
        duration,
        rows: result.rows ? result.rows.length : 0
      });
    }

    // Format result to match pg's result format for backward compatibility
    return {
      rows: result.rows || [],
      rowCount: result.rowCount || 0
    };
  } finally {
    // Release the connection back to the pool
    await connection.getKnex().client.releaseConnection(client);
  }
};

module.exports = {
  initORM,
  getORM,
  getEM,
  closeORM,
  query
};
