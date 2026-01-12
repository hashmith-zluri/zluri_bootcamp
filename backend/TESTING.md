# Testing Documentation

## Overview

This project uses **Jest** as the testing framework with comprehensive unit tests covering all services, controllers, middlewares, routes, and configurations.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test -- auth.service.test.js

# Run tests in watch mode
npm test -- --watch
```

## Test Structure

```
backend/__tests__/
├── setup.js                          # Global test setup
├── app.test.js                       # Express app tests
├── config/
│   ├── mongoDb.config.full.test.js   # MongoDB full integration
│   ├── postgresDb.config.test.js     # PostgreSQL connection config
│   └── targetDb.config.test.js       # Target database exports
├── controllers/
│   ├── approval.controller.test.js   # Approval endpoints
│   ├── approval.manager.test.js      # Manager approval logic
│   ├── approval.user.test.js         # User access tests
│   ├── auth.controller.test.js       # Authentication controller
│   ├── db.controller.test.js         # Database endpoints
│   └── request.controller.test.js    # Request submission
├── middlewares/
│   └── auth.middleware.test.js       # JWT middleware
├── routes/
│   └── request.routes.test.js        # Request routing
└── services/
    ├── auth.service.test.js          # Login/logout service
    ├── execution.service.test.js     # Query routing service
    ├── mongoExecution.service.test.js # MongoDB query execution
    ├── mongoScript.service.test.js   # MongoDB script execution
    ├── mongoScript.worker.test.js    # MongoDB worker threads
    ├── postgres.service.test.js      # PostgreSQL query execution
    ├── postgresScript.service.test.js # PostgreSQL script execution
    └── postgresScript.worker.test.js # PostgreSQL worker threads
```

## Test Coverage

Current coverage: **100%** across all metrics

| Category | Files | Coverage |
|----------|-------|----------|
| Config | 5 | 100% |
| Controllers | 4 | 100% |
| Middlewares | 1 | 100% |
| Routes | 4 | 100% |
| Services | 6 | 100% |

## Testing Approach

### 1. Unit Tests
Each module is tested in isolation with mocked dependencies.

```javascript
// Example: Mocking database queries
jest.mock('../src/config/db');
const { query } = require('../src/config/db');

query.mockResolvedValue({ rows: [{ id: 1, name: 'Test' }] });
```

### 2. Mocking Strategy

**Database Mocks:**
```javascript
jest.mock('../src/config/db');
jest.mock('../src/config/postgresDb');
jest.mock('../src/config/mongoDb');
```

**External Libraries:**
```javascript
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('pg');
jest.mock('mongodb');
```

### 3. Test Categories

#### Authentication Tests
- Login with valid/invalid credentials
- JWT token generation and verification
- Token expiration handling
- Logout and token invalidation
- Password hashing with bcrypt

#### Authorization Tests
- Role-based access (USER, MANAGER, ADMIN)
- Protected route access
- Manager-only endpoints
- Request ownership validation

#### Database Tests
- Connection pooling
- Query execution
- Error handling
- Timeout handling

#### Request Flow Tests
- Request submission
- File upload (scripts)
- Approval workflow
- Execution triggering

## Key Test Scenarios

### Authentication Flow
```javascript
describe('Login', () => {
  it('should return JWT token for valid credentials', async () => {
    // Test successful login
  });

  it('should reject invalid password', async () => {
    // Test failed login
  });

  it('should handle non-existent user', async () => {
    // Test user not found
  });
});
```

### Request Submission
```javascript
describe('Submit Request', () => {
  it('should create request with query', async () => {
    // Test query submission
  });

  it('should create request with script file', async () => {
    // Test script upload
  });

  it('should reject request with both query and script', async () => {
    // Test validation
  });
});
```

### Approval Workflow
```javascript
describe('Approval', () => {
  it('should allow manager to approve request', async () => {
    // Test approval
  });

  it('should trigger execution after approval', async () => {
    // Test execution trigger
  });

  it('should reject non-manager access', async () => {
    // Test role restriction
  });
});
```

### Query Execution
```javascript
describe('PostgreSQL Execution', () => {
  it('should execute approved query', async () => {
    // Test successful execution
  });

  it('should handle query timeout', async () => {
    // Test timeout
  });

  it('should log execution results', async () => {
    // Test logging
  });
});
```

### Script Execution
```javascript
describe('Script Execution', () => {
  it('should execute script in worker thread', async () => {
    // Test worker isolation
  });

  it('should enforce timeout', async () => {
    // Test 5-minute timeout
  });

  it('should capture console output', async () => {
    // Test output capture
  });
});
```

## Mocking Patterns

### Mock Database Response
```javascript
query.mockResolvedValueOnce({
  rows: [{
    id: 1,
    status: 'APPROVED',
    engine: 'POSTGRES',
    query_text: 'SELECT * FROM users;'
  }]
});
```

### Mock Execution Result
```javascript
executeTargetQuery.mockResolvedValue({
  success: true,
  rows: [{ id: 1, name: 'Test' }],
  rowCount: 1,
  executionTime: 50
});
```

### Mock JWT Token
```javascript
jwt.sign.mockReturnValue('mock-jwt-token');
jwt.verify.mockReturnValue({
  userId: 1,
  email: 'test@example.com',
  role: 'USER'
});
```

### Mock Worker Thread
```javascript
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === 'message') {
        callback({ success: true, output: 'Test output' });
      }
    }),
    terminate: jest.fn()
  }))
}));
```

## Error Handling Tests

### Database Errors
```javascript
it('should handle connection failure', async () => {
  query.mockRejectedValue(new Error('Connection refused'));
  const result = await service.execute(1);
  expect(result.success).toBe(false);
  expect(result.error).toContain('Connection refused');
});
```

### Validation Errors
```javascript
it('should reject missing required fields', async () => {
  const response = await request(app)
    .post('/api/requests')
    .send({ comments: 'test' }); // Missing required fields
  
  expect(response.status).toBe(400);
  expect(response.body.message).toContain('Missing required fields');
});
```

### Authorization Errors
```javascript
it('should reject unauthorized access', async () => {
  const response = await request(app)
    .get('/api/approvals')
    .set('Authorization', 'Bearer user-token'); // USER role, not MANAGER
  
  expect(response.status).toBe(403);
});
```

## Test Configuration

### jest.config.js
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js']
};
```

### Test Setup (setup.js)
```javascript
// Suppress console logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
```

## Running Specific Tests

```bash
# Run authentication tests only
npm test -- auth

# Run all controller tests
npm test -- controller

# Run MongoDB related tests
npm test -- mongo

# Run with verbose output
npm test -- --verbose

# Run and update snapshots
npm test -- -u
```

## Continuous Integration

Tests run automatically on:
- Every push to main branch
- Every pull request
- Pre-commit hooks (optional)

## Test Results Summary

```
Test Suites: 22 passed, 22 total
Tests:       322 passed, 322 total
Snapshots:   0 total
Time:        ~3s
```

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Mock external dependencies** - Database, APIs, file system
3. **Test edge cases** - Empty inputs, errors, timeouts
4. **Use descriptive names** - `should return error when user not found`
5. **Clean up after tests** - Reset mocks, clear state
6. **Keep tests fast** - Mock slow operations
7. **Test both success and failure paths**
