const { EntitySchema } = require('@mikro-orm/core');

/**
 * @enum {string}
 */
const RequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTING: 'EXECUTING',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED'
};

class QueryRequest {
  /** @type {number} */
  id;

  /** @type {number} */
  requester_id;

  /** @type {number} */
  db_instance_id;

  /** @type {string} */
  database_name;

  /** @type {string|null} */
  query_text;

  /** @type {string|null} */
  script_path;

  /** @type {string} */
  comments;

  /** @type {string} */
  pod_id;

  /** @type {string} */
  status;

  /** @type {number|null} */
  approved_by;

  /** @type {Date|null} */
  approved_at;

  /** @type {Date} */
  created_at;
}

const QueryRequestSchema = new EntitySchema({
  class: QueryRequest,
  tableName: 'query_requests',
  properties: {
    id: { type: 'number', primary: true },
    requester_id: { type: 'number', fieldName: 'requester_id' },
    db_instance_id: { type: 'number', fieldName: 'db_instance_id' },
    database_name: { type: 'string', length: 100, fieldName: 'database_name' },
    query_text: { type: 'text', nullable: true, fieldName: 'query_text' },
    script_path: { type: 'text', nullable: true, fieldName: 'script_path' },
    comments: { type: 'text' },
    pod_id: { type: 'string', length: 50, fieldName: 'pod_id' },
    status: { type: 'string', length: 20, default: 'PENDING' },
    approved_by: { type: 'number', nullable: true, fieldName: 'approved_by' },
    approved_at: { type: 'Date', nullable: true, fieldName: 'approved_at' },
    created_at: { type: 'Date', default: 'now()', fieldName: 'created_at' }
  }
});

module.exports = { QueryRequest, RequestStatus, QueryRequestSchema };
