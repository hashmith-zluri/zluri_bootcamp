const { EntitySchema } = require('@mikro-orm/core');

class InstanceDatabase {
  /** @type {number} */
  id;

  /** @type {number} */
  instance_id;

  /** @type {string} */
  database_name;

  /** @type {string|null} */
  description;
}

const InstanceDatabaseSchema = new EntitySchema({
  class: InstanceDatabase,
  tableName: 'instance_databases',
  properties: {
    id: { type: 'number', primary: true },
    instance_id: { type: 'number', fieldName: 'instance_id' },
    database_name: { type: 'string', length: 100, fieldName: 'database_name' },
    description: { type: 'text', nullable: true }
  }
});

module.exports = { InstanceDatabase, InstanceDatabaseSchema };
