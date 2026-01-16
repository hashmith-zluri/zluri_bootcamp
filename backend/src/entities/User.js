const { EntitySchema } = require('@mikro-orm/core');

/**
 * @enum {string}
 */
const UserRole = {
  DEVELOPER: 'DEVELOPER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN'
};

/**
 * User entity class
 */
class User {
  /** @type {number} */
  id;

  /** @type {string} */
  email;

  /** @type {string} */
  name;

  /** @type {string} */
  password;

  /** @type {string} */
  role;
}

// Schema definition for MikroORM
const UserSchema = new EntitySchema({
  class: User,
  tableName: 'users',
  properties: {
    id: { type: 'number', primary: true },
    email: { type: 'string', unique: true },
    name: { type: 'string', length: 100 },
    password: { type: 'text' },
    role: { type: 'string', length: 20 }
  }
});

module.exports = { User, UserRole, UserSchema };
