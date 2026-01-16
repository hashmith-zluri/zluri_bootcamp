const pods = require("../config/pods");
const executionService = require("../services/execution.service");
const approvalService = require("../services/approval.service");
const slackService = require("../services/slack.service");

const getApprovalRequests = async (req, res) => {
  const managerEmail = req.user?.email;
  const role = req.user?.role;

  const allowedRoles = ["MANAGER"];
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const managedPods = pods
    .filter(pod => pod.manager_email === managerEmail)
    .map(pod => pod.id);

  if (managedPods.length === 0) {
    return res.status(200).json({
      success: true,
      requests: []
    });
  }

  try {
    // Query params validated by Zod middleware
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

    return res.status(200).json({
      success: true,
      requests
    });

  } catch (error) {
    console.error("Approval list fetch failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch approval requests"
    });
  }
};

const approveOrReject = async (req, res) => {
    const { req_id } = req.params;
    const { action, reason } = req.body;
    const approverId = req.user?.id;
    const managerEmail = req.user?.email;
    const role = req.user?.role;
  
    if (role !== "MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const managedPods = pods
      .filter(pod => pod.manager_email === managerEmail)
      .map(pod => pod.id);

    if (managedPods.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied - no PODs assigned"
      });
    }
  
    try {
      const request = await approvalService.getRequestById(req_id);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Request not found"
        });
      }

      if (request.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          message: `Request already processed. Current status: ${request.status}`
        });
      }

      const requestPodId = request.pod_id;
      if (!managedPods.includes(requestPodId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied - request belongs to different POD"
        });
      }

      if (action === "approve") {
        const approvedRequest = await approvalService.approveRequest(req_id, approverId);

        if (!approvedRequest) {
          return res.status(404).json({
            success: false,
            message: "Request not found or already processed"
          });
        }
        
        if (approvedRequest.query_text) {
          console.log(`Triggering query execution for approved request ${req_id}`);
          executionService.executeQuery(req_id)
            .then(result => /*istanbul ignore next*/{
              console.log(`Query execution completed for request ${req_id}:`, result.success ? 'SUCCESS' : 'FAILED');
            })
            .catch(error => /*istanbul ignore next*/{
              console.error(`Query execution error for request ${req_id}:`, error.message);
            });
        } else if (approvedRequest.script_path) {
          console.log(`Triggering script execution for approved request ${req_id}`);
          executionService.executeQuery(req_id)
            .then(result => /*istanbul ignore next*/{
              console.log(`Script execution completed for request ${req_id}:`, result.success ? 'SUCCESS' : 'FAILED');
            })
            .catch(error => /*istanbul ignore next*/{
              console.error(`Script execution error for request ${req_id}:`, error.message);
            });
        }

        return res.status(200).json({ success: true, status: "approved" });
      }

      if (action === "reject") {
        const rejectedRequest = await approvalService.rejectRequest(req_id, approverId, reason);
        
        if (!rejectedRequest) {
          return res.status(404).json({
            success: false,
            message: "Request not found or already processed"
          });
        }

        await approvalService.logRejection(req_id, reason);

        // Send Slack notification for rejection
        if (slackService.isEnabled()) {
          try {
            // Fetch complete request data for notification
            const requestData = await approvalService.getRequestForNotification(req_id);
            
            if (requestData) {
              // Get pod name from pod_id
              const pod = pods.find(p => p.id === requestPodId);
              const podName = pod ? pod.name : requestPodId;

              await slackService.notifyRejection({
                req_id: rejectedRequest.id,
                requester_name: requestData.requester_name,
                requester_email: requestData.requester_email,
                database_type: requestData.database_type,
                database_name: requestData.database_name,
                instance_name: requestData.instance_name,
                query: requestData.query_text,
                script: requestData.script_path,
                pod_name: podName
              }, reason);
            }
          } catch (slackError) {
            console.error('Slack notification failed:', slackError.message);
          }
        }
  
        return res.status(200).json({
          success: true,
          status: "rejected",
          reason: reason || null
        });
      }
  
    } catch (error) {
      console.error("Approval action failed:", error);
      return res.status(500).json({
        success: false,
        message: "Approval action failed"
      });
    }
  };
  
const getExecutionResult = async (req, res) => {
  const { req_id } = req.params;
  const userId = req.user?.id;

  try {
    const request = await approvalService.getRequestOwnership(req_id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }
    const userRole = req.user?.role;

    if (request.requester_id !== userId && !['MANAGER', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const result = await executionService.getExecutionResult(req_id);
    return res.status(200).json({ success: true, ...result });

  } catch (error) {
    console.error(`Failed to get execution result for request ${req_id}:`, error);
    return res.status(500).json({
      success: false,
      message: "Failed to get execution result"
    });
  }
};

module.exports = {
  getApprovalRequests,
  approveOrReject,
  getExecutionResult
};
