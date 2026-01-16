const postgresExecutionService = require('./postgres.service');
const mongoExecutionService = require('./mongo.service');
const postgresScriptExecutionService = require('./postgresScript.service');
const mongoScriptExecutionService = require('./mongoScript.service');
const QueryRequestRepository = require('../repositories/queryRequest.repository');
const ExecutionLogRepository = require('../repositories/executionLog.repository');

class ExecutionService {
  async executeQuery(requestId) {
    try {
      const request = await QueryRequestRepository.findWithEngine(requestId);

      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      const { engine, query_text, script_path } = request;

      const hasQuery = Boolean(query_text);
      const hasScript = Boolean(script_path);

      if (!hasQuery && !hasScript) {
        throw new Error('Request has neither query text nor script path');
      }

      const executors = {
        QUERY: {
          POSTGRES: () => postgresExecutionService.executePostgresQuery(requestId),
          MONGO: () => mongoExecutionService.executeMongoQuery(requestId)
        },
        SCRIPT: {
          POSTGRES: () => postgresScriptExecutionService.executePostgresScript(requestId),
          MONGO: () => mongoScriptExecutionService.executeMongoScript(requestId)
        }
      };

      const type = hasScript ? 'SCRIPT' : 'QUERY';
      const executor = executors[type]?.[engine];

      if (!executor) {
        throw new Error(`${type} execution not supported for engine: ${engine}`);
      }

      return await executor();
    } catch (error) {
      console.error(`Execution failed for request ${requestId}:`, error.message);
      throw error;
    }
  }

  async executePostgresQuery(requestId) {
    return postgresExecutionService.executePostgresQuery(requestId);
  }

  async executeMongoQuery(requestId) {
    return mongoExecutionService.executeMongoQuery(requestId);
  }

  async executePostgresScript(requestId) {
    return postgresScriptExecutionService.executePostgresScript(requestId);
  }

  async executeMongoScript(requestId) {
    return mongoScriptExecutionService.executeMongoScript(requestId);
  }

  async getExecutionResult(requestId) {
    try {
      const request = await QueryRequestRepository.findWithEngine(requestId);

      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      const { engine, script_path } = request;
      const hasScript = Boolean(script_path);

      const resultFetchers = {
        QUERY: {
          POSTGRES: () => postgresExecutionService.getExecutionResult(requestId),
          MONGO: () => mongoExecutionService.getExecutionResult(requestId)
        },
        SCRIPT: {
          POSTGRES: () => postgresScriptExecutionService.getScriptExecutionResult(requestId),
          MONGO: () => mongoScriptExecutionService.getScriptExecutionResult(requestId)
        }
      };

      const type = hasScript ? 'SCRIPT' : 'QUERY';
      const fetcher = resultFetchers[type]?.[engine];

      if (!fetcher) {
        throw new Error(`Result fetch not supported for ${type} on engine ${engine}`);
      }

      return await fetcher();
    } catch (error) {
      console.error(`Failed to get execution result for request ${requestId}:`, error.message);
      throw error;
    }
  }

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

  async executePostgresBatch(requestIds) {
    return postgresExecutionService.executeMultipleQueries(requestIds);
  }

  async executeMongoBatch(requestIds) {
    return mongoExecutionService.executeMultipleQueries(requestIds);
  }

  async updateRequestStatus(requestId, status) {
    try {
      await QueryRequestRepository.updateStatus(requestId, status);
      console.log(`Updated request ${requestId} status to ${status}`);
    } catch (error) {
      console.error(`Failed to update request ${requestId} status:`, error.message);
      throw error;
    }
  }

  async logExecution(requestId, executionResult) {
    try {
      const logResult = await ExecutionLogRepository.create({
        requestId,
        success: executionResult.success,
        output: this.formatOutput(executionResult),
        error: executionResult.error || null,
        executionTimeMs: executionResult.executionTime || 0
      });
      console.log(`Logged execution result for request ${requestId}, log ID: ${logResult.id}`);
    } catch (error) {
      console.error(`Failed to log execution for request ${requestId}:`, error.message);
    }
  }

  formatOutput(executionResult) {
    if (!executionResult.success) {
      return null;
    }

    if (!executionResult.rows || executionResult.rows.length === 0) {
      return 'Query executed successfully. No rows returned.';
    }

    if (executionResult.rows.length > 100) {
      return `Query executed successfully. ${executionResult.rowCount} rows returned. (First 100 rows shown)\n\n` +
             JSON.stringify(executionResult.rows.slice(0, 100), null, 2) +
             `\n\n... and ${executionResult.rowCount - 100} more rows`;
    }

    return `Query executed successfully. ${executionResult.rowCount} rows returned.\n\n` +
           JSON.stringify(executionResult.rows, null, 2);
  }
}

module.exports = new ExecutionService();
