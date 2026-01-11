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

// Authentication routes
const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

// DB routes
const dbRoutes = require("./routes/db.routes");
app.use("/api/db", dbRoutes);

// Request routes
const requestRoutes = require("./routes/request.routes");
app.use("/api/request", requestRoutes);

// Approval routes
const approvalroutes = require("./routes/approval.routes")
app.use("/api/approvals", approvalroutes);

module.exports = app;
