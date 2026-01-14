const postgresExecutionService = require('./postgres.service');
const mongoExecutionService = require('./mongo.service');
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

      // Route based on request type and engine using strategy pattern
      const scriptExecutors = {
        POSTGRES: () => postgresScriptExecutionService.executePostgresScript(requestId),
        MONGO: () => mongoScriptExecutionService.executeMongoScript(requestId)
      };

      const queryExecutors = {
        POSTGRES: () => postgresExecutionService.executePostgresQuery(requestId),
        MONGO: () => mongoExecutionService.executeMongoQuery(requestId)
      };

      // Execute based on request type
      const hasScript = Boolean(script_path);
      const hasQuery = Boolean(query_text);
      
      const executor = hasScript 
        ? scriptExecutors[engine] 
        : hasQuery 
          ? queryExecutors[engine] 
          : null;

      if (!executor) {
        const errorMessage = hasScript || hasQuery
          ? `${hasScript ? 'Script' : 'Query'} execution not supported for engine: ${engine}`
          : 'Request has neither query text nor script path';
        throw new Error(errorMessage);
      }

      return await executor();
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
      
      const hasScriptRequest = requestCheck.rows.length > 0 && requestCheck.rows[0].script_path;
      
      const resultServices = {
        script: {
          MONGO: () => mongoScriptExecutionService.getScriptExecutionResult(requestId),
          default: () => postgresScriptExecutionService.getScriptExecutionResult(requestId)
        },
        query: () => postgresExecutionService.getExecutionResult(requestId)
      };

      const serviceType = hasScriptRequest ? 'script' : 'query';
      const engine = hasScriptRequest ? requestCheck.rows[0].engine : null;
      
      const service = hasScriptRequest 
        ? (resultServices.script[engine] || resultServices.script.default)
        : resultServices.query;

      return await service();
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