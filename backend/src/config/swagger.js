const swaggerJSDoc = require("swagger-jsdoc");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

// Load the comprehensive OpenAPI spec from the root directory
const loadOpenAPISpec = () => {
  try {
    const openApiPath = path.join(__dirname, "../../../openapi.yaml");
    const openApiContent = fs.readFileSync(openApiPath, "utf8");
    const openApiSpec = yaml.load(openApiContent);
    
    // Update servers to match current backend configuration
    openApiSpec.servers = [
      {
        url: "http://localhost:3000/api/v1",
        description: "Development server"
      },
      {
        url: "https://zluri-bootcamp-backend.up.railway.app/api/v1",
        description: "Production server"
      }
    ];
    
    // Update paths to match current API versioning
    const updatedPaths = {};
    Object.keys(openApiSpec.paths).forEach(path => {
      // Remove /api prefix since it's now /api/v1 in servers
      const newPath = path.startsWith('/api/') ? path.substring(4) : path;
      updatedPaths[newPath] = openApiSpec.paths[path];
    });
    openApiSpec.paths = updatedPaths;
    
    return openApiSpec;
  } catch (error) {
    console.warn("Could not load openapi.yaml, falling back to basic spec:", error.message);
    return null;
  }
};

// Fallback basic configuration if openapi.yaml is not available
const basicOptions = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Database Query Management API",
      version: "2.0.0",
      description: `
        A comprehensive API for managing database query requests with approval workflow.
        
        ## Features
        - **Multi-Database Support**: PostgreSQL and MongoDB
        - **Approval Workflow**: Manager approval system for database operations
        - **Audit Trail**: Complete logging of all database operations
        - **Security-First**: Built-in validation and access control
        
        ## Authentication
        All endpoints require JWT authentication via Bearer token.
      `,
      contact: {
        name: "API Support",
        email: "support@zluri.com"
      }
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1",
        description: "Development server"
      },
      {
        url: "https://zluri-bootcamp-backend.up.railway.app/api/v1",
        description: "Production server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"] // Swagger reads route and controller comments
};

// Try to load the comprehensive spec, fall back to basic if needed
const openApiSpec = loadOpenAPISpec();

if (openApiSpec) {
  console.log("✅ Loaded comprehensive OpenAPI specification from openapi.yaml");
  module.exports = openApiSpec;
} else {
  console.log("⚠️  Using basic Swagger configuration");
  module.exports = swaggerJSDoc(basicOptions);
}
