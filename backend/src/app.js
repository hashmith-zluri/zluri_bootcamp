const express = require("express");
const app = express();
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
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

module.exports = app;
