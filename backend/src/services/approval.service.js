const QueryRequestRepository = require("../repositories/queryRequest.repository");
const ExecutionLogRepository = require("../repositories/executionLog.repository");


const getApprovalRequestsByPods = async (managedPods, options = {}) => {
  return await QueryRequestRepository.findByPods(managedPods, options);
};

const getRequestById = async (requestId) => {
  return await QueryRequestRepository.findById(requestId);
};


const approveRequest = async (requestId, approverId) => {
  return await QueryRequestRepository.approve(requestId, approverId);
};


const rejectRequest = async (requestId, approverId, reason) => {
  return await QueryRequestRepository.reject(requestId, approverId, reason);
};


const logRejection = async (requestId, reason) => {
  await ExecutionLogRepository.create({
    requestId,
    success: false,
    output: null,
    error: `Request rejected by manager. Reason: ${reason || 'No reason provided'}`,
    executionTimeMs: 0
  });
};


const getRequestOwnership = async (requestId) => {
  return await QueryRequestRepository.findOwnership(requestId);
};


const getRequestForNotification = async (requestId) => {
  return await QueryRequestRepository.findForNotification(requestId);
};

const updateRequestStatus = async (requestId, status) => {
  return await QueryRequestRepository.updateStatus(requestId, status);
};

module.exports = {
  getApprovalRequestsByPods,
  getRequestById,
  approveRequest,
  rejectRequest,
  logRejection,
  getRequestOwnership,
  getRequestForNotification,
  updateRequestStatus
};
