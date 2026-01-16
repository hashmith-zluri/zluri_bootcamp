const QueryRequestRepository = require("../repositories/queryRequest.repository");
const ExecutionLogRepository = require("../repositories/executionLog.repository");

/**
 * Get approval requests for specific PODs with pagination, sorting, and filtering
 * @param {string[]} managedPods - Array of POD IDs that the manager manages
 * @param {Object} options - Query options
 * @returns {Promise<Object[]>} Array of approval requests
 */
const getApprovalRequestsByPods = async (managedPods, options = {}) => {
  return await QueryRequestRepository.findByPods(managedPods, options);
};

/**
 * Get request details by ID for POD ownership verification
 * @param {number} requestId - The request ID
 * @returns {Promise<Object|null>} Request details or null if not found
 */
const getRequestById = async (requestId) => {
  return await QueryRequestRepository.findById(requestId);
};

/**
 * Approve a request
 * @param {number} requestId - The request ID
 * @param {number} approverId - The manager's user ID
 * @returns {Promise<Object|null>} Approved request details or null if not found
 */
const approveRequest = async (requestId, approverId) => {
  return await QueryRequestRepository.approve(requestId, approverId);
};

/**
 * Reject a request with reason
 * @param {number} requestId - The request ID
 * @param {number} approverId - The manager's user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object|null>} Rejected request details or null if not found
 */
const rejectRequest = async (requestId, approverId, reason) => {
  return await QueryRequestRepository.reject(requestId, approverId, reason);
};

/**
 * Log rejection for audit purposes
 * @param {number} requestId - The request ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<void>}
 */
const logRejection = async (requestId, reason) => {
  await ExecutionLogRepository.create({
    requestId,
    success: false,
    output: null,
    error: `Request rejected by manager. Reason: ${reason || 'No reason provided'}`,
    executionTimeMs: 0
  });
};

/**
 * Get request ownership details for access control
 * @param {number} requestId - The request ID
 * @returns {Promise<Object|null>} Request ownership details or null if not found
 */
const getRequestOwnership = async (requestId) => {
  return await QueryRequestRepository.findOwnership(requestId);
};

/**
 * Get request details for notification
 * @param {number} requestId - Request ID
 * @returns {Promise<Object|null>} Request data for notification
 */
const getRequestForNotification = async (requestId) => {
  return await QueryRequestRepository.findForNotification(requestId);
};

module.exports = {
  getApprovalRequestsByPods,
  getRequestById,
  approveRequest,
  rejectRequest,
  logRejection,
  getRequestOwnership,
  getRequestForNotification
};
