const { query } = require("../config/db");

const submitRequest = async (req, res) => {

  const {
    instance_id,
    db_name,
    query: queryText,
    comments,
    pod_id
  } = req.body || {};

  /* istanbul ignore next */
  const userId = req.user?.id;
  const scriptFile = req.file; // Now contains buffer, not file path

  if (
    instance_id === undefined ||
    !db_name ||
    !comments ||
    !pod_id ||
    !userId
  ) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  const hasQuery = Boolean(queryText);
  const hasScript = Boolean(scriptFile && scriptFile.buffer);

  if (!hasQuery && !hasScript) {
    return res.status(400).json({
      success: false,
      message: "Either query or script file must be provided"
    });
  }

  if (hasQuery && hasScript) {
    return res.status(400).json({
      success: false,
      message: "Provide either query or script file, not both"
    });
  }

  try {
    // Convert script buffer to string if script is provided
    const scriptContent = hasScript ? scriptFile.buffer.toString('utf8') : null;
    
    const result = await query(
      `
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
      `,
      [
        userId,
        instance_id,
        db_name,
        hasQuery ? queryText : null,
        hasScript ? scriptContent : null, // Store script content instead of path
        comments,
        pod_id
      ]
    );

    return res.status(201).json({
      success: true,
      req_id: result.rows[0].id,
      status: result.rows[0].status
    });

  } catch (error) {
    console.error("Submit request failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit request"
    });
  }
};

const getMyRequests = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {
    const result = await query(
      `
      SELECT
        qr.id AS reqid,
        qr.query_text,
        qr.script_path,
        qr.status,
        qr.database_name,
        qr.comments,
        qr.created_at,
        qr.approved_at,
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
      WHERE qr.requester_id = $1
      ORDER BY qr.created_at DESC
      `,
      [userId]
    );

    const requests = result.rows.map(row => ({
      req_id: row.reqid,
      query: row.query_text,
      script: row.script_path,
      status: row.status,
      database_name: row.database_name,
      comments: row.comments,
      created_at: row.created_at,
      approved_at: row.approved_at,
      instance_name: row.instance_name,
      database_type: row.database_type,
      result: row.executed_at
        ? {
            output: row.output,
            response_time: row.execution_time_ms,
            status: row.success ? "success" : "failure",
            error: row.error,
            executed_at: row.executed_at
          }
        : null
    }));

    return res.status(200).json({ success: true, requests });

  } catch (error) {
    console.error("Fetch user requests failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch requests"
    });
  }
};

module.exports = {
  submitRequest,
  getMyRequests
};
