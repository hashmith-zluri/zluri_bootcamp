
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

// Get API base URL safely
let API_BASE_URL;
if (isTest) {
  API_BASE_URL = 'https://zluribootcamp-production.up.railway.app/api/v1';
} else {
  try {
    API_BASE_URL = eval('import.meta.env.VITE_API_BASE_URL') || 'https://zluribootcamp-production.up.railway.app/api/v1';
  } catch (e) {
    API_BASE_URL = 'https://zluribootcamp-production.up.railway.app/api/v1';
  }
}

// Get auth token from localStorage
const getToken = () => localStorage.getItem('token');

// API request helper with error handling
export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (response.status === 401 && token && endpoint !== '/auth/login') {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (response.status === 403) {
      throw new Error('You do not have permission to perform this action.');
    }

    if (!response.ok) {
      // Handle Zod validation errors
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessages = data.errors.map(err => `${err.field}: ${err.message}`).join(', ');
        throw new Error(errorMessages);
      }
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
}

// Auth APIs
export const authAPI = {
  login: (credentials) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
};

// Database APIs
export const dbAPI = {
  getTypes: () => apiRequest('/db/types'),
  getInstances: (type) => apiRequest(`/db/instances?type=${type}`),
  getDatabases: (instanceId) => apiRequest(`/db/instances/${instanceId}/name`),
};

// Helper function to build query parameters
const buildQueryParams = (params) => {
  const queryParams = new URLSearchParams();
  
  const paramHandlers = {
    status: (value) => value && value !== 'all' && queryParams.append('status', value),
    sortBy: (value) => value && queryParams.append('sortBy', value),
    limit: (value) => (value !== undefined && value !== null) && queryParams.append('limit', String(value)),
    offset: (value) => (value !== undefined && value !== null) && queryParams.append('offset', String(value))
  };
  
  Object.entries(params).forEach(([key, value]) => {
    const handler = paramHandlers[key];
    if (handler) handler(value);
  });
  
  return queryParams.toString();
};

// Request APIs
export const requestAPI = {
  submit: (data) => apiRequest('/request', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMyRequests: (params = {}) => {
    const queryString = buildQueryParams(params);
    return apiRequest(`/request/mine${queryString ? `?${queryString}` : ''}`);
  },
  getResult: (reqId) => apiRequest(`/request/${reqId}/result`),
};

// Approval APIs
export const approvalAPI = {
  getPendingRequests: (params = {}) => {
    const queryString = buildQueryParams(params);
    return apiRequest(`/approvals${queryString ? `?${queryString}` : ''}`);
  },
  approveOrReject: (reqId, action, reason = null) => apiRequest(`/approvals/${reqId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  }),
};

export default apiRequest;
