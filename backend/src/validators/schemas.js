const { z } = require('zod');

// Helper function to validate single SQL query
const validateSingleQuery = (query) => {
  if (!query || typeof query !== 'string') return true; // Let other validations handle this
  
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;
  
  // Remove comments and normalize whitespace
  let cleanQuery = trimmedQuery
    // Remove single-line comments (-- comment)
    .replace(/--.*$/gm, '')
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
  
  // Additional security checks - look for patterns in the original query
  const suspiciousPatterns = [
    /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)/i,
    /UNION\s+(?:ALL\s+)?SELECT/i,
    /;\s*--/,
    /;\s*\/\*/
  ];
  
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => pattern.test(query));
  if (hasSuspiciousPattern) {
    return false;
  }
  
  return true;
};

// Helper function to validate single MongoDB operation
const validateSingleMongoOperation = (script) => {
  if (!script || typeof script !== 'string') return true; // Let other validations handle this
  
  const trimmedScript = script.trim();
  if (!trimmedScript) return true;
  
  // Remove comments and normalize whitespace
  let cleanScript = trimmedScript
    // Remove single-line comments (// comment)
    .replace(/\/\/.*$/gm, '')
    // Remove multi-line comments (/* comment */)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Normalize whitespace but preserve line breaks for multi-line detection
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  // Remove string literals to avoid false positives
  // Handle single quotes, double quotes, and template literals
  cleanScript = cleanScript
    .replace(/'(?:[^'\\]|\\.)*'/g, "'STRING'")  // Single quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '"STRING"')  // Double quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, '`STRING`'); // Template literals
  
  // Check for multiple MongoDB operations by looking for common patterns
  // Split by semicolons and filter out empty parts
  const statements = cleanScript
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  // Should have exactly one non-empty statement
  if (statements.length > 1) {
    return false;
  }
  
  // Check for multiple db operations in a single line (chained operations)
  const chainedOperationPatterns = [
    // Multiple db.collection operations
    /db\.\w+\.\w+\([^)]*\)\s*;\s*db\.\w+\.\w+/i,
    // Multiple operations separated by semicolons
    /\)\s*;\s*db\./i,
    // Multiple use() statements
    /use\s*\(\s*[^)]+\s*\)\s*;\s*use\s*\(/i,
    // Suspicious patterns with semicolons
    /;\s*(?:db\.|use\(|show\s|rs\.)/i
  ];
  
  const hasChainedOperations = chainedOperationPatterns.some(pattern => pattern.test(script));
  if (hasChainedOperations) {
    return false;
  }
  
  // Check for multiple operations using newlines (common in MongoDB scripts)
  const lines = cleanScript
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // Count lines that look like MongoDB operations (more comprehensive patterns)
  const mongoOperationLines = lines.filter(line => {
    return /^(db\.\w+\.\w+|use\s*\(|show\s|rs\.|sh\.|printjson\s*\(|load\s*\()/i.test(line);
  });
  
  // Should have exactly one MongoDB operation
  if (mongoOperationLines.length > 1) {
    return false;
  }
  
  // Additional security checks for suspicious patterns
  const suspiciousPatterns = [
    // Multiple database switches
    /use\s*\([^)]+\).*use\s*\(/i,
    // Administrative operations that might be chained
    /(?:drop|remove|delete).*(?:drop|remove|delete)/i,
    // Eval or function execution patterns
    /eval\s*\(.*\)\s*;/i,
    // Multiple collection operations (without semicolon)
    /db\.\w+\.\w+.*db\.\w+\.\w+/i
  ];
  
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => pattern.test(script));
  if (hasSuspiciousPattern) {
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
      message: 'Only single SQL statements are allowed. Multiple queries separated by semicolons are not permitted for security reasons.'
    }),
  script: z.string()
    .optional()
    .refine(validateSingleMongoOperation, {
      message: 'Only single MongoDB operations are allowed. Multiple operations separated by semicolons or newlines are not permitted for security reasons.'
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
