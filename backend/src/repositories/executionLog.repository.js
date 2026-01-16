const { query } = require('../config/db');

class ExecutionLogRepository {
  /**
   * Create execution log entry
   * @param {Object} logData
   * @param {number} logData.requestId
   * @param {boolean} logData.success
   * @param {string|null} logData.output
   * @param {string|null} logData.error
   * @param {number} logData.executionTimeMs
   * @returns {Promise<{id: number}>}
   */
  async create(logData) {
    const result = await query(
      `INSERT INTO execution_logs 
       (request_id, success, output, error, execution_time_ms) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [logData.requestId, logData.success, logData.output, logData.error, logData.executionTimeMs]
    );
    return result.rows[0];
  }

  /**
   * Get latest execution log for a request
   * @param {number} requestId
   * @returns {Promise<Object|null>}
   */
  async findLatestByRequestId(requestId) {
    const result = await query(
      `SELECT el.*, qr.status 
       FROM execution_logs el 
       JOIN query_requests qr ON el.request_id = qr.id 
       WHERE el.request_id = $1 
       ORDER BY el.executed_at DESC 
       LIMIT 1`,
      [requestId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get latest script execution log for a request
   * @param {number} requestId
   * @returns {Promise<Object|null>}
   */
  async findLatestScriptExecution(requestId) {
    const result = await query(
      `SELECT el.*, qr.status, qr.script_path 
       FROM execution_logs el 
       JOIN query_requests qr ON el.request_id = qr.id 
       WHERE el.request_id = $1 AND qr.script_path IS NOT NULL
       ORDER BY el.executed_at DESC 
       LIMIT 1`,
      [requestId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new ExecutionLogRepository();
