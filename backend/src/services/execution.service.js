const postgresExecutionService = require('./postgres.service');
const mongoExecutionService = require('./mongoExecution.service');
const postgresScriptExecutionService = require('./postgresScript.service');
const mongoScriptExecutionService = require('./mongoScript.service');
const { query } = require('../config/db');

class ExecutionService {
  // Generic execution method that routes to appropriate engine and type
  async executeQuery(requestId) {
    try {
      // Get request details to determine database engine and request type
      const requestResult = await query(
        `SELECT di.engine, qr.query_text, qr.script_path 
         FROM query_requests qr 
         JOIN db_instances di ON qr.db_instance_id = di.id 
         WHERE qr.id = $1`,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      const { engine, query_text, script_path } = requestResult.rows[0];

      // Route based on request type and engine
      if (script_path) {
        // Script execution
        if (engine === 'POSTGRES') {
          return await postgresScriptExecutionService.executePostgresScript(requestId);
        } else if (engine === 'MONGO') {
          return await mongoScriptExecutionService.executeMongoScript(requestId);
        } else {
          throw new Error(`Script execution not supported for engine: ${engine}`);
        }
      } else if (query_text) {
        // Query execution
        switch (engine) {
          case 'POSTGRES':
            return await postgresExecutionService.executePostgresQuery(requestId);
          case 'MONGO':
            return await mongoExecutionService.executeMongoQuery(requestId);
          default:
            throw new Error(`Unsupported database engine: ${engine}`);
        }
      } else {
        throw new Error('Request has neither query text nor script path');
      }
    } catch (error) {
      console.error(`Generic execution failed for request ${requestId}:`, error.message);
      throw error;
    }
  }

  // PostgreSQL-specific execution (delegated)
  async executePostgresQuery(requestId) {
    return await postgresExecutionService.executePostgresQuery(requestId);
  }

  // MongoDB-specific execution (delegated)
  async executeMongoQuery(requestId) {
    return await mongoExecutionService.executeMongoQuery(requestId);
  }

  // Script execution (delegated to PostgreSQL script service)
  async executeScript(requestId) {
    return await postgresScriptExecutionService.executePostgresScript(requestId);
  }

  // Get execution result for a request (works for both queries and scripts)
  async getExecutionResult(requestId) {
    try {
      // Check if it's a script request and get engine type
      const requestCheck = await query(
        `SELECT qr.script_path, di.engine 
         FROM query_requests qr 
         JOIN db_instances di ON qr.db_instance_id = di.id 
         WHERE qr.id = $1`,
        [requestId]
      );
      
      if (requestCheck.rows.length > 0 && requestCheck.rows[0].script_path) {
        const engine = requestCheck.rows[0].engine;
        // Use appropriate script execution service based on engine
        if (engine === 'MONGO') {
          return await mongoScriptExecutionService.getScriptExecutionResult(requestId);
        } else {
          return await postgresScriptExecutionService.getScriptExecutionResult(requestId);
        }
      } else {
        // Use regular execution service for query results
        return await postgresExecutionService.getExecutionResult(requestId);
      }
    } catch (error) {
      console.error(`Failed to get execution result for request ${requestId}:`, error.message);
      throw error;
    }
  }

  // Execute multiple queries (mixed engines supported)
  async executeMultipleQueries(requestIds) {
    const results = [];
    
    for (const requestId of requestIds) {
      try {
        const result = await this.executeQuery(requestId);
        results.push(result);
      } catch (error) {
        results.push({
          requestId,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Batch execute by engine type
  async executePostgresBatch(requestIds) {
    return await postgresExecutionService.executeMultipleQueries(requestIds);
  }

  async executeMongoBatch(requestIds) {
    return await mongoExecutionService.executeMultipleQueries(requestIds);
  }

  // Batch execute scripts
  async executeScriptBatch(requestIds) {
    const results = [];
    
    for (const requestId of requestIds) {
      try {
        const result = await postgresScriptExecutionService.executePostgresScript(requestId);
        results.push(result);
      } catch (error) {
        results.push({
          requestId,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Update request status (shared utility)
  async updateRequestStatus(requestId, status) {
    return await postgresExecutionService.updateRequestStatus(requestId, status);
  }

  // Log execution (shared utility)
  async logExecution(requestId, executionResult) {
    return await postgresExecutionService.logExecution(requestId, executionResult);
  }
}

module.exports = new ExecutionService();