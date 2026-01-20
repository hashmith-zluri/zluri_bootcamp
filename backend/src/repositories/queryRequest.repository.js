const { query } = require('../config/db');

class QueryRequestRepository {
  /**
   * Create a new query request
   * @param {Object} data
   * @returns {Promise<{id: number, status: string}>}
   */
  async create(data) {
    const result = await query(
      `INSERT INTO query_requests
        (requester_id, db_instance_id, database_name, query_text, script_path, comments, pod_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW())
       RETURNING id, status`,
      [data.userId, data.instanceId, data.dbName, data.queryText, data.scriptContent, data.comments, data.podId]
    );
    return result.rows[0];
  }

  /**
   * Get request by ID with basic info
   * @param {number} requestId
   * @returns {Promise<{pod_id: string, status: string}|null>}
   */
  async findById(requestId) {
    const result = await query(
      'SELECT pod_id, status FROM query_requests WHERE id = $1',
      [requestId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get request ownership info
   * @param {number} requestId
   * @returns {Promise<{requester_id: number}|null>}
   */
  async findOwnership(requestId) {
    const result = await query(
      'SELECT requester_id FROM query_requests WHERE id = $1',
      [requestId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get full request details with instance info
   * @param {number} requestId
   * @returns {Promise<Object|null>}
   */
  async findWithInstance(requestId) {
    const result = await query(
      `SELECT qr.*, di.name as instance_name, di.host, di.port, di.engine, di.username, di.password
       FROM query_requests qr 
       JOIN db_instances di ON qr.db_instance_id = di.id 
       WHERE qr.id = $1`,
      [requestId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get request with engine info only
   * @param {number} requestId
   * @returns {Promise<{engine: string, status: string, query_text: string|null, script_path: string|null}|null>}
   */
  async findWithEngine(requestId) {
    const result = await query(
      `SELECT di.engine, qr.status, qr.query_text, qr.script_path
       FROM query_requests qr
       JOIN db_instances di ON qr.db_instance_id = di.id
       WHERE qr.id = $1`,
      [requestId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get request details for Slack notification
   * @param {number} requestId
   * @returns {Promise<Object|null>}
   */
  async findForNotification(requestId) {
    const result = await query(
      `SELECT 
        qr.id, qr.query_text, qr.script_path, qr.database_name,
        u.name AS requester_name, u.email AS requester_email,
        di.name AS instance_name, di.engine AS database_type
       FROM query_requests qr
       JOIN users u ON qr.requester_id = u.id
       JOIN db_instances di ON qr.db_instance_id = di.id
       WHERE qr.id = $1`,
      [requestId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update request status
   * @param {number} requestId
   * @param {string} status
   * @returns {Promise<void>}
   */
  async updateStatus(requestId, status) {
    await query(
      'UPDATE query_requests SET status = $1 WHERE id = $2',
      [status, requestId]
    );
  }

  /**
   * Approve a request
   * @param {number} requestId
   * @param {number} approverId
   * @returns {Promise<{id: number, query_text: string|null, script_path: string|null}|null>}
   */
  async approve(requestId, approverId) {
    const result = await query(
      `UPDATE query_requests
       SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'PENDING'
       RETURNING id, query_text, script_path`,
      [approverId, requestId]
    );
    return result.rows[0] || null;
  }

  /**
   * Reject a request
   * @param {number} requestId
   * @param {number} approverId
   * @param {string} reason
   * @returns {Promise<{id: number}|null>}
   */
  async reject(requestId, approverId, reason) {
    const rejectionComment = reason ? `\n[REJECTED] ${reason}` : '\n[REJECTED] No reason provided';
    const result = await query(
      `UPDATE query_requests
       SET status = 'REJECTED', approved_by = $1, approved_at = NOW(), comments = COALESCE(comments, '') || $3
       WHERE id = $2 AND status = 'PENDING'
       RETURNING id`,
      [approverId, requestId, rejectionComment]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user requests with pagination and filtering
   * @param {number} userId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    const { status = null, sortBy = 'id', limit = null, offset = null } = options;
    
    const validSortFields = ['created_at', 'status', 'database_name', 'approved_at', 'id'];
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXECUTING'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';

    const params = [userId];
    let whereClause = 'qr.requester_id = $1';
    let paramIndex = 2;

    if (status && validStatuses.includes(status.toUpperCase())) {
      whereClause += ` AND qr.status = $${paramIndex}`;
      params.push(status.toUpperCase());
      paramIndex++;
    }

    // Add search functionality for findByUserId
    if (options.search && options.search.trim()) {
      const searchTerm = `%${options.search.trim()}%`;
      
      if (options.searchField === 'all' || !options.searchField) {
        whereClause += ` AND (
          qr.id::text ILIKE $${paramIndex} OR
          qr.database_name ILIKE $${paramIndex} OR
          di.name ILIKE $${paramIndex} OR
          qr.pod_id ILIKE $${paramIndex} OR
          qr.query_text ILIKE $${paramIndex} OR
          qr.script_path ILIKE $${paramIndex} OR
          qr.comments ILIKE $${paramIndex} OR
          TO_CHAR(qr.created_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
          TO_CHAR(qr.created_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
          TO_CHAR(qr.created_at, 'DD/MM/YYYY') ILIKE $${paramIndex} OR
          TO_CHAR(qr.approved_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
          TO_CHAR(qr.approved_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
          TO_CHAR(qr.approved_at, 'DD/MM/YYYY') ILIKE $${paramIndex}
        )`;
        params.push(searchTerm);
        paramIndex++;
      } else {
        // Specific field search
        const fieldMap = {
          'req_id': 'qr.id::text',
          'database_name': 'qr.database_name',
          'instance_name': 'di.name',
          'pod': 'qr.pod_id',
          'query': 'COALESCE(qr.query_text, qr.script_path)',
          'comments': 'qr.comments'
        };
        
        const dbField = fieldMap[options.searchField];
        if (dbField) {
          whereClause += ` AND ${dbField} ILIKE $${paramIndex}`;
          params.push(searchTerm);
          paramIndex++;
        } else if (options.searchField === 'created_at') {
          whereClause += ` AND (
            TO_CHAR(qr.created_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
            TO_CHAR(qr.created_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
            TO_CHAR(qr.created_at, 'DD/MM/YYYY') ILIKE $${paramIndex}
          )`;
          params.push(searchTerm);
          paramIndex++;
        } else if (options.searchField === 'approved_at') {
          whereClause += ` AND (
            TO_CHAR(qr.approved_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
            TO_CHAR(qr.approved_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
            TO_CHAR(qr.approved_at, 'DD/MM/YYYY') ILIKE $${paramIndex}
          )`;
          params.push(searchTerm);
          paramIndex++;
        }
      }
    }

    let sql = `
      SELECT qr.id AS reqid, qr.query_text, qr.script_path, qr.status, qr.database_name,
             qr.comments, qr.created_at, qr.approved_at, qr.pod_id,
             di.name AS instance_name, di.engine AS database_type,
             el.output, el.error, el.execution_time_ms, el.executed_at, el.success
      FROM query_requests qr
      JOIN db_instances di ON qr.db_instance_id = di.id
      LEFT JOIN execution_logs el ON el.request_id = qr.id
      WHERE ${whereClause}
      ORDER BY qr.${safeSortBy} DESC`;

    if (limit !== null && offset !== null) {
      const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 10));
      const safeOffset = Math.max(0, parseInt(offset) || 0);
      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(safeLimit, safeOffset);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get approval requests by PODs with pagination and filtering
   * @param {string[]} managedPods
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByPods(managedPods, options = {}) {
    const { status = null, sortBy = 'id', limit = null, offset = null } = options;
    
    const validSortFields = ['created_at', 'status', 'database_name', 'approved_at', 'id'];
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXECUTING'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';

    const params = [managedPods];
    let whereClause = 'qr.pod_id = ANY($1)';
    let paramIndex = 2;

    if (status && validStatuses.includes(status.toUpperCase())) {
      whereClause += ` AND qr.status = $${paramIndex}`;
      params.push(status.toUpperCase());
      paramIndex++;
    }

    // Add search functionality
    if (options.search && options.search.trim()) {
      const searchTerm = `%${options.search.trim()}%`;
      
      if (options.searchField === 'all' || !options.searchField) {
        whereClause += ` AND (
          qr.id::text ILIKE $${paramIndex} OR
          u.email ILIKE $${paramIndex} OR
          u.name ILIKE $${paramIndex} OR
          qr.database_name ILIKE $${paramIndex} OR
          qr.query_text ILIKE $${paramIndex} OR
          qr.script_path ILIKE $${paramIndex} OR
          qr.comments ILIKE $${paramIndex} OR
          TO_CHAR(qr.created_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
          TO_CHAR(qr.created_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
          TO_CHAR(qr.created_at, 'DD/MM/YYYY') ILIKE $${paramIndex} OR
          TO_CHAR(qr.approved_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
          TO_CHAR(qr.approved_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
          TO_CHAR(qr.approved_at, 'DD/MM/YYYY') ILIKE $${paramIndex}
        )`;
        params.push(searchTerm);
        paramIndex++;
      } else {
        // Specific field search
        const fieldMap = {
          'req_id': 'qr.id::text',
          'requester_email': 'u.email',
          'requester_name': 'u.name',
          'database_name': 'qr.database_name',
          'query': 'COALESCE(qr.query_text, qr.script_path)',
          'comments': 'qr.comments'
        };
        
        const dbField = fieldMap[options.searchField];
        if (dbField) {
          whereClause += ` AND ${dbField} ILIKE $${paramIndex}`;
          params.push(searchTerm);
          paramIndex++;
        } else if (options.searchField === 'created_at') {
          whereClause += ` AND (
            TO_CHAR(qr.created_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
            TO_CHAR(qr.created_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
            TO_CHAR(qr.created_at, 'DD/MM/YYYY') ILIKE $${paramIndex}
          )`;
          params.push(searchTerm);
          paramIndex++;
        } else if (options.searchField === 'approved_at') {
          whereClause += ` AND (
            TO_CHAR(qr.approved_at, 'YYYY-MM-DD') ILIKE $${paramIndex} OR
            TO_CHAR(qr.approved_at, 'Mon DD, YYYY') ILIKE $${paramIndex} OR
            TO_CHAR(qr.approved_at, 'DD/MM/YYYY') ILIKE $${paramIndex}
          )`;
          params.push(searchTerm);
          paramIndex++;
        }
      }
    }

    let sql = `
      SELECT qr.id AS reqid, qr.query_text, qr.script_path, qr.status, qr.database_name,
             qr.comments, qr.pod_id, qr.created_at, qr.approved_at,
             u.email AS requester_email, u.name AS requester_name,
             di.name AS instance_name, di.engine AS database_type,
             el.output, el.error, el.execution_time_ms, el.executed_at, el.success
      FROM query_requests qr
      JOIN users u ON qr.requester_id = u.id
      JOIN db_instances di ON qr.db_instance_id = di.id
      LEFT JOIN execution_logs el ON el.request_id = qr.id
      WHERE ${whereClause}
      ORDER BY qr.${safeSortBy} DESC`;

    if (limit !== null && offset !== null) {
      const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 10));
      const safeOffset = Math.max(0, parseInt(offset) || 0);
      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(safeLimit, safeOffset);
    }

    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = new QueryRequestRepository();
