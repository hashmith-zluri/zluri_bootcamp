const { executeMongoQuery, validateMongoQuery } = require('../config/mongoDb');
const QueryRequestRepository = require('../repositories/queryRequest.repository');
const ExecutionLogRepository = require('../repositories/executionLog.repository');
const slackService = require('./slack.service');

class MongoExecutionService {
  async executeMongoQuery(requestId) {
    let executionResult = null;
    
    try {
      const request = await QueryRequestRepository.findWithInstance(requestId);

      // Functional validation chain - throws on first failure
      const validateMongoRequest = (req, id) => {
        const validationError = [
          () => req ? null : `Request ${id} not found`,
          () => (req?.status === 'APPROVED') ? null : `Request ${id} is not approved. Current status: ${req?.status}`,
          () => (req?.engine === 'MONGO') ? null : `Expected MongoDB instance, got: ${req?.engine}`,
          () => req?.query_text ? null : 'No query text found in request'
        ].map(validator => validator()).find(error => error !== null);
        
        return validationError ? (() => { throw new Error(validationError); })() : req;
      };

      validateMongoRequest(request, requestId);

      console.log(`Executing MongoDB query for request ${requestId}:`);
      console.log(`Instance: ${request.instance_name}`);
      console.log(`Database: ${request.database_name}`);
      console.log(`Query: ${request.query_text}`);

      await this.updateRequestStatus(requestId, 'EXECUTING');

      validateMongoQuery(request.query_text);

      executionResult = await executeMongoQuery(
        request.db_instance_id,
        request.database_name,
        request.query_text
      );

      const finalStatus = executionResult.success ? 'EXECUTED' : 'FAILED';
      
      await this.updateRequestStatus(requestId, finalStatus);
      await this.logExecution(requestId, executionResult);

      if (executionResult.success) {
        executionResult.output = this.formatMongoOutput(executionResult);
      }

      await this.sendExecutionNotification(requestId, executionResult);

      return {
        requestId,
        success: executionResult.success,
        status: finalStatus,
        executionTime: executionResult.executionTime,
        rowCount: executionResult.rowCount || 0,
        output: this.formatMongoOutput(executionResult),
        error: executionResult.error || null
      };

    } catch (error) {
      console.error(`MongoDB execution failed for request ${requestId}:`, error.message);
      
      await this.updateRequestStatus(requestId, 'FAILED');
      
      const failureResult = {
        success: false,
        error: error.message,
        executionTime: 0
      };
      await this.logExecution(requestId, failureResult);
      await this.sendExecutionNotification(requestId, failureResult);

      return {
        requestId,
        success: false,
        status: 'FAILED',
        executionTime: 0,
        rowCount: 0,
        output: null,
        error: error.message
      };
    }
  }

  async sendExecutionNotification(requestId, executionResult) {
    if (!slackService.isEnabled()) return;

    try {
      const requestData = await QueryRequestRepository.findForNotification(requestId);

      if (!requestData) {
        console.warn(`Could not find request ${requestId} for Slack notification`);
        return;
      }

      const slackRequestData = {
        req_id: requestData.id,
        requester_name: requestData.requester_name,
        requester_email: requestData.requester_email,
        database_type: requestData.database_type,
        database_name: requestData.database_name,
        instance_name: requestData.instance_name,
        query: requestData.query_text,
        script: requestData.script_path
      };

      if (executionResult.success) {
        await slackService.notifyApprovalSuccess(slackRequestData, executionResult);
        return;
      } 
        await slackService.notifyApprovalFailure(slackRequestData, executionResult);
    } catch (error) {
      console.error(`Failed to send Slack notification for request ${requestId}:`, error.message);
    }
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
        output: this.formatMongoOutput(executionResult),
        error: executionResult.error || null,
        executionTimeMs: executionResult.executionTime || 0
      });
      console.log(`Logged execution result for request ${requestId}, log ID: ${logResult.id}`);
    } catch (error) {
      console.error(`Failed to log execution for request ${requestId}:`, error.message);
    }
  }

  formatMongoOutput(executionResult) {
    if (!executionResult.success) {
      return null;
    }

    const result = {
      console_output: executionResult.rows && executionResult.rows.length > 0
        ? `MongoDB ${executionResult.operation} executed successfully on collection '${executionResult.collection}'. ${executionResult.rowCount} documents returned.`
        : `MongoDB ${executionResult.operation} executed successfully. No documents returned.`,
      result_data: executionResult.rows || []
    };

    return JSON.stringify(result, null, 2);
  }

  async getExecutionResult(requestId) {
    try {
      const log = await ExecutionLogRepository.findLatestByRequestId(requestId);

      if (!log) {
        return {
          status: 'pending',
          message: 'Request not yet executed'
        };
      }

      return {
        status: log.success ? 'success' : 'failure',
        output: log.output,
        error: log.error,
        executionTime: log.execution_time_ms,
        executedAt: log.executed_at
      };
    } catch (error) {
      console.error(`Failed to get execution result for request ${requestId}:`, error.message);
      throw error;
    }
  }

  async executeMultipleQueries(requestIds) {
    // Execute all queries in parallel for better performance
    const promises = requestIds.map(async (requestId) => {
      try {
        const result = await this.executeMongoQuery(requestId);
        return result;
      } catch (error) {
        return {
          requestId,
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.all(promises);
    
    return results;
  }
}

module.exports = new MongoExecutionService();
