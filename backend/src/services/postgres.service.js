const { executeTargetQuery } = require('../config/postgresDb');
const { query } = require('../config/db');

class PostgresExecutionService {
  async executePostgresQuery(requestId) {
    let executionResult = null;
    
    try {
      const requestResult = await query(
        `SELECT qr.*, di.name as instance_name, di.host, di.port, di.database, di.engine
         FROM query_requests qr 
         JOIN db_instances di ON qr.db_instance_id = di.id 
         WHERE qr.id = $1`,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      const request = requestResult.rows[0];
      
      // Validate request status
      if (request.status !== 'APPROVED') {
        throw new Error(`Request ${requestId} is not approved. Current status: ${request.status}`);
      }

      // Validate database engine
      if (request.engine !== 'POSTGRES') {
        throw new Error(`Unsupported database engine: ${request.engine}`);
      }

      // Validate query exists
      if (!request.query_text) {
        throw new Error('No query text found in request');
      }

      console.log(`Executing PostgreSQL query for request ${requestId}:`);
      console.log(`Instance: ${request.instance_name}`);
      console.log(`Database: ${request.database_name}`);
      console.log(`Query: ${request.query_text}`);

      // Update status to EXECUTING
      await this.updateRequestStatus(requestId, 'EXECUTING');

      // Execute the query on target database
      executionResult = await executeTargetQuery(
        request.db_instance_id,
        request.database_name,
        request.query_text
      );

      // Determine final status
      const finalStatus = executionResult.success ? 'EXECUTED' : 'FAILED';
      
      // Update request status
      await this.updateRequestStatus(requestId, finalStatus);

      // Log execution result
      await this.logExecution(requestId, executionResult);

      return {
        requestId,
        success: executionResult.success,
        status: finalStatus,
        executionTime: executionResult.executionTime,
        rowCount: executionResult.rowCount || 0,
        output: this.formatOutput(executionResult),
        error: executionResult.error || null
      };

    } catch (error) {
      console.error(`PostgreSQL execution failed for request ${requestId}:`, error.message);
      
      // Update status to FAILED
      await this.updateRequestStatus(requestId, 'FAILED');
      
      // Log the failure
      await this.logExecution(requestId, {
        success: false,
        error: error.message,
        executionTime: 0
      });

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

  // Update request status in database
  async updateRequestStatus(requestId, status) {
    try {
      await query(
        'UPDATE query_requests SET status = $1 WHERE id = $2',
        [status, requestId]
      );
      console.log(`Updated request ${requestId} status to ${status}`);
    } catch (error) {
      console.error(`Failed to update request ${requestId} status:`, error.message);
      throw error;
    }
  }

  // Log execution result to execution_logs table
  async logExecution(requestId, executionResult) {
    try {
      const logResult = await query(
        `INSERT INTO execution_logs 
         (request_id, success, output, error, execution_time_ms) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        [
          requestId,
          executionResult.success,
          this.formatOutput(executionResult),
          executionResult.error || null,
          executionResult.executionTime || 0
        ]
      );
      
      console.log(`Logged execution result for request ${requestId}, log ID: ${logResult.rows[0].id}`);
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

    // For large result sets, truncate and show summary
    if (executionResult.rows.length > 100) {
      return `Query executed successfully. ${executionResult.rowCount} rows returned. (First 100 rows shown)\n\n` +
             JSON.stringify(executionResult.rows.slice(0, 100), null, 2) +
             `\n\n... and ${executionResult.rowCount - 100} more rows`;
    }

    // For reasonable result sets, show all data
    return `Query executed successfully. ${executionResult.rowCount} rows returned.\n\n` +
           JSON.stringify(executionResult.rows, null, 2);
  }

  // Get execution result for a request
  async getExecutionResult(requestId) {
    try {
      const result = await query(
        `SELECT el.*, qr.status 
         FROM execution_logs el 
         JOIN query_requests qr ON el.request_id = qr.id 
         WHERE el.request_id = $1 
         ORDER BY el.executed_at DESC 
         LIMIT 1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        return {
          status: 'pending',
          message: 'Request not yet executed'
        };
      }

      const log = result.rows[0];
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

  // Execute multiple PostgreSQL queries (for batch processing)
  async executeMultipleQueries(requestIds) {
    const results = [];
    
    for (const requestId of requestIds) {
      try {
        const result = await this.executePostgresQuery(requestId);
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

module.exports = new PostgresExecutionService();