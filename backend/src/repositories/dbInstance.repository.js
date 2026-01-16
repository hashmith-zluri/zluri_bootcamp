const { query } = require('../config/db');

class DbInstanceRepository {
  /**
   * Get instances by engine type
   * @param {string} engineType - POSTGRES or MONGO
   * @returns {Promise<Array<{id: number, name: string}>>}
   */
  async findByEngine(engineType) {
    const result = await query(
      'SELECT id, name FROM db_instances WHERE engine = $1 ORDER BY name',
      [engineType.toUpperCase()]
    );
    return result.rows;
  }

  /**
   * Get instance by ID
   * @param {number} instanceId
   * @returns {Promise<{id: number, name: string, host: string, port: number, engine: string, username?: string, password?: string}|null>}
   */
  async findById(instanceId) {
    const result = await query(
      'SELECT id, name, host, port, engine, username, password FROM db_instances WHERE id = $1',
      [instanceId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get instance details (without credentials)
   * @param {number} instanceId
   * @returns {Promise<{name: string, host: string, port: number, engine: string}|null>}
   */
  async findDetailsById(instanceId) {
    const result = await query(
      'SELECT name, host, port, engine FROM db_instances WHERE id = $1',
      [instanceId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new DbInstanceRepository();
