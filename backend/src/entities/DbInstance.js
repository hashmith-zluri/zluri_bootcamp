const { EntitySchema } = require('@mikro-orm/core');

/**
 * @enum {string}
 */
const DbEngine = {
  POSTGRES: 'POSTGRES',
  MONGO: 'MONGO'
};

class DbInstance {
  /** @type {number} */
  id;

  /** @type {string} */
  name;

  /** @type {string} */
  host;

  /** @type {number} */
  port;

  /** @type {string} */
  engine;

  /** @type {string|undefined} */
  username;

  /** @type {string|undefined} */
  password;
}

const DbInstanceSchema = new EntitySchema({
  class: DbInstance,
  tableName: 'db_instances',
  properties: {
    id: { type: 'number', primary: true },
    name: { type: 'string', length: 100 },
    host: { type: 'string', length: 255 },
    port: { type: 'number' },
    engine: { type: 'string', length: 20 },
    username: { type: 'string', nullable: true },
    password: { type: 'string', nullable: true }
  }
});

module.exports = { DbInstance, DbEngine, DbInstanceSchema };
