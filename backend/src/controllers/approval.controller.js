const { query } = require("../config/db");
const pods = require("../config/pods");
const executionService = require("../services/execution.service");

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
    return res.status(200).json({ success: true, requests: [] });
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
      WHERE qr.pod_id = ANY($1)
      ORDER BY qr.created_at DESC
      `,
      [managedPods]
    );

    const requests = result.rows.map(row => ({
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

    return res.status(200).json({ success: true, requests });

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

    // Get manager's managed PODs
    const managedPods = pods
      .filter(pod => pod.manager_email === managerEmail)
      .map(pod => pod.id);

    if (managedPods.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied - no PODs assigned"
      });
    }
  
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action"
      });
    }
  
    try {
      // Verify manager owns the POD for this request
      const requestCheck = await query(
        'SELECT pod_id FROM query_requests WHERE id = $1 AND status = \'PENDING\'',
        [req_id]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Request not found or already processed"
        });
      }

      const requestPodId = requestCheck.rows[0].pod_id;
      if (!managedPods.includes(requestPodId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied - request belongs to different POD"
        });
      }

      if (action === "approve") {
        // Update request status to APPROVED
        const updateResult = await query(
          `
          UPDATE query_requests
          SET status = 'APPROVED',
              approved_by = $1,
              approved_at = NOW()
          WHERE id = $2 AND status = 'PENDING'
          RETURNING id, query_text, script_path
          `,
          [approverId, req_id]
        );

        if (updateResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Request not found or already processed"
          });
        }

        const request = updateResult.rows[0];
        
        // Trigger execution for approved requests
        if (request.query_text) {
          console.log(`Triggering query execution for approved request ${req_id}`);
          
          // Execute query asynchronously (don't wait for completion)
          executionService.executeQuery(req_id)
            .then(result => /*istanbul ignore next*/{
              console.log(`Query execution completed for request ${req_id}:`, result.success ? 'SUCCESS' : 'FAILED');
            })
            .catch(error => /*istanbul ignore next*/{
              console.error(`Query execution error for request ${req_id}:`, error.message);
            });
        } else if (request.script_path) {
          console.log(`Triggering script execution for approved request ${req_id}`);
          
          // Execute script asynchronously - executionService handles routing to correct engine
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
        // Update request status to REJECTED and store rejection reason
        const rejectionComment = reason ? `\n[REJECTED] ${reason}` : '\n[REJECTED] No reason provided';
        
        const updateResult = await query(
          `
          UPDATE query_requests
          SET status = 'REJECTED',
              approved_by = $1,
              approved_at = NOW(),
              comments = COALESCE(comments, '') || $3
          WHERE id = $2 AND status = 'PENDING'
          RETURNING id
          `,
          [approverId, req_id, rejectionComment]
        );
        //istanbul ignore next/
        if (updateResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Request not found or already processed"
          });
        }

        // Log the rejection for audit purposes
        await query(
          `INSERT INTO execution_logs 
           (request_id, success, output, error, execution_time_ms) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req_id,
            false,
            null,
            `Request rejected by manager. Reason: ${reason || 'No reason provided'}`,
            0
          ]
        );
  
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
    // Verify user owns this request or is a manager/admin
    const requestResult = await query(
      'SELECT requester_id FROM query_requests WHERE id = $1',
      [req_id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    const request = requestResult.rows[0];
    const userRole = req.user?.role;

    // Check access permissions
    if (request.requester_id !== userId && !['MANAGER', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Get execution result
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
  
