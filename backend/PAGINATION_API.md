# Filtering and Sorting API Documentation

## Overview
All list endpoints now support filtering and sorting. Pagination is optional.

## Endpoints

### 1. GET /api/v1/request/mine
Get user's own requests with filtering and sorting.

**Query Parameters:**
- `status` (optional): Filter by status
  - Valid values: `PENDING`, `APPROVED`, `REJECTED`, `EXECUTED`, `FAILED`, `EXECUTING`
  - Case-insensitive
  - Example: `?status=PENDING`

- `sortBy` (optional): Field to sort by
  - Valid values: `created_at`, `status`, `database_name`, `approved_at`
  - Default: `created_at`
  - Always sorts in DESC order (newest first)
  - Example: `?sortBy=status`

- `limit` (optional): Number of records per page
  - Valid range: 1-100
  - Only used if both limit and offset are provided
  - Example: `?limit=20&offset=0`

- `offset` (optional): Number of records to skip
  - Minimum: 0
  - Only used if both limit and offset are provided
  - Example: `?limit=20&offset=20`

**Example Requests:**
```bash
# Get all pending requests
GET /api/v1/request/mine?status=PENDING

# Get all executed requests (no limit)
GET /api/v1/request/mine?status=EXECUTED

# Get first 20 requests sorted by status
GET /api/v1/request/mine?sortBy=status&limit=20&offset=0

# Get next 20 requests
GET /api/v1/request/mine?limit=20&offset=20
```

**Response Format:**
```json
{
  "success": true,
  "requests": [
    {
      "req_id": 1,
      "query": "SELECT * FROM users",
      "script": null,
      "status": "PENDING",
      "database_name": "test_db",
      "comments": "Test query",
      "created_at": "2026-01-14T10:00:00Z",
      "approved_at": null,
      "instance_name": "prod-postgres",
      "database_type": "POSTGRES",
      "result": null
    }
  ]
}
```

### 2. GET /api/v1/approvals
Get approval requests for manager with filtering and sorting.

**Query Parameters:**
Same as `/api/v1/request/mine` endpoint.

**Example Requests:**
```bash
# Get all pending approvals (most common use case)
GET /api/v1/approvals?status=PENDING

# Get all executed requests
GET /api/v1/approvals?status=EXECUTED

# Get rejected requests
GET /api/v1/approvals?status=REJECTED

# Get first 25 requests with pagination
GET /api/v1/approvals?limit=25&offset=0
```

**Response Format:**
```json
{
  "success": true,
  "requests": [
    {
      "req_id": 1,
      "query": "SELECT * FROM users",
      "script": null,
      "status": "PENDING",
      "database_name": "test_db",
      "comments": "Test query",
      "pod_id": "pod1",
      "created_at": "2026-01-14T10:00:00Z",
      "approved_at": null,
      "requester_email": "user@example.com",
      "requester_name": "John Doe",
      "instance_name": "prod-postgres",
      "database_type": "POSTGRES",
      "result": null
    }
  ]
}
```

## Features

### Status Filtering
- **Valid statuses**: PENDING, APPROVED, REJECTED, EXECUTED, FAILED, EXECUTING
- **Case-insensitive**: `pending`, `PENDING`, `Pending` all work
- **Invalid status**: Ignored, returns all statuses
- **No status parameter**: Returns all requests

### Sorting
- **Valid fields**: created_at, status, database_name, approved_at
- **Sort order**: Always DESC (newest/highest first)
- **Invalid field**: Defaults to `created_at`
- **Default**: Sorts by `created_at DESC`

### Pagination (Optional)
- **When to use**: Only when you need to limit results
- **How it works**: Both `limit` and `offset` must be provided together
- **No pagination**: If either parameter is missing, returns all results
- **Limit range**: 1-100 records
- **Offset**: Starts at 0

## Boundary Value Handling

### Limit Boundaries
- **Minimum (1)**: `?limit=1&offset=0` returns 1 record
- **Maximum (100)**: `?limit=100&offset=0` returns up to 100 records
- **Over maximum**: `?limit=500&offset=0` is capped at 100
- **Zero**: `?limit=0&offset=0` defaults to 10
- **Negative**: `?limit=-5&offset=0` returns **400 error**: "Limit cannot be negative"
- **Invalid**: `?limit=abc&offset=0` defaults to 10

### Offset Boundaries
- **Zero (first page)**: `?limit=10&offset=0` starts from first record
- **Negative**: `?limit=10&offset=-10` returns **400 error**: "Offset cannot be negative"
- **Beyond total**: Returns empty array
- **Invalid**: `?limit=10&offset=abc` defaults to 0

### Status Filter
- **Valid statuses**: PENDING, APPROVED, REJECTED, EXECUTED, FAILED, EXECUTING
- **Case-insensitive**: `pending`, `PENDING`, `Pending` all work
- **Invalid status**: Ignored, returns all statuses

### Sort Field
- **Valid fields**: created_at, status, database_name, approved_at
- **Invalid field**: Defaults to `created_at`

## Common Use Cases

### 1. Show only pending requests (manager approval queue)
```bash
GET /api/v1/approvals?status=PENDING
```

### 2. Get all executed requests
```bash
GET /api/v1/request/mine?status=EXECUTED
```

### 3. Paginate through large result sets
```bash
# Page 1
GET /api/v1/request/mine?limit=20&offset=0

# Page 2
GET /api/v1/request/mine?limit=20&offset=20

# Page 3
GET /api/v1/request/mine?limit=20&offset=40
```

### 4. Get most recent requests first (default)
```bash
GET /api/v1/request/mine
```

### 5. Get failed executions for debugging
```bash
GET /api/v1/request/mine?status=FAILED
```

### 6. Combine filters
```bash
GET /api/v1/approvals?status=EXECUTED&sortBy=approved_at&limit=50&offset=0
```

## Error Handling

### Validation Errors (400 Bad Request)
- **Negative limit**: Returns `{"success": false, "message": "Limit cannot be negative"}`
- **Negative offset**: Returns `{"success": false, "message": "Offset cannot be negative"}`

### Graceful Defaults
All other invalid parameters are handled gracefully with sensible defaults:
- Invalid status → No filter applied (returns all)
- Invalid sortBy → Defaults to `created_at`
- Zero limit → Defaults to 10
- Invalid limit → Defaults to 10
- Invalid offset → Defaults to 0
- Missing limit or offset → No pagination (returns all)

No errors are returned for invalid parameters except negative values; the API applies defaults and continues processing.

## Performance Considerations

1. **Use status filters**: Filtering reduces database load
2. **Pagination is optional**: Only use when needed
3. **Index optimization**: The following fields are indexed for performance:
   - `created_at`
   - `status`
   - `database_name`
   - `approved_at`

## Testing

Comprehensive tests are included:
- 20+ tests for request service
- 20+ tests for approval service
- All edge cases covered

Run tests:
```bash
npm test -- request.service.test.js
npm test -- approval.service.test.js
```

