const requestService = require("../services/request.service");

const submitRequest = async (req, res) => {
  const {
    instance_id,
    db_name,
    query: queryText,
    comments,
    pod_id
  } = req.body || {};

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
    
    const createdRequest = await requestService.createRequest({
      userId,
      instanceId: instance_id,
      dbName: db_name,
      queryText: hasQuery ? queryText : null,
      scriptContent,
      comments,
      podId: pod_id
    });

    return res.status(201).json({
      success: true,
      req_id: createdRequest.id,
      status: createdRequest.status
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
    // Extract query parameters
    const {
      status,
      sortBy,
      limit,
      offset
    } = req.query;

    // Validate limit and offset if provided
    if (limit !== undefined && parseInt(limit) < 0) {
      return res.status(400).json({
        success: false,
        message: "Limit cannot be negative"
      });
    }

    if (offset !== undefined && parseInt(offset) < 0) {
      return res.status(400).json({
        success: false,
        message: "Offset cannot be negative"
      });
    }

    const rows = await requestService.getUserRequests(userId, {
      status,
      sortBy,
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : null
    });

    const requests = rows.map(row => ({
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

    return res.status(200).json({
      success: true,
      requests
    });

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
