const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// POST /api/auth/login
router.post("/login", authController.login);

// POST /api/auth/logout
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user and return JWT token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pass
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@zluri.com
 *               pass:
 *                 type: string
 *                 example: pass1
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authController.login);
