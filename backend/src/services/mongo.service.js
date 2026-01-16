const { executeMongoQuery, validateMongoQuery } = require('../config/mongoDb');
const QueryRequestRepository = require('../repositories/queryRequest.repository');
const ExecutionLogRepository = require('../repositories/executionLog.repository');
const slackService = require('./slack.service');

class MongoExecutionService {
  async executeMongoQuery(requestId) {
    let executionResult = null;
    
    try {
      const request = await QueryRequestRepository.findWithInstance(requestId);

      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }
      
      if (request.status !== 'APPROVED') {
        throw new Error(`Request ${requestId} is not approved. Current status: ${request.status}`);
      }

      if (request.engine !== 'MONGO') {
        throw new Error(`Expected MongoDB instance, got: ${request.engine}`);
      }

      if (!request.query_text) {
        throw new Error('No query text found in request');
      }

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
      } else {
        await slackService.notifyApprovalFailure(slackRequestData, executionResult);
      }
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
    const results = [];
    
    for (const requestId of requestIds) {
      try {
        const result = await this.executeMongoQuery(requestId);
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
}

module.exports = new MongoExecutionService();
