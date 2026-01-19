const express = require("express");
const app = express();
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

// Enhanced Swagger UI configuration
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #3b82f6; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 10px; border-radius: 4px; }
  `,
  customSiteTitle: "Database Query Management API Documentation",
  customfavIcon: "/favicon.ico"
};

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));

// Redirect root to API docs for convenience
app.get("/", (req, res) => {
  res.redirect("/api-docs");
});

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    documentation: "/api-docs"
  });
});

const API_VERSION = "/api/v1";

// Authentication routes
const authRoutes = require("./routes/auth.routes");
app.use(`${API_VERSION}/auth`, authRoutes);

// DB routes
const dbRoutes = require("./routes/db.routes");
app.use(`${API_VERSION}/db`, dbRoutes);

// Request routes
const requestRoutes = require("./routes/request.routes");
app.use(`${API_VERSION}/request`, requestRoutes);

// Approval routes
const approvalroutes = require("./routes/approval.routes")
app.use(`${API_VERSION}/approvals`, approvalroutes);

// Slack routes
const slackRoutes = require("./routes/slack.routes");
app.use(`${API_VERSION}/slack`, slackRoutes);

module.exports = app;
