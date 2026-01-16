const { query } = require('../config/db');

class UserRepository {
  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<{id: number, email: string, name: string, password: string, role: string}|null>}
   */
  async findByEmail(email) {
    const result = await query(
      'SELECT id, email, name, password, role FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   * @param {number} id
   * @returns {Promise<{id: number, email: string, name: string, role: string}|null>}
   */
  async findById(id) {
    const result = await query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = new UserRepository();
