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
  const scriptFile = req.file;

  const miss = [];

  if (instance_id === undefined) miss.push("instance_id");
  if (!db_name) miss.push("db_name");
  if (!comments) miss.push("comments");
  if (!pod_id) miss.push("pod_id");
  if (!userId) miss.push("userId");

  if (miss.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
      missing_fields: miss
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
    // Query params validated by Zod middleware
    const { status, sortBy, limit, offset } = req.query;

    const rows = await requestService.getUserRequests(userId, {
      status,
      sortBy,
      limit,
      offset
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
      pod_id: row.pod_id,
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
