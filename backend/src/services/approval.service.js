const { query } = require("../config/db");

/**
 * Get approval requests for specific PODs with pagination, sorting, and filtering
 * @param {string[]} managedPods - Array of POD IDs that the manager manages
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status (PENDING, APPROVED, REJECTED, EXECUTED, FAILED)
 * @param {string} options.sortBy - Sort field (created_at, status, database_name)
 * @param {number} options.limit - Number of records per page
 * @param {number} options.offset - Number of records to skip
 * @returns {Promise<Object[]>} Array of approval requests
 */
const getApprovalRequestsByPods = async (managedPods, options = {}) => {
  const {
    status = null,
    sortBy = 'created_at',
    limit = null,
    offset = null
  } = options;

  // Validate and sanitize inputs
  const validSortFields = ['created_at', 'status', 'database_name', 'approved_at'];
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXECUTING'];

  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';

  // Build WHERE clause
  const whereConditions = ['qr.pod_id = ANY($1)'];
  const queryParams = [managedPods];
  let paramIndex = 2;

  if (status && validStatuses.includes(status.toUpperCase())) {
    whereConditions.push(`qr.status = $${paramIndex}`);
    queryParams.push(status.toUpperCase());
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  // Build query - always sort DESC
  let dataSql = `
    SELECT
      qr.id AS reqid,
      qr.query_text,
      qr.script_path,
      qr.status,
      qr.database_name,
      qr.comments,
      qr.pod_id,
      qr.created_at,
      qr.approved_at,
      u.email AS requester_email,
      u.name AS requester_name,
      di.name AS instance_name,
      di.engine AS database_type,
      el.output,
      el.error,
      el.execution_time_ms,
      el.executed_at,
      el.success
    FROM query_requests qr
    JOIN users u ON qr.requester_id = u.id
    JOIN db_instances di ON qr.db_instance_id = di.id
    LEFT JOIN execution_logs el ON el.request_id = qr.id
    WHERE ${whereClause}
    ORDER BY qr.${safeSortBy} DESC
  `;
  
  // Add pagination only if limit and offset are provided
  if (limit !== null && offset !== null) {
    const parsedLimit = parseInt(limit) || 10;
    const safeLimit = Math.max(1, Math.min(100, parsedLimit));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    dataSql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(safeLimit, safeOffset);
  }

  const dataResult = await query(dataSql, queryParams);
  return dataResult.rows;
};

/**
 * Get request details by ID for POD ownership verification
 * @param {number} requestId - The request ID
 * @returns {Promise<Object|null>} Request details or null if not found
 */
const getRequestById = async (requestId) => {
  const sql = `
    SELECT pod_id, status
    FROM query_requests 
    WHERE id = $1
  `;
  
  const result = await query(sql, [requestId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Approve a request
 * @param {number} requestId - The request ID
 * @param {number} approverId - The manager's user ID
 * @returns {Promise<Object|null>} Approved request details or null if not found
 */
const approveRequest = async (requestId, approverId) => {
  const sql = `
    UPDATE query_requests
    SET status = 'APPROVED',
        approved_by = $1,
        approved_at = NOW()
    WHERE id = $2 AND status = 'PENDING'
    RETURNING id, query_text, script_path
  `;
  
  const result = await query(sql, [approverId, requestId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Reject a request with reason
 * @param {number} requestId - The request ID
 * @param {number} approverId - The manager's user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object|null>} Rejected request details or null if not found
 */
const rejectRequest = async (requestId, approverId, reason) => {
  const rejectionComment = reason ? `\n[REJECTED] ${reason}` : '\n[REJECTED] No reason provided';
  
  const sql = `
    UPDATE query_requests
    SET status = 'REJECTED',
        approved_by = $1,
        approved_at = NOW(),
        comments = COALESCE(comments, '') || $3
    WHERE id = $2 AND status = 'PENDING'
    RETURNING id
  `;
  
  const result = await query(sql, [approverId, requestId, rejectionComment]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Log rejection for audit purposes
 * @param {number} requestId - The request ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<void>}
 */
const logRejection = async (requestId, reason) => {
  const sql = `
    INSERT INTO execution_logs 
    (request_id, success, output, error, execution_time_ms) 
    VALUES ($1, $2, $3, $4, $5)
  `;
  
  await query(sql, [
    requestId,
    false,
    null,
    `Request rejected by manager. Reason: ${reason || 'No reason provided'}`,
    0
  ]);
};

/**
 * Get request ownership details for access control
 * @param {number} requestId - The request ID
 * @returns {Promise<Object|null>} Request ownership details or null if not found
 */
const getRequestOwnership = async (requestId) => {
  const sql = `
    SELECT requester_id 
    FROM query_requests 
    WHERE id = $1
  `;
  
  const result = await query(sql, [requestId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

module.exports = {
  getApprovalRequestsByPods,
  getRequestById,
  approveRequest,
  rejectRequest,
  logRejection,
  getRequestOwnership
};