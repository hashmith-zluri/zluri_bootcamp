# Database Query Management & Risk Assessment API

## OpenAPI Documentation

This repository contains comprehensive OpenAPI 3.0.3 documentation for the Database Query Management & Risk Assessment API.

## 📋 Overview

The API provides a complete solution for managing database operations with built-in security analysis:

- **Multi-Database Support**: PostgreSQL and MongoDB
- **Advanced Risk Assessment**: AST-based SQL analysis and pattern-based security detection
- **Approval Workflow**: Manager approval system for database operations
- **Audit Trail**: Complete logging of all database operations
- **Security-First**: Built-in detection of dangerous operations and injection attacks

## 🔧 Using the Documentation

### Option 1: Swagger UI (Recommended)

1. **Online Swagger Editor**:
   - Go to [editor.swagger.io](https://editor.swagger.io/)
   - Copy the contents of `openapi.yaml`
   - Paste into the editor
   - View interactive documentation

2. **Local Swagger UI**:
   ```bash
   # Using Docker
   docker run -p 8080:8080 -e SWAGGER_JSON=/openapi.yaml -v $(pwd)/openapi.yaml:/openapi.yaml swaggerapi/swagger-ui
   
   # Access at http://localhost:8080
   ```

3. **VS Code Extension**:
   - Install "Swagger Viewer" extension
   - Open `openapi.yaml`
   - Right-click → "Preview Swagger"

### Option 2: Redoc

```bash
# Using npx
npx redoc-cli serve openapi.yaml

# Using Docker
docker run --rm -p 8080:80 -v $(pwd)/openapi.yaml:/usr/share/nginx/html/openapi.yaml redocly/redoc
```

### Option 3: Postman

1. Import the OpenAPI file into Postman
2. Generate a collection from the specification
3. Use for API testing and development

## 🚀 API Endpoints Overview

### Authentication
- `POST /api/auth/login` - User login with JWT token generation
- `POST /api/auth/logout` - User logout and token invalidation

### Database Management
- `GET /api/db/types` - Get supported database types
- `GET /api/db/instances` - Get database instances by type
- `GET /api/db/instances/{id}/name` - Get databases in an instance

### Request Management
- `POST /api/request` - Submit query/script request with risk assessment
- `GET /api/requests/mine` - Get user's requests with execution results
- `GET /api/requests/{reqid}/result` - Get specific request execution result

### Approval Management
- `GET /api/approvals` - Get pending approval requests (managers only)
- `POST /api/approvals/{reqId}/action` - Approve or reject requests

### Risk Assessment
- `POST /api/risk/assess` - Analyze query/script security risks
- `POST /api/risk/validate-syntax` - Validate SQL syntax

## 🛡️ Risk Assessment System

### Risk Levels

| Level | Score | Description | Examples |
|-------|-------|-------------|----------|
| **Critical** | 6+ | Immediate danger operations | `DROP TABLE`, `TRUNCATE`, `DELETE` without WHERE |
| **High** | 4-5 | Significant risk operations | `ALTER TABLE`, `GRANT`/`REVOKE`, User management |
| **Medium** | 2-3 | Standard operations with risk | `UPDATE`, `INSERT`, Conditional deletes |
| **Low** | 0-1 | Safe read-only operations | `SELECT`, `FIND`, Read queries |

### Analysis Methods

1. **SQL AST Analysis**: 
   - Uses Abstract Syntax Tree parsing
   - Structural analysis of SQL queries
   - Detects dangerous operations and patterns

2. **JavaScript Pattern Analysis**:
   - Security pattern detection in scripts
   - Identifies code injection risks
   - MongoDB-specific vulnerability detection

3. **Comment Handling**:
   - Proper removal of SQL (`--`, `/* */`) and JavaScript (`//`, `/* */`) comments
   - Prevents comment-based bypass attempts

## 📝 Example Usage

### 1. Submit a Query Request

```bash
curl -X POST "http://localhost:3000/api/request" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "databasetype": "POSTGRES",
    "instanceid": "1",
    "dbname": "postgres",
    "query": "SELECT * FROM users WHERE active = true LIMIT 10;",
    "comments": "Need to check active user data",
    "podid": "pod-1"
  }'
```

**Response with Risk Assessment**:
```json
{
  "success": true,
  "req_id": "123",
  "status": "PENDING",
  "riskAssessment": {
    "level": "low",
    "score": 0,
    "reasons": ["Read-only operation - safe to execute"],
    "recommendations": ["✅ LOW RISK: Safe to execute"]
  }
}
```

### 2. Analyze Risk Before Submission

```bash
curl -X POST "http://localhost:3000/api/risk/assess" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "DROP TABLE users;",
    "dbType": "POSTGRES"
  }'
```

**Response**:
```json
{
  "success": true,
  "assessment": {
    "level": "critical",
    "score": 6,
    "reasons": ["DROP operation - permanently deletes data"],
    "recommendations": [
      "🚨 CRITICAL: This operation should be reviewed by a senior developer",
      "🔒 Consider requiring additional approval for execution",
      "📋 Ensure you have a backup before proceeding"
    ],
    "analysis": {
      "method": "sql-ast",
      "astUsed": true,
      "detailedRisks": [
        {
          "type": "critical",
          "reason": "DROP table - permanently deletes data",
          "location": "root"
        }
      ]
    }
  }
}
```

### 3. Manager Approval with Risk Context

```bash
# Get pending requests (managers see risk assessment)
curl -X GET "http://localhost:3000/api/approvals" \
  -H "Authorization: Bearer MANAGER_JWT_TOKEN"

# Approve/reject based on risk assessment
curl -X POST "http://localhost:3000/api/approvals/123/action" \
  -H "Authorization: Bearer MANAGER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve"
  }'
```

## 🔐 Authentication

All endpoints (except login) require JWT authentication:

```bash
# Include in all requests
-H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### User Roles

- **Developer**: Can submit requests, view own requests
- **Manager**: Can approve/reject requests, view pending approvals
- **Admin**: Full access to all operations

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

### Risk Assessment Format
```json
{
  "level": "critical|high|medium|low",
  "score": 0-10,
  "reasons": ["List of security concerns"],
  "recommendations": ["Security recommendations"],
  "analysis": {
    "method": "sql-ast|javascript|none",
    "astUsed": true|false,
    "detailedRisks": [...]
  }
}
```

## 🧪 Testing

### Test Users (Development)

```json
{
  "developer": {
    "email": "dev1@zluri.com",
    "password": "pass1"
  },
  "manager": {
    "email": "manager1@zluri.com", 
    "password": "pass1"
  }
}
```

### Sample Queries for Testing

```sql
-- Low Risk
SELECT * FROM users WHERE active = true;

-- Medium Risk  
INSERT INTO users (name, email) VALUES ('Test', 'test@example.com');

-- High Risk
ALTER TABLE users ADD COLUMN new_field VARCHAR(255);

-- Critical Risk
DROP TABLE users;
```

## 🔍 Security Features

### SQL Injection Detection
- **Destructive Operations**: 100% detection (DROP, DELETE, TRUNCATE)
- **Data Modification**: 90% detection (UPDATE, INSERT)
- **Privilege Escalation**: 80% detection (GRANT, REVOKE)
- **Code Injection**: 85% detection (eval, $where, dynamic functions)

### MongoDB Security
- **Collection Operations**: Drop, deleteMany, updateMany detection
- **NoSQL Injection**: $where operator, JavaScript injection patterns
- **Empty Filters**: Detection of operations affecting all documents

### Comment Bypass Prevention
- Proper handling of SQL and JavaScript comments
- Multiline and nested comment support
- String literal preservation

## 📚 Additional Resources

- **Swagger Editor**: [editor.swagger.io](https://editor.swagger.io/)
- **OpenAPI Specification**: [spec.openapis.org](https://spec.openapis.org/oas/v3.0.3)
- **Postman Collection**: Import `openapi.yaml` to generate collection
- **API Testing**: Use the interactive documentation for live testing

## 🤝 Contributing

When updating the API:

1. Update the OpenAPI specification in `openapi.yaml`
2. Validate the specification using Swagger Editor
3. Test all endpoints with the updated documentation
4. Update examples and descriptions as needed

## 📄 License

This API documentation is provided under the MIT License.