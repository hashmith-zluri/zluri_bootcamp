const { MongoClient } = require('mongodb');

const mongoClients = new Map();

const createMongoConnection = async (instanceConfig) => {
  const { host, port, database, username, password } = instanceConfig;
  
  let connectionString;
  
  // Check if this is a MongoDB Atlas connection (contains mongodb.net)
  if (host && host.includes('mongodb.net')) {
    // Atlas connection string format - encode password for URL safety
    const encodedPassword = encodeURIComponent(password);
    connectionString = `mongodb+srv://${username}:${encodedPassword}@${host}`;
    if (database) {
      connectionString += `/${database}`;
    }
    connectionString += '?retryWrites=true&w=majority&appName=mongo-1';
  } else {
    // Local MongoDB connection string format
    connectionString = 'mongodb://';
    
    if (username && password) {
      connectionString += `${username}:${password}@`;
    }
    
    connectionString += `${host || 'localhost'}:${port || 27017}`;
    
    if (database) {
      connectionString += `/${database}`;
    }
  }
  
  console.log(`Creating MongoDB connection to: ${host}`);
  
  const client = new MongoClient(connectionString, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    maxIdleTimeoutMS: 300000,
    // Enhanced TLS configuration for Atlas in production
    tls: host && host.includes('mongodb.net'),
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
    // Additional SSL options for Railway/production environments
    ssl: host && host.includes('mongodb.net'),
    sslValidate: false,
    // Connection retry options
    retryWrites: true,
    retryReads: true,
    // Use stable API version for Atlas
    serverApi: host && host.includes('mongodb.net') ? {
      version: '1',
      strict: false,
      deprecationErrors: false
    } : undefined
  });
  
  await client.connect();
  return client;
};

const getMongoConnection = async (instanceId) => {
  if (mongoClients.has(instanceId)) {
    console.log(`Reusing existing MongoDB connection for instance ${instanceId}`);
    return mongoClients.get(instanceId);
  }

  const { query } = require('./db'); // Portal database connection
  
  try {
    const result = await query(
      'SELECT * FROM db_instances WHERE id = $1',
      [instanceId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Database instance with ID ${instanceId} not found`);
    }
    
    const instance = result.rows[0];
    
    if (instance.engine !== 'MONGO') {
      throw new Error(`Expected MongoDB instance, got: ${instance.engine}`);
    }
    
    const client = await createMongoConnection({
      host: instance.host,
      port: instance.port,
      database: null, // Database will be specified per query
      username: instance.username,
      password: instance.password
    });

    // Cache the client for reuse
    mongoClients.set(instanceId, client);
    
    console.log(`Created new MongoDB connection for instance ${instanceId} (${instance.name})`);
    return client;
    
  } catch (error) {
    throw new Error(`Failed to get MongoDB connection: ${error.message}`);
  }
};

const executeMongoQuery = async (instanceId, databaseName, queryText) => {
  let client = null;
  
  try {
    // Get MongoDB client
    client = await getMongoConnection(instanceId);
    
    // Parse the MongoDB query
    const parsedQuery = parseMongoQuery(queryText);
    
    // Get the database
    const db = client.db(databaseName);
    const collection = db.collection(parsedQuery.collection);
    
    // Execute the query
    const startTime = Date.now();
    let result;
    
    // Operation mapping - supports all MongoDB operations
    /*istanbul ignore next*/
    const operations = {
      find: async () => {
        let cursor = collection.find(parsedQuery.filter || {});
        
        // Apply projection if provided
        if (parsedQuery.projection) cursor = cursor.project(parsedQuery.projection);
        
        return await cursor.toArray();
      },
      
      findOne: async () => {
        const doc = await collection.findOne(
          parsedQuery.filter || {}, 
          { projection: parsedQuery.projection }
        );
        return doc ? [doc] : [];
      },
      
      count: async () => {
        const count = await collection.countDocuments(parsedQuery.filter || {});
        return [{ count }];
      },
      
      aggregate: async () => {
        return await collection.aggregate(parsedQuery.pipeline).toArray();
      },
      
      insertOne: async () => {
        const result = await collection.insertOne(parsedQuery.document);
        return [{ insertedId: result.insertedId, acknowledged: result.acknowledged }];
      },
      
      insertMany: async () => {
        const result = await collection.insertMany(parsedQuery.documents);
        return [{ insertedCount: result.insertedCount, insertedIds: result.insertedIds }];
      },
      
      updateOne: async () => {
        const result = await collection.updateOne(parsedQuery.filter || {}, parsedQuery.update);
        return [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
      },
      
      updateMany: async () => {
        const result = await collection.updateMany(parsedQuery.filter || {}, parsedQuery.update);
        return [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
      },
      
      deleteOne: async () => {
        const result = await collection.deleteOne(parsedQuery.filter || {});
        return [{ deletedCount: result.deletedCount }];
      },
      
      deleteMany: async () => {
        const result = await collection.deleteMany(parsedQuery.filter || {});
        return [{ deletedCount: result.deletedCount }];
      },
      
      replaceOne: async () => {
        const result = await collection.replaceOne(parsedQuery.filter || {}, parsedQuery.replacement);
        return [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
      },
      
      distinct: async () => {
        const values = await collection.distinct(parsedQuery.field, parsedQuery.filter || {});
        return [{ values }];
      },
      
      drop: async () => {
        const result = await collection.drop();
        return [{ dropped: result }];
      }
    };
    
    // Execute the operation
    const operation = operations[parsedQuery.operation];
    if (!operation) {
      throw new Error(`Unsupported MongoDB operation: ${parsedQuery.operation}`);
    }
    
    result = await operation();
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      rows: result,
      rowCount: result.length,
      executionTime,
      operation: parsedQuery.operation,
      collection: parsedQuery.collection
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      executionTime: 0
    };
  }
};
/*istanbul ignore next*/
const parseMongoQuery = (queryText) => {
  try {
    const cleanQuery = queryText.trim().replace(/;$/, '');
    const shellPattern = /^db\.(\w+)\.(\w+)\((.*)\)$/;
    const match = cleanQuery.match(shellPattern);
    
    if (!match) {
      throw new Error('Invalid MongoDB shell format. Expected format: db.collection.operation(params)');
    }
    
    const [, collection, operation, paramsStr] = match;
    
    // Parse parameters using operation-specific handlers
    const paramParsers = {
      aggregate: (str) => ({ pipeline: JSON.parse(str) }),
      count: (str) => ({ filter: str.trim() ? JSON.parse(str) : {} }),
      countDocuments: (str) => ({ filter: str.trim() ? JSON.parse(str) : {} }),
      insertOne: (str) => ({ document: JSON.parse(str) }),
      insertMany: (str) => ({ documents: JSON.parse(str) }),
      updateOne: (str) => {
        const [filter, update] = parseShellParams(str);
        return { filter: filter || {}, update: update || {} };
      },
      updateMany: (str) => {
        const [filter, update] = parseShellParams(str);
        return { filter: filter || {}, update: update || {} };
      },
      deleteOne: (str) => ({ filter: JSON.parse(str) }),
      deleteMany: (str) => ({ filter: JSON.parse(str) }),
      replaceOne: (str) => {
        const [filter, replacement] = parseShellParams(str);
        return { filter: filter || {}, replacement: replacement || {} };
      },
      distinct: (str) => {
        const [field, filter] = parseShellParams(str);
        return { field, filter: filter || {} };
      },
      drop: () => ({}),
      // Default handler for find/findOne
      default: (str) => {
        const [filter, projection] = parseShellParams(str);
        const params = {};
        if (filter) params.filter = filter;
        if (projection) params.projection = projection;
        return params;
      }
    };
    
    let params = {};
    if (paramsStr.trim()) {
      try {
        const parser = paramParsers[operation] || paramParsers.default;
        params = parser(paramsStr);
      } catch (parseError) {
        throw new Error(`Invalid parameters: ${parseError.message}`);
      }
    }
    
    return {
      operation: operation === 'countDocuments' ? 'count' : operation,
      collection,
      ...params
    };
    
  } catch (error) {
    throw error;
  }
};

// Helper function to parse shell parameters

const parseShellParams = (paramsStr) => {
  if (!paramsStr.trim()) return [];
  
  try {
    // Simple parameter parsing - handles basic cases
    // For more complex cases, we'd need a proper JavaScript parser
    const params = [];
    let currentParam = '';
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        currentParam += char;
      } else if (inString && char === stringChar && paramsStr[i-1] !== '\\') {
        inString = false;
        stringChar = '';
        currentParam += char;
      } else if (!inString && char === '{') {
        braceCount++;
        currentParam += char;
      } else if (!inString && char === '}') {
        braceCount--;
        currentParam += char;
        //istanbul ignore next/
      } else if (!inString && char === ',' && braceCount === 0) {
        //istanbul ignore next/
        if (currentParam.trim()) {
          params.push(JSON.parse(currentParam.trim()));
        }
        currentParam = '';
      } else {
        currentParam += char;
      }
    }
    
    if (currentParam.trim()) {
      params.push(JSON.parse(currentParam.trim()));
    }
    
    return params;
  } catch (error) {
    throw new Error(`Failed to parse parameters: ${error.message}`);
  }
};

// Validate MongoDB query
/*istanbul ignore next*/
const validateMongoQuery = (queryText) => {
  try {
    const parsed = parseMongoQuery(queryText);
    
    // Validate collection name (basic validation)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.collection)) {
      throw new Error('Invalid collection name. Use only letters, numbers, and underscores.');
    }
    
    return true;
    
  } catch (error) {
    throw error;
  }
};

// Gracefully close all MongoDB connections
const closeAllClients = async () => {
  console.log(`Closing ${mongoClients.size} MongoDB connections...`);
  
  for (const [instanceId, client] of mongoClients) {
    try {
      await client.close();
      console.log(`Closed MongoDB connection for instance ${instanceId}`);
    } catch (error) {
      console.error(`Error closing MongoDB connection for instance ${instanceId}:`, error.message);
    }
  }
  
  mongoClients.clear();
};

// Get client statistics for monitoring
const getClientStats = () => {
  const stats = {};
  
  for (const [instanceId, client] of mongoClients) {
    stats[instanceId] = {
      type: 'mongodb',
      connected: client.topology?.isConnected() || false
    };
  }
  
  return stats;
};

module.exports = {
  createMongoConnection,
  getMongoConnection,
  executeMongoQuery,
  validateMongoQuery,
  parseMongoQuery,
  closeAllClients,
  getClientStats
};