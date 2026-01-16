const { EntitySchema } = require('@mikro-orm/core');

class ExecutionLog {
  /** @type {number} */
  id;

  /** @type {number} */
  request_id;

  /** @type {Date} */
  executed_at;

  /** @type {boolean} */
  success;

  /** @type {string|null} */
  output;

  /** @type {string|null} */
  error;

  /** @type {number|null} */
  execution_time_ms;
}

const ExecutionLogSchema = new EntitySchema({
  class: ExecutionLog,
  tableName: 'execution_logs',
  properties: {
    id: { type: 'number', primary: true },
    request_id: { type: 'number', fieldName: 'request_id' },
    executed_at: { type: 'Date', default: 'now()', fieldName: 'executed_at' },
    success: { type: 'boolean' },
    output: { type: 'text', nullable: true },
    error: { type: 'text', nullable: true },
    execution_time_ms: { type: 'number', nullable: true, fieldName: 'execution_time_ms' }
  }
});

module.exports = { ExecutionLog, ExecutionLogSchema };
