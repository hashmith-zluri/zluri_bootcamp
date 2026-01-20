const { z } = require('zod');

// Helper function to validate single query (SQL or MongoDB)
const validateSingleQuery = (query) => {
  if (!query || typeof query !== 'string') return true; // Let other validations handle this
  
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;
  
  // Remove comments and normalize whitespace
  let cleanQuery = trimmedQuery
    // Remove single-line comments (-- comment for SQL, // comment for MongoDB)
    .replace(/(?:--|\/\/).*$/gm, '')
    // Remove multi-line comments (/* comment */)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove string literals to avoid false positives with semicolons inside strings
  // Handle single quotes, double quotes, and backticks
  cleanQuery = cleanQuery
    .replace(/'(?:[^'\\]|\\.)*'/g, "'STRING'")  // Single quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '"STRING"')  // Double quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, '`STRING`'); // Backtick quoted strings
  
  // Check for multiple statements by looking for semicolons
  // Split by semicolon and filter out empty parts
  const statements = cleanQuery
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  // Should have exactly one non-empty statement
  if (statements.length > 1) {
    return false;
  }
  
  // Additional security checks for SQL patterns
  const suspiciousSqlPatterns = [
    /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)/i,
    /UNION\s+(?:ALL\s+)?SELECT/i,
    /;\s*--/,
    /;\s*\/\*/
  ];
  
  // Additional security checks for MongoDB patterns
  const suspiciousMongoPatterns = [
    /;\s*db\./i,  // Multiple db operations separated by semicolon
    /db\.[^;]+;\s*db\./i,  // Multiple db operations in sequence with semicolon
    /db\.\w+\.[^)]+\)\s+db\./i,  // Multiple db operations without semicolon (space separated)
  ];
  
  const hasSuspiciousSqlPattern = suspiciousSqlPatterns.some(pattern => pattern.test(query));
  const hasSuspiciousMongoPattern = suspiciousMongoPatterns.some(pattern => pattern.test(query));
  
  if (hasSuspiciousSqlPattern || hasSuspiciousMongoPattern) {
    return false;
  }
  
  return true;
};

// Auth schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Request schemas
const submitRequestSchema = z.object({
  instance_id: z.number({ required_error: 'instance_id is required' }).int().positive(),
  db_name: z.string().min(1, 'db_name is required'),
  query: z.string()
    .optional()
    .refine(validateSingleQuery, {
      message: 'Only single statements are allowed. Multiple queries/operations separated by semicolons are not permitted for security reasons.'
    }),
  comments: z.string()
    .min(1, 'comments is required')
    .refine(val => val.trim().length > 0, {
      message: 'comments cannot be empty or contain only spaces'
    }),
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
  sortBy: z.enum(['created_at', 'status', 'database_name', 'approved_at', 'id']).optional()
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
