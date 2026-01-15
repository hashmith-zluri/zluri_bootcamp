const { query } = require("../config/db");

/**
 * Submit a new query or script request
 * @param {Object} requestData - Request submission data
 * @param {number} requestData.userId - User ID of the requester
 * @param {number} requestData.instanceId - Database instance ID
 * @param {string} requestData.dbName - Database name
 * @param {string|null} requestData.queryText - SQL query text (null if script)
 * @param {string|null} requestData.scriptContent - Script content (null if query)
 * @param {string} requestData.comments - Request comments
 * @param {string} requestData.podId - POD ID
 * @returns {Promise<Object>} Created request with ID and status
 */
const createRequest = async (requestData) => {
  const {
    userId,
    instanceId,
    dbName,
    queryText,
    scriptContent,
    comments,
    podId
  } = requestData;

  const sql = `
    INSERT INTO query_requests
      (
        requester_id,
        db_instance_id,
        database_name,
        query_text,
        script_path,
        comments,
        pod_id,
        status
      )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
    RETURNING id, status
  `;

  const result = await query(sql, [
    userId,
    instanceId,
    dbName,
    queryText,
    scriptContent, // Store script content instead of path
    comments,
    podId
  ]);

  return result.rows[0];
};

/**
 * Get all requests for a specific user with pagination, sorting, and filtering
 * @param {number} userId - User ID to fetch requests for
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status (PENDING, APPROVED, REJECTED, EXECUTED, FAILED)
 * @param {string} options.sortBy - Sort field (created_at, status, database_name)
 * @param {number} options.limit - Number of records per page
 * @param {number} options.offset - Number of records to skip
 * @returns {Promise<Object[]>} Array of user requests
 */
const getUserRequests = async (userId, options = {}) => {
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
  const whereConditions = ['qr.requester_id = $1'];
  const queryParams = [userId];
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
      qr.created_at,
      qr.approved_at,
      qr.pod_id,
      di.name AS instance_name,
      di.engine AS database_type,
      el.output,
      el.error,
      el.execution_time_ms,
      el.executed_at,
      el.success
    FROM query_requests qr
    JOIN db_instances di
      ON qr.db_instance_id = di.id
    LEFT JOIN execution_logs el
      ON el.request_id = qr.id
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

module.exports = {
  createRequest,
  getUserRequests
};