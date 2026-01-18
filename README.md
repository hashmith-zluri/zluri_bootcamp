1. User Authentication with Role-Based Access Control
    1. Login
        - POST /api/auth/login with email and password
        - Returns JWT token on successful authentication
        - JWT token contains: userId, email, role
        - Token expiration configured via JWT_EXPIRES_IN environment variable
        - Active tokens tracked in memory for session management
    2. Logout
        - POST /api/auth/logout with Bearer token in Authorization header
        - Removes token from active tokens set (invalidates session)
    3. Security Implementation
        - Passwords stored using bcrypt with 10 rounds of salting
        - JWT verification checks both signature validity and active token status
        - Token error handling: TOKEN_EXPIRED, TOKEN_NOT_ACTIVE, TOKEN_INVALID,
        - Authorization header format: "Bearer <token>"
    4. Role-Based Access
        - Roles: USER, MANAGER, ADMIN
        - MANAGER role required for approval endpoints
        - MANAGER/ADMIN roles can view any request's execution results
        - Users can only view their own requests

2. Query/Script Submission
    1. Database Type Selection
        - GET /api/db/types returns supported types: ["POSTGRES", "MONGO"]
    2. Get DB Instances by Type
        - GET /api/db/instances?type=POSTGRES|MONGO
        - Returns list of instances with id and name
    3. Get Databases by Instance
        - GET /api/db/instances/:id/databases
        - Returns available database names for the selected instance
    4. Pod Selection
        - Available pods configured in config/pods.js
        - Each pod has: id, name, manager_email
        - Pod determines which manager receives the approval request
    5. Request Submission
        - POST /api/requests with multipart/form-data
        - Required fields: instance_id, db_name, comments, pod_id
        - Either query (text) OR script (file) must be provided, not both
        - Script file requirements:
            - Only .js files allowed
            - Maximum file size: 5MB
            - Stored in memory (not on disk)
            - Single file per request
        - Returns: req_id and status (PENDING)

3. Manager Approval/Rejection
    1. Get Approval Requests
        - GET /api/approvals
        - Only accessible by MANAGER role
        - Returns requests for pods managed by the logged-in manager
        - Manager-pod mapping defined in config/pods.js via manager_email
    2. Approve/Reject Request
        - POST /api/approvals/:req_id with action: "approve" | "reject"
        - Optional reason field for rejections
        - On approval: status changes to APPROVED, execution triggered automatically
        - On rejection: status changes to REJECTED
        - Only PENDING requests can be approved/rejected

4. Request History (Per User)
    1. Get User's Requests
        - GET /api/requests/mine
        - Returns all requests submitted by the authenticated user
        - Includes: query/script, status, database info, comments, timestamps
        - Includes execution results if available (output, error, execution_time)
    2. Request Statuses
        - PENDING: Awaiting manager approval
        - APPROVED: Approved, execution in progress
        - REJECTED: Rejected by manager
        - EXECUTING: Currently being executed
        - EXECUTED: Successfully executed
        - FAILED: Execution failed
    3. Get Execution Result
        - GET /api/requests/:req_id/result
        - Returns execution output, error, execution time, executed_at
        - Access: request owner, MANAGER

5. Query Execution (After Approval)
    1. Connection Pooling
        - PostgreSQL: Uses pg Pool with max 5 connections per instance+database
        - MongoDB: Uses MongoClient with maxPoolSize of 5
        - Connection idle timeout: 5 minutes (300000ms)
        - Pools are cached and reused for subsequent queries
        - One pool per instance+database combination
    2. Query Timeout
        - PostgreSQL: 30 second statement timeout
        - MongoDB: 30 second socket timeout
    3. MongoDB Query Format
        - Shell format: db.collection.operation(params)
        - Supported operations: find, findOne, count, aggregate, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, replaceOne, distinct, drop
        - Collection name validation: letters, numbers, underscores only
    4. Execution Flow
        - Request approved → status: APPROVED
        - Execution starts → status: EXECUTING
        - Execution completes → status: EXECUTED or FAILED
        - Results logged to execution_logs table
    5. Result Handling
        - Output includes row/document count and execution time
        - Errors captured with error message and code
    6. Script Execution
        - Supports both PostgreSQL and MongoDB scripts
        - Script content stored in database (not file system)
        - Routed to appropriate execution service based on database engine
