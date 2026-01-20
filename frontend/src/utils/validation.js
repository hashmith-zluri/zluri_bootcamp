import { z } from 'zod';

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

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Query submission validation schema (handles both query and script)
export const querySubmissionSchema = z.object({
  dbType: z.enum(['POSTGRES', 'MONGO'], { required_error: 'Database type is required' }),
  instanceId: z.string().min(1, 'Instance is required'),
  databaseName: z.string().min(1, 'Database is required'),
  requestType: z.enum(['query', 'script'], { required_error: 'Request type is required' }),
  query: z.string()
    .max(10000, 'Query cannot exceed 10,000 characters')
    .optional(),
  script: z.string()
    .max(10000, 'Script cannot exceed 10,000 characters')
    .optional()
    .refine(validateSingleMongoOperation, {
      message: 'Only single MongoDB operations are allowed. Multiple operations separated by semicolons or newlines are not permitted for security reasons.'
    }),
  comments: z.string()
    .min(1, 'Comments are required')
    .max(1000, 'Comments cannot exceed 1,000 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Comments cannot be empty or contain only spaces',
    }),
  podId: z.string().min(1, 'Pod is required'),
}).refine((data) => {
  if (data.requestType === 'query') {
    return data.query && data.query.trim().length > 0;
  }
  if (data.requestType === 'script') {
    return data.script && data.script.trim().length > 0;
  }
  return true;
}, {
  message: 'Query or script cannot be empty or contain only spaces',
  path: ['query'],
});

// Rejection reason validation
export const rejectReasonSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

export default { loginSchema, querySubmissionSchema, rejectReasonSchema };
