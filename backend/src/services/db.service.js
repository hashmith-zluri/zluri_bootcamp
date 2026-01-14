const { query } = require("../config/db");

/**
 * Database Service - Handles all database operations for database management
 */

/**
 * Get database instances by engine type
 * @param {string} engineType - Database engine type (POSTGRES or MONGO)
 * @returns {Promise<Object[]>} Array of database instances
 */
const getInstancesByType = async (engineType) => {
  const sql = `
    SELECT id, name 
    FROM db_instances 
    WHERE engine = $1 
    ORDER BY name
  `;
  
  const result = await query(sql, [engineType.toUpperCase()]);
  return result.rows;
};

/**
 * Get instance details by ID
 * @param {number} instanceId - Database instance ID
 * @returns {Promise<Object|null>} Instance details or null if not found
 */
const getInstanceById = async (instanceId) => {
  const sql = `
    SELECT name, host, port, engine 
    FROM db_instances 
    WHERE id = $1
  `;
  
  const result = await query(sql, [instanceId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Get databases for a specific instance
 * @param {number} instanceId - Database instance ID
 * @returns {Promise<string[]>} Array of database names
 */
const getDatabasesByInstanceId = async (instanceId) => {
  const sql = `
    SELECT database_name 
    FROM instance_databases 
    WHERE instance_id = $1 
    ORDER BY database_name
  `;
  
  const result = await query(sql, [instanceId]);
  return result.rows.map(row => row.database_name);
};

module.exports = {
  getInstancesByType,
  getInstanceById,
  getDatabasesByInstanceId
};