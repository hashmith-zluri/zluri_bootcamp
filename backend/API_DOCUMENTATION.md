# API CALLS

## Authentication
```json
Authorization: Bearer <jwt_token>
```
### 1. Login
Create a JWT token for authenticated users.

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "test@zluri.com",
  "password": "pass1"
}
```

**Response (200):**
```json
{
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "success": true
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

**Business Logic (Why this exists):**
- Verify user identity using email + password
- Generate a JWT token containing user id, email, and role
- Establish a secure session without server-side state

**Result (What it enables):**
- User can access protected APIs
- Backend can enforce role-based access control
- Stateless authentication → scalable and secure

---

### 2. Logout
Invalidate the current JWT token.

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Business Logic:**
- Explicitly end the user's session
- Invalidate token (blacklist or client-side removal)
- Track login/logout events for audit & demo flow

**Result:**
- User cannot access protected routes anymore
- Allows switching users during demo (dev → manager → admin)
- Improves security posture and clarity

---

## Database Endpoints

### 3. Get Database Types
Get all available database types.

**Endpoint:** `GET /api/db/types`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "types": ["POSTGRES", "MONGO"]
}
```

**Business Logic:**
- Return supported database engines from backend
- Avoid frontend assumptions about DB support

**Result:**
- Dynamic dropdown for DB type selection
- Easy to extend (Oracle, MySQL later)
- Single source of truth

---

### 4. Get Database Instances
Get all database instances for a specific database type.

**Endpoint:** `GET /api/db/instances?type=POSTGRES`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `type` (required): Database type (e.g., "POSTGRES", "MONGO")

**Response (200):**
```json
{
  "instances": [
    {
      "id": "1",
      "name": "local-postgres"
    },
    {
      "id": "2",
      "name": "staging-postgres"
    }
  ]
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Type parameter is required"
}
```

**Business Logic:**
- Fetch DB instances filtered by engine
- Enforce backend ownership of infra configuration

**Result:**
- User sees only valid instances
- Prevents invalid DB targeting
- Clean separation of infra & app logic

---

### 5. Get Databases in an Instance (Query Request Page)
Get all databases available in a specific database instance.

**Endpoint:** `GET /api/db/instances/:id/name`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `id` (required): Instance ID

**Example:** `GET /api/db/instances/1/name`

**Response (200):**
```json
{
  "databases": ["postgres", "template0", "template1"]
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Instance not found"
}
```

**Business Logic:**
- Dynamically fetch databases inside a selected instance
- Remove need for hardcoded DB names

**Result:**
- Accurate database selection
- Prevents accidental execution on wrong DB
- Improves safety and correctness

---

## Request Endpoints

### 6. Submit Query Request
Submit a new query request.

**Endpoint:** `POST /api/request`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "databasetype": "POSTGRES",
  "instanceid": "1",
  "dbname": "postgres",
  "query": "SELECT * FROM users LIMIT 10;",
  "comments": "Need to check user data",
  "podid": "pod-1"
}
```

**Request Body (Script Request):**
```json
{
  "databasetype": "POSTGRES",
  "instanceid": "1",
  "dbname": "postgres",
  "script": "/path/to/script.sql",
  "comments": "Execute migration script",
  "podid": "pod-1"
}
```

**Response (200):**
```json
{
  "reqid": "123",
  "status": "PENDING"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Missing required fields"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Either query or script must be provided"
}
```

**Business Logic:**
- Accept a single execution intent (Either SQL query or uploaded script)
- Validate required metadata (instance, DB, POD)
- Store request in PENDING state
- Enforce "query OR script, not both"

**Result:**
- Developer can request execution without direct DB access
- All executions become auditable
- Central approval workflow is triggered

---

### 7. Get User Requests
Get all requests submitted by a specific user (includes execution results when available).

**Endpoint:** `GET /api/requests/mine`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `userid` (required): User ID

**Example:** `GET /api/requests/mine`

**Response (200):**
```json
{
  "requests": [
    {
      "reqid": "123",
      "query": "SELECT * FROM users LIMIT 10;",
      "script": null,
      "status": "APPROVED",
      "database_name": "postgres",
      "comments": "Need to check user data",
      "created_at": "2024-01-15T10:30:00Z",
      "approved_at": "2024-01-15T11:00:00Z",
      "instance_name": "local-postgres",
      "database_type": "POSTGRES",
      "result": {
        "output": "Query executed successfully",
        "response_time": 150,
        "status": "success",
        "error": null,
        "executed_at": "2024-01-15T12:00:00Z"
      }
    },
    {
      "reqid": "124",
      "query": null,
      "script": "/path/to/script.sql",
      "status": "PENDING",
      "database_name": "postgres",
      "comments": "Execute migration script",
      "created_at": "2024-01-15T13:00:00Z",
      "approved_at": null,
      "instance_name": "local-postgres",
      "database_type": "POSTGRES"
    }
  ]
}
```

**Business Logic:**
- Fetch only requests created by the logged-in user
- Join execution logs if available
- Enforce access via JWT identity

**Result:**
- Developer can track status (Pending / Approved / Failed) and execution output
- Transparency without exposing others' data
- No need to ask managers for updates

---

### 8. Get Request Execution Result
Get the execution result for a specific request.

**Endpoint:** `GET /api/requests/:reqid/result`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `reqid` (required): Request ID

**Example:** `GET /api/requests/123/result`

**Response (200) - Executed:**
```json
{
  "output": "Query executed successfully. 10 rows returned.",
  "response_time": 150,
  "status": "success",
  "error": null
}
```

**Response (200) - Execution Failed:**
```json
{
  "output": null,
  "response_time": 50,
  "status": "failure",
  "error": "Syntax error in SQL query"
}
```

**Response (200) - Not Executed Yet:**
```json
{
  "output": null,
  "response_time": null,
  "status": "pending",
  "message": "Request not yet executed"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Request not found"
}
```

**Business Logic:**
- Fetch execution result for a specific request
- Handle 3 states: Pending (not executed), Success, Failure

**Result:**
- Decouples execution from submission
- Enables async execution model
- Clean UX: user checks result when ready

---

## Approval Endpoints

### 9. Get Approval Requests
Get all pending requests for the manager's assigned pods.

**Endpoint:** `GET /api/approvals`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "requests": [
    {
      "reqid": "123",
      "query": "SELECT * FROM users LIMIT 10;",
      "script": null,
      "status": "PENDING",
      "database_name": "postgres",
      "comments": "Need to check user data",
      "pod_id": "pod-1",
      "created_at": "2024-01-15T10:30:00Z",
      "requester_email": "dev1@zluri.com",
      "requester_name": "Dev1",
      "instance_name": "local-postgres",
      "database_type": "POSTGRES"
    }
  ]
}
```

**Business Logic:**
- Fetch only PENDING requests
- Filter requests by manager's PODs
- Enforce role-based visibility

**Result:**
- Managers see only what needs action
- No clutter, no duplicates
- Clear responsibility boundaries

---

### 10. Approval Action
Alternative endpoint for approve/reject actions using action parameter in body.

**Endpoint:** `POST /api/approvals/:reqId/action`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `reqId` (required): Request ID

**Request Body (Approve):**
```json
{
  "action": "approve"
}
```

**Request Body (Reject):**
```json
{
  "action": "reject",
  "reason": "Query contains unsafe operations"
}
```

**Response (200) - Approve:**
```json
{
  "status": "approval"
}
```

**Response (200) - Reject:**
```json
{
  "status": "reject",
  "reason": "Query contains unsafe operations"
}
```

**Business Logic:**
- Single endpoint for approve/reject
- Validate manager authority
- Update request status atomically
- Record approval metadata

**Result:**
- Clean, extensible API design
- Prevents double approvals
- Triggers next stage (execution)

---



