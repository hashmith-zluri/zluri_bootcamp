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
  "success": true,
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
  "success": true,
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
  "success": true,
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
  "success": true,
  "req_id": "123",
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
Get all requests submitted by the authenticated user (includes execution results when available).

**Endpoint:** `GET /api/requests/mine`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200) - PostgreSQL Query:**
```json
{
  "success": true,
  "requests": [
    {
      "req_id": 47,
      "query": "SELECT * FROM users LIMIT 1;",
      "script": null,
      "status": "EXECUTED",
      "database_name": "test_ecommerce",
      "comments": "Need to check",
      "pod_id": "db",
      "created_at": "2026-01-09T12:41:34.523Z",
      "approved_at": "2026-01-09T12:43:33.448Z",
      "requester_email": "dev1@zluri.com",
      "requester_name": "Dev1",
      "instance_name": "local-postgres",
      "database_type": "POSTGRES",
      "result": {
        "output": "Query executed successfully. 1 rows returned.\n\n[\n  {\n    \"id\": 1,\n    \"email\": \"john@example.com\",\n    \"name\": \"John Doe\",\n    \"status\": \"active\",\n    \"created_at\": \"2026-01-08T12:03:30.451Z\",\n    \"last_login\": \"2026-01-06T12:03:30.451Z\"\n  }\n]",
        "response_time": 3,
        "status": "success",
        "error": null,
        "executed_at": "2026-01-09T12:43:33.477Z"
      }
    }
  ]
}
```

**Response (200) - PostgreSQL Script:**
```json
{
  "success": true,
  "requests": [
    {
      "req_id": 48,
      "query": null,
      "script": "async function getAllUsers() {\n  console.log('Fetching all users...');\n  const result = await query('SELECT * FROM users ORDER BY id');\n  console.log('Total users:', result.rows.length);\n  result.rows.forEach((user, i) => console.log(`User ${i+1}:`, JSON.stringify(user)));\n}\ngetAllUsers();",
      "status": "EXECUTED",
      "database_name": "test_ecommerce",
      "comments": "test1",
      "pod_id": "db",
      "created_at": "2026-01-09T12:42:31.270Z",
      "approved_at": "2026-01-09T12:43:38.982Z",
      "requester_email": "dev1@zluri.com",
      "requester_name": "Dev1",
      "instance_name": "local-postgres",
      "database_type": "POSTGRES",
      "result": {
        "output": "Fetching all users...\nTotal users: 5\nUser 1: {\"id\":1,\"email\":\"john@example.com\",\"name\":\"John Doe\"}\nUser 2: {\"id\":2,\"email\":\"jane@example.com\",\"name\":\"Jane Smith\"}\n...",
        "response_time": 170,
        "status": "success",
        "error": null,
        "executed_at": "2026-01-09T12:43:39.161Z"
      }
    }
  ]
}
```

**Response (200) - MongoDB Query:**
```json
{
  "success": true,
  "requests": [
    {
      "req_id": 49,
      "query": "db.users.find({})",
      "script": null,
      "status": "EXECUTED",
      "database_name": "test_mongo",
      "comments": "fetch all users",
      "pod_id": "db",
      "created_at": "2026-01-09T12:42:52.790Z",
      "approved_at": "2026-01-09T12:43:44.842Z",
      "requester_email": "dev1@zluri.com",
      "requester_name": "Dev1",
      "instance_name": "local-mongo",
      "database_type": "MONGO",
      "result": {
        "output": "MongoDB find executed successfully on collection 'users'. 4 documents returned.\n\n[\n  {\n    \"_id\": \"user_001\",\n    \"name\": \"John Doe\",\n    \"email\": \"john@example.com\",\n    \"age\": 28,\n    \"status\": \"active\"\n  },\n  ...\n]",
        "response_time": 11,
        "status": "success",
        "error": null,
        "executed_at": "2026-01-09T12:43:44.884Z"
      }
    }
  ]
}
```

**Response (200) - MongoDB Script:**
```json
{
  "success": true,
  "requests": [
    {
      "req_id": 51,
      "query": null,
      "script": "async function getAllUsers() {\n  const users = await db.collection('users').find({}).toArray();\n  console.log('Total users:', users.length);\n  users.forEach((user, i) => console.log(`User ${i+1}:`, JSON.stringify(user)));\n}\ngetAllUsers();",
      "status": "EXECUTED",
      "database_name": "test_mongo",
      "comments": "test1",
      "pod_id": "db",
      "created_at": "2026-01-09T12:53:13.539Z",
      "approved_at": "2026-01-09T12:53:32.006Z",
      "requester_email": "dev1@zluri.com",
      "requester_name": "Dev1",
      "instance_name": "local-mongo",
      "database_type": "MONGO",
      "result": {
        "output": "Total users: 4\nUser 1: {\"_id\":\"user_001\",\"name\":\"John Doe\"}\nUser 2: {\"_id\":\"user_002\",\"name\":\"Jane Smith\"}\n...",
        "response_time": 244,
        "status": "success",
        "error": null,
        "executed_at": "2026-01-09T12:53:32.261Z"
      }
    }
  ]
}
```

**Response (200) - Pending Request (no result yet):**
```json
{
  "success": true,
  "requests": [
    {
      "req_id": 52,
      "query": "SELECT COUNT(*) FROM orders;",
      "script": null,
      "status": "PENDING",
      "database_name": "test_ecommerce",
      "comments": "Check order count",
      "pod_id": "db",
      "created_at": "2026-01-09T14:00:00.000Z",
      "approved_at": null,
      "requester_email": "dev1@zluri.com",
      "requester_name": "Dev1",
      "instance_name": "local-postgres",
      "database_type": "POSTGRES",
      "result": null
    }
  ]
}
```

**Business Logic:**
- Fetch only requests created by the logged-in user
- Join execution logs if available
- Enforce access via JWT identity
- Returns all request types: PostgreSQL queries/scripts, MongoDB queries/scripts

**Result:**
- Developer can track status (PENDING / APPROVED / EXECUTING / EXECUTED / FAILED)
- View execution output and response times
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
  "success": true,
  "output": "Query executed successfully. 10 rows returned.",
  "response_time": 150,
  "status": "success",
  "error": null
}
```

**Response (200) - Execution Failed:**
```json
{
  "success": true,
  "output": null,
  "response_time": 50,
  "status": "failure",
  "error": "Syntax error in SQL query"
}
```

**Response (200) - Not Executed Yet:**
```json
{
  "success": true,
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
  "success": true,
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
  "reason": "Query needs modification before approval"
}
```

**Response (200) - Approve:**
```json
{
  "success": true,
  "status": "approval"
}
```

**Response (200) - Reject:**
```json
{
  "success": true,
  "status": "reject",
  "reason": "Query needs modification before approval"
}
```

**Business Logic:**
- Single endpoint for approve/reject
- Validate manager authority
- Update request status atomically
- Record approval metadata
- On approval, query/script executes immediately (no operation blocking)

**Result:**
- Clean, extensible API design
- Prevents double approvals
- Triggers next stage (execution)
- Manager is responsible for reviewing query safety before approval

---

## Security Notes

### Query Execution Security Model
- **No automatic blocking** of dangerous operations (DROP, TRUNCATE, DELETE, etc.)
- **Manager approval is the primary security gate**
- Managers must review queries/scripts before approving
- All approved queries will execute as-is
- Execution results are logged for audit purposes

### Script Execution Security
- Scripts run in isolated worker threads
- 5-minute execution timeout
- Scripts cannot access server filesystem or environment
- Database credentials are injected, not exposed to script code

---



