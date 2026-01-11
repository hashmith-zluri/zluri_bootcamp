const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Database Query Execution Portal",
      version: "1.0.0",
      description:
        "APIs for submitting, approving, and executing database queries and scripts"
    },
    servers: [
      {
        url: "http://localhost:4000/api",
        description: "Local server"
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: ["./src/routes/*.js"] // Swagger reads route comments
};

module.exports = swaggerJSDoc(options);
