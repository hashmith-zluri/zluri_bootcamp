const { Pool } = require('pg');

const connectionPools = new Map();

const createTargetDbConnection = (instanceConfig) => {
  const { host, port, database, username, password } = instanceConfig;
  
  const config = {
    host: host || 'localhost',
    port: port || 5432,
    database: database,
    user: username || process.env.DB_USER,
    password: password || process.env.DB_PASSWORD,
    max: 5,
    idleTimeoutMillis: 300000, 
    connectionTimeoutMillis: 10000, 
  };

  return new Pool(config);
};

const executeTargetQuery = async (instanceId, databaseName, queryText) => {
  let client = null;
  
  try {
    // Create cache key for instance + database combination
    const cacheKey = `${instanceId}_${databaseName}`;
    
    // Check if we have a cached pool for this specific database
    let pool = connectionPools.get(cacheKey);
    
    if (!pool) {
      // Get instance configuration
      const { query } = require('./db');
      const instanceResult = await query(
        'SELECT * FROM db_instances WHERE id = $1',
        [instanceId]
      );
      
      if (instanceResult.rows.length === 0) {
        throw new Error(`Database instance with ID ${instanceId} not found`);
      }
      
      const instance = instanceResult.rows[0];
      
      if (instance.engine !== 'POSTGRES') {
        throw new Error(`Unsupported database engine: ${instance.engine}`);
      }
      
      // Create new pool for this specific database
      pool = createTargetDbConnection({
        host: instance.host,
        port: instance.port,
        database: databaseName,
        username: instance.username,
        password: instance.password
      });
      
      // Cache the pool for reuse
      connectionPools.set(cacheKey, pool);
      console.log(`Created new PostgreSQL connection pool for instance ${instanceId}, database ${databaseName}`);
    } else {
      console.log(`Reusing existing PostgreSQL connection pool for instance ${instanceId}, database ${databaseName}`);
    }
    
    // Get client from cached pool
    client = await pool.connect();
    
    // Set query timeout (30 seconds)
    await client.query('SET statement_timeout = 30000');
    
    // Execute the query
    const startTime = Date.now();
    const result = await client.query(queryText);
    const executionTime = Date.now() - startTime;
    
    // Release client back to pool (don't end the pool)
    client.release();
    
    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime,
      fields: result.fields?.map(field => ({
        name: field.name,
        dataTypeID: field.dataTypeID
      }))
    };
    
  } catch (error) {
    // Make sure to release client if we got one
    if (client) {
      client.release();
    }
    
    return {
      success: false,
      error: error.message,
      code: error.code,
      executionTime: 0
    };
  }
};

// Gracefully close all PostgreSQL connection pools
const closeAllPools = async () => {
  console.log(`Closing ${connectionPools.size} PostgreSQL pools...`);
  
  for (const [cacheKey, pool] of connectionPools) {
    try {
      await pool.end();
      console.log(`Closed PostgreSQL pool for ${cacheKey}`);
    } catch (error) {
      console.error(`Error closing PostgreSQL pool for ${cacheKey}:`, error.message);
    }
  }
  
  connectionPools.clear();
};

// Get pool statistics for monitoring
const getPoolStats = () => {
  const stats = {};
  
  for (const [cacheKey, pool] of connectionPools) {
    stats[cacheKey] = {
      type: 'postgres',
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }
  
  return stats;
};

module.exports = {
  createTargetDbConnection,
  executeTargetQuery,
  closeAllPools,
  getPoolStats
};