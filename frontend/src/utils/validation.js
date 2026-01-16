import { z } from 'zod';

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
  query: z.string().optional(),
  script: z.string().optional(),
  comments: z.string()
    .min(1, 'Comments are required')
    .refine((val) => val.trim().length > 0, {
      message: 'Comments cannot be empty or contain only spaces',
    }),
  podId: z.string().min(1, 'Pod is required'),
}).refine((data) => {
  if (data.requestType === 'query') {
    return data.query && data.query.trim().length > 0;
  }
  // For script requests, file validation is handled separately in the component
  return true;
}, {
  message: 'Query cannot be empty or contain only spaces',
  path: ['query'],
});

// Rejection reason validation
export const rejectReasonSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

export default { loginSchema, querySubmissionSchema, rejectReasonSchema };
