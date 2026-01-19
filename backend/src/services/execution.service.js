const postgresExecutionService = require('./postgres.service');
const mongoExecutionService = require('./mongo.service');
const postgresScriptExecutionService = require('./postgresScript.service');
const mongoScriptExecutionService = require('./mongoScript.service');
const QueryRequestRepository = require('../repositories/queryRequest.repository');
const ExecutionLogRepository = require('../repositories/executionLog.repository');

class ExecutionService {
  // Validation utilities using functional approach
  validateRequest = (request, requestId) => {
    const validators = [
      () => request ? null : `Request ${requestId} not found`
    ];
    
    const error = validators.map(validator => validator()).find(result => result !== null);
    return error ? (() => { throw new Error(error); })() : request;
  };

  // Executor factory using functional composition
  createExecutorMap = () => ({
    QUERY: {
      POSTGRES: () => postgresExecutionService.executePostgresQuery,
      MONGO: () => mongoExecutionService.executeMongoQuery
    },
    SCRIPT: {
      POSTGRES: () => postgresScriptExecutionService.executePostgresScript,
      MONGO: () => mongoScriptExecutionService.executeMongoScript
    }
  });

  // Result fetcher factory
  createResultFetcherMap = () => ({
    QUERY: {
      POSTGRES: () => postgresExecutionService.getExecutionResult,
      MONGO: () => mongoExecutionService.getExecutionResult
    },
    SCRIPT: {
      POSTGRES: () => postgresScriptExecutionService.getScriptExecutionResult,
      MONGO: () => mongoScriptExecutionService.getScriptExecutionResult
    }
  });

  // Functional executor resolver
  resolveExecutor = (request) => {
    const { engine, script_path } = request;
    const type = script_path ? 'SCRIPT' : 'QUERY';
    const executorMap = this.createExecutorMap();
    
    const executor = executorMap[type]?.[engine]?.();
    if (!executor) {
      throw new Error(`${type} execution not supported for engine: ${engine}`);
    }
    
    return executor;
  };

  // Functional result fetcher resolver
  resolveResultFetcher = (request) => {
    const { engine, script_path } = request;
    const type = script_path ? 'SCRIPT' : 'QUERY';
    const fetcherMap = this.createResultFetcherMap();
    
    const fetcher = fetcherMap[type]?.[engine]?.();
    if (!fetcher) {
      throw new Error(`Result fetch not supported for ${type} on engine ${engine}`);
    }
    
    return fetcher;
  };

  async executeQuery(requestId) {
    try {
      const request = await QueryRequestRepository.findWithEngine(requestId);
      this.validateRequest(request, requestId);
      
      // Additional validation for execution type
      const hasQuery = request.query_text;
      const hasScript = request.script_path;
      
      if (!hasQuery && !hasScript) {
        throw new Error(`Request ${requestId} has neither query text nor script path`);
      }
      
      const executor = this.resolveExecutor(request);
      return await executor(requestId);
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
      this.validateRequest(request, requestId);
      
      const fetcher = this.resolveResultFetcher(request);
      return await fetcher(requestId);
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

  // Functional output formatting with strategy pattern
  formatOutput(executionResult) {
    const formatStrategies = [
      // Strategy 1: Handle unsuccessful results
      (result) => result.success ? undefined : null,
      
      // Strategy 2: Handle empty results
      (result) => (result.rows?.length > 0) ? undefined : 'Query executed successfully. No rows returned.',
      
      // Strategy 3: Handle large result sets
      (result) => (result.rows?.length > 100)
        ? `Query executed successfully. ${result.rowCount} rows returned. (First 100 rows shown)\n\n` +
          JSON.stringify(result.rows.slice(0, 100), null, 2) +
          `\n\n... and ${result.rowCount - 100} more rows`
        : undefined,
      
      // Strategy 4: Handle normal results
      (result) => `Query executed successfully. ${result.rowCount} rows returned.\n\n` +
                  JSON.stringify(result.rows, null, 2)
    ];
    
    // Apply first matching strategy
    return formatStrategies
      .map(strategy => strategy(executionResult))
      .find(result => result !== undefined);
  }
}

module.exports = new ExecutionService();
