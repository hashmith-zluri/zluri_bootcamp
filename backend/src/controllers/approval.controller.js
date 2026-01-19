const pods = require("../config/pods");
const executionService = require("../services/execution.service");
const approvalService = require("../services/approval.service");
const slackService = require("../services/slack.service");

// Helper functions
const createErrorResponse = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message
  });
};

const createSuccessResponse = (res, data, status = 200) => {
  return res.status(status).json({
    success: true,
    ...data
  });
};

const getManagedPods = (managerEmail) => {
  return pods
    .filter(pod => pod.manager_email === managerEmail)
    .map(pod => pod.id);
};

const validateManagerAccess = (role, managedPods) => {
  const allowedRoles = ["MANAGER"];
  
  if (!allowedRoles.includes(role)) {
    return { valid: false, error: "Access denied", status: 403 };
  }
  
  // Don't fail if no pods - just return empty array (original behavior)
  return { valid: true };
};

const validateRequestAccess = (request, managedPods) => {
  if (!request) {
    return { valid: false, error: "Request not found", status: 404 };
  }
  
  if (request.status !== 'PENDING') {
    return { 
      valid: false, 
      error: `Request already processed. Current status: ${request.status}`, 
      status: 400 
    };
  }
  
  if (!managedPods.includes(request.pod_id)) {
    return { 
      valid: false, 
      error: "Access denied - request belongs to different POD", 
      status: 403 
    };
  }
  
  return { valid: true };
};

const triggerExecution = async (req_id, approvedRequest) => {
  // Only trigger execution if there's something to execute
  if (!approvedRequest.query_text && !approvedRequest.script_path) {
    console.log(`No query or script to execute for request ${req_id}`);
    return { success: false, error: 'No query or script to execute' };
  }
  
  const executionType = approvedRequest.query_text ? 'query' : 'script';
  console.log(`Triggering ${executionType} execution for approved request ${req_id}`);
  
  try {
    // Start execution asynchronously but ensure it's properly queued
    const executionPromise = executionService.executeQuery(req_id);
    
    // Handle the promise asynchronously without blocking the response
    executionPromise
      .then(result => {
        console.log(`${executionType} execution completed for request ${req_id}:`, result.success ? 'SUCCESS' : 'FAILED');
      })
      .catch(error => {
        console.error(`${executionType} execution error for request ${req_id}:`, error.message);
        // Update status to failed if execution encounters an error
        approvalService.updateRequestStatus(req_id, 'FAILED')
          .catch(statusError => {
            console.error(`Failed to update status for request ${req_id}:`, statusError);
          });
      });
    
    return { success: true, message: 'Execution queued successfully' };
  } catch (error) {
    console.error(`Failed to queue execution for request ${req_id}:`, error);
    // Update status to indicate execution failed to start
    try {
      await approvalService.updateRequestStatus(req_id, 'FAILED');
    } catch (statusError) {
      console.error(`Failed to update status for request ${req_id}:`, statusError);
    }
    return { success: false, error: error.message };
  }
};

const sendRejectionNotification = async (req_id, reason, requestPodId) => {
  if (!slackService.isEnabled()) return;

  try {
    const requestData = await approvalService.getRequestForNotification(req_id);
    if (!requestData) return;

    const pod = pods.find(p => p.id === requestPodId);
    const podName = pod ? pod.name : requestPodId;

    await slackService.notifyRejection({
      req_id: requestData.id,
      requester_name: requestData.requester_name,
      requester_email: requestData.requester_email,
      database_type: requestData.database_type,
      database_name: requestData.database_name,
      instance_name: requestData.instance_name,
      query: requestData.query_text,
      script: requestData.script_path,
      pod_name: podName
    }, reason);
  } catch (slackError) {
    console.error('Slack notification failed:', slackError.message);
  }
};

const getApprovalRequests = async (req, res) => {
  const { email: managerEmail, role } = req.user || {};
  const managedPods = getManagedPods(managerEmail);
  
  const accessValidation = validateManagerAccess(role, managedPods);
  if (!accessValidation.valid) {
    return createErrorResponse(res, accessValidation.status, accessValidation.error);
  }

  // Return empty array if no managed pods (original behavior)
  if (managedPods.length === 0) {
    return createSuccessResponse(res, { requests: [] });
  }

  try {
    const { status, sortBy, limit, offset } = req.query;
    const rows = await approvalService.getApprovalRequestsByPods(managedPods, {
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
      pod_id: row.pod_id,
      created_at: row.created_at,
      approved_at: row.approved_at,
      requester_email: row.requester_email,
      requester_name: row.requester_name,
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

    return createSuccessResponse(res, { requests });

  } catch (error) {
    console.error("Approval list fetch failed:", error);
    return createErrorResponse(res, 500, "Failed to fetch approval requests");
  }
};

const approveOrReject = async (req, res) => {
  const { req_id } = req.params;
  const { action, reason } = req.body;
  const { id: approverId, email: managerEmail, role } = req.user || {};
  
  const managedPods = getManagedPods(managerEmail);
  const accessValidation = validateManagerAccess(role, managedPods);
  
  if (!accessValidation.valid) {
    return createErrorResponse(res, accessValidation.status, accessValidation.error);
  }

  // Check if manager has pods assigned
  if (managedPods.length === 0) {
    return createErrorResponse(res, 403, "Access denied - no PODs assigned");
  }

  try {
    const request = await approvalService.getRequestById(req_id);
    const requestValidation = validateRequestAccess(request, managedPods);
    
    if (!requestValidation.valid) {
      return createErrorResponse(res, requestValidation.status, requestValidation.error);
    }

    // Action handlers
    const actionHandlers = {
      approve: async () => {
        const approvedRequest = await approvalService.approveRequest(req_id, approverId);
        
        if (!approvedRequest) {
          return createErrorResponse(res, 404, "Request not found or already processed");
        }
        
        const executionResult = await triggerExecution(req_id, approvedRequest);
        
        if (!executionResult.success) {
          console.warn(`Execution failed to start for request ${req_id}: ${executionResult.error}`);
          // Still return success for approval, but log the execution issue
        }
        
        return createSuccessResponse(res, { 
          status: "approved"
        });
      },
      
      reject: async () => {
        const rejectedRequest = await approvalService.rejectRequest(req_id, approverId, reason);
        
        if (!rejectedRequest) {
          return createErrorResponse(res, 404, "Request not found or already processed");
        }

        await approvalService.logRejection(req_id, reason);
        await sendRejectionNotification(req_id, reason, request.pod_id);
        
        return createSuccessResponse(res, {
          status: "rejected",
          reason: reason || null
        });
      }
    };

    const handler = actionHandlers[action];
    if (!handler) {
      return createErrorResponse(res, 400, "Invalid action");
    }

    return await handler();

  } catch (error) {
    console.error("Approval action failed:", error);
    return createErrorResponse(res, 500, "Approval action failed");
  }
};
  
const getExecutionResult = async (req, res) => {
  const { req_id } = req.params;
  const { id: userId, role: userRole } = req.user || {};

  try {
    const request = await approvalService.getRequestOwnership(req_id);

    if (!request) {
      return createErrorResponse(res, 404, "Request not found");
    }

    const hasAccess = request.requester_id === userId || ['MANAGER', 'ADMIN'].includes(userRole);
    if (!hasAccess) {
      return createErrorResponse(res, 403, "Access denied");
    }

    const result = await executionService.getExecutionResult(req_id);
    return createSuccessResponse(res, result);

  } catch (error) {
    console.error(`Failed to get execution result for request ${req_id}:`, error);
    return createErrorResponse(res, 500, "Failed to get execution result");
  }
};

module.exports = {
  getApprovalRequests,
  approveOrReject,
  getExecutionResult
};
