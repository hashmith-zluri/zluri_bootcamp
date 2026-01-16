const DbInstanceRepository = require("../repositories/dbInstance.repository");
const InstanceDatabaseRepository = require("../repositories/instanceDatabase.repository");

/**
 * Get database instances by engine type
 * @param {string} engineType - Database engine type (POSTGRES or MONGO)
 * @returns {Promise<Object[]>} Array of database instances
 */
const getInstancesByType = async (engineType) => {
  return await DbInstanceRepository.findByEngine(engineType);
};

/**
 * Get instance details by ID
 * @param {number} instanceId - Database instance ID
 * @returns {Promise<Object|null>} Instance details or null if not found
 */
const getInstanceById = async (instanceId) => {
  return await DbInstanceRepository.findDetailsById(instanceId);
};

/**
 * Get databases for a specific instance
 * @param {number} instanceId - Database instance ID
 * @returns {Promise<string[]>} Array of database names
 */
const getDatabasesByInstanceId = async (instanceId) => {
  return await InstanceDatabaseRepository.findByInstanceId(instanceId);
};

module.exports = {
  getInstancesByType,
  getInstanceById,
  getDatabasesByInstanceId
};
