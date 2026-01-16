const { query } = require('../config/db');

class InstanceDatabaseRepository {
  /**
   * Get databases for a specific instance
   * @param {number} instanceId
   * @returns {Promise<string[]>}
   */
  async findByInstanceId(instanceId) {
    const result = await query(
      'SELECT database_name FROM instance_databases WHERE instance_id = $1 ORDER BY database_name',
      [instanceId]
    );
    return result.rows.map(row => row.database_name);
  }
}

module.exports = new InstanceDatabaseRepository();
