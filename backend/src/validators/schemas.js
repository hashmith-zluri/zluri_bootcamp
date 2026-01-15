const { z } = require('zod');

// Auth schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Request schemas
const submitRequestSchema = z.object({
  instance_id: z.number({ required_error: 'instance_id is required' }).int().positive(),
  db_name: z.string().min(1, 'db_name is required'),
  query: z.string().optional(),
  comments: z.string().min(1, 'comments is required'),
  pod_id: z.union([z.string(), z.number()]).transform(val => String(val))
});

// Approval action schema
const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    message: 'Invalid action. Must be "approve" or "reject"'
  }),
  reason: z.string().optional().nullable()
});

// Query params schemas
const paginationSchema = z.object({
  limit: z.string()
    .optional()
    .transform(val => val ? parseFloat(val) : null)
    .refine(val => val === null || (Number.isInteger(val) && val > 0), { 
      message: 'Limit must be +ve integer.' 
    }),
  offset: z.string()
    .optional()
    .transform(val => val ? parseFloat(val) : null)
    .refine(val => val === null || (Number.isInteger(val) && val >= 0), { 
      message: 'Offset must be +ve integer.' 
    }),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXECUTING']).optional(),
  sortBy: z.enum(['created_at', 'status', 'database_name', 'approved_at']).optional()
});

// DB type query schema
const dbTypeSchema = z.object({
  type: z.enum(['POSTGRES', 'MONGO'], {
    message: 'Database type not found. Valid types: POSTGRES, MONGO'
  })
});

// Request ID param schema
const reqIdParamSchema = z.object({
  req_id: z.string().transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0, {
    message: 'Invalid request ID'
  })
});

module.exports = {
  loginSchema,
  submitRequestSchema,
  approvalActionSchema,
  paginationSchema,
  reqIdParamSchema,
  dbTypeSchema
};
