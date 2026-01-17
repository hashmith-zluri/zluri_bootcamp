const requestService = require("../services/request.service");
const slackService = require("../services/slack.service");

// Validation helpers
const validateRequiredFields = (req) => {
  const { instance_id, db_name, comments, pod_id } = req.body || {};
  const userId = req.user?.id;
  
  const requiredFields = [
    { key: "instance_id", value: instance_id, condition: instance_id !== undefined },
    { key: "db_name", value: db_name },
    { key: "comments", value: comments },
    { key: "pod_id", value: pod_id },
    { key: "userId", value: userId }
  ];
  
  return requiredFields
    .filter(field => !field.condition && !field.value)
    .map(field => field.key);
};

const validateRequestContent = (queryText, scriptFile) => {
  const hasQuery = Boolean(queryText);
  const hasScript = Boolean(scriptFile && scriptFile.buffer);
  
  const validationRules = [
    {
      condition: !hasQuery && !hasScript,
      message: "Either query or script file must be provided"
    },
    {
      condition: hasQuery && hasScript,
      message: "Provide either query or script file, not both"
    },
    {
      condition: hasQuery && queryText.trim().length === 0,
      message: "Query cannot be empty or contain only spaces"
    },
    {
      condition: hasScript && scriptFile.buffer.toString('utf8').trim().length === 0,
      message: "Script file cannot be empty or contain only spaces"
    }
  ];
  
  const failedRule = validationRules.find(rule => rule.condition);
  return failedRule ? { error: failedRule.message } : { hasQuery, hasScript };
};

const createErrorResponse = (res, status, message, extraData = {}) => {
  return res.status(status).json({
    success: false,
    message,
    ...extraData
  });
};

const sendSlackNotification = async (createdRequest, user, requestData) => {
  if (!slackService.isEnabled()) return;

  try {
    const requestForNotification = await requestService.getRequestForNotification(createdRequest.id);
    if (!requestForNotification) return;

    const PODS = [
      { id: 'pod-1', name: 'Pod 1' },
      { id: 'de', name: 'DE' },
      { id: 'db', name: 'DB' },
    ];
    
    const pod = PODS.find(p => p.id === requestData.pod_id);
    const podName = pod ? pod.name : requestData.pod_id;

    await slackService.notifyNewSubmission({
      req_id: createdRequest.id,
      requester_name: user.name,
      requester_email: user.email,
      database_type: requestForNotification.database_type,
      database_name: requestData.db_name,
      instance_name: requestForNotification.instance_name,
      query: requestData.queryText,
      script: requestData.scriptContent,
      pod_name: podName
    });
  } catch (slackError) {
    console.error('Slack notification failed:', slackError.message);
  }
};

const submitRequest = async (req, res) => {
  const { instance_id, db_name, query: queryText, comments, pod_id } = req.body || {};
  const scriptFile = req.file;

  // Validate required fields
  const missingFields = validateRequiredFields(req);
  if (missingFields.length > 0) {
    return createErrorResponse(res, 400, "Missing required fields", {
      missing_fields: missingFields
    });
  }

  // Validate request content
  const contentValidation = validateRequestContent(queryText, scriptFile);
  if (contentValidation.error) {
    return createErrorResponse(res, 400, contentValidation.error);
  }

  const { hasQuery, hasScript } = contentValidation;

  try {
    const scriptContent = hasScript ? scriptFile.buffer.toString('utf8') : null;
    
    const createdRequest = await requestService.createRequest({
      userId: req.user.id,
      instanceId: instance_id,
      dbName: db_name,
      queryText: hasQuery ? queryText : null,
      scriptContent,
      comments,
      podId: pod_id
    });

    // Send Slack notification
    await sendSlackNotification(createdRequest, req.user, {
      db_name,
      pod_id,
      queryText,
      scriptContent
    });

    return res.status(201).json({
      success: true,
      req_id: createdRequest.id,
      status: createdRequest.status
    });

  } catch (error) {
    console.error("Submit request failed:", error);
    return createErrorResponse(res, 500, "Failed to submit request");
  }
};

const getMyRequests = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return createErrorResponse(res, 401, "Unauthorized");
  }

  try {
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
    return createErrorResponse(res, 500, "Failed to fetch requests");
  }
};

module.exports = {
  submitRequest,
  getMyRequests
};
