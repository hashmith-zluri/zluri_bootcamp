// Check if we're in test environment and use fallback
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

// Get API base URL safely
let API_BASE_URL;
if (isTest) {
  API_BASE_URL = 'https://zluribootcamp-production.up.railway.app/api/v1';
} else {
  try {
    // Use eval to hide import.meta from Jest parser
    API_BASE_URL = eval('import.meta.env.VITE_API_BASE_URL') || 'https://zluribootcamp-production.up.railway.app/api/v1';
  } catch (e) {
    API_BASE_URL = 'https://zluribootcamp-production.up.railway.app/api/v1';
  }
}

export const ROLES = {
  DEVELOPER: 'DEVELOPER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN'
};

export { API_BASE_URL };

// Role-based access control
export const ROLE_ACCESS = {
  DEVELOPER: ['/submit', '/my-submissions'],
  MANAGER: ['/submit', '/my-submissions', '/approvals'],
  ADMIN: ['/submit', '/my-submissions', '/approvals', '/admin'],
};

// Status colors for badges
export const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXECUTING: 'bg-purple-100 text-purple-800',
  EXECUTED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

// PODs configuration - must match backend/src/config/pods.js
export const PODS = [
  { id: 'pod-1', name: 'Pod 1', manager_email: 'manager1@zluri.com' },
  { id: 'de', name: 'DE', manager_email: 'de-lead@zluri.com' },
  { id: 'db', name: 'DB', manager_email: 'db-admin@zluri.com' },
];

// Database types
export const DB_TYPES = ['POSTGRES', 'MONGO'];

// Request types
export const REQUEST_TYPES = [
  { value: 'query', label: 'Query' },
  { value: 'script', label: 'Script' },
];