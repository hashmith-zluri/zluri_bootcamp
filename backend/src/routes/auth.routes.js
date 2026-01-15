const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { loginSchema } = require("../validators/schemas");

// POST /api/auth/login
router.post("/login", validate({ body: loginSchema }), authController.login);

// POST /api/auth/logout
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;

