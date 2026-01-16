const QueryRequestRepository = require("../repositories/queryRequest.repository");

/**
 * Submit a new query or script request
 * @param {Object} requestData - Request submission data
 * @returns {Promise<Object>} Created request with ID and status
 */
const createRequest = async (requestData) => {
  return await QueryRequestRepository.create(requestData);
};

/**
 * Get all requests for a specific user with pagination, sorting, and filtering
 * @param {number} userId - User ID to fetch requests for
 * @param {Object} options - Query options
 * @returns {Promise<Object[]>} Array of user requests
 */
const getUserRequests = async (userId, options = {}) => {
  return await QueryRequestRepository.findByUserId(userId, options);
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
  createRequest,
  getUserRequests,
  getRequestForNotification
};
