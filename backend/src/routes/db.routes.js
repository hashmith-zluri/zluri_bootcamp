const express = require('express');
const router = express.Router();
const dbController = require('../controllers/db.controller');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { dbTypeSchema } = require('../validators/schemas');

/**
 * @swagger
 * /db/types:
 *   get:
 *     tags:
 *       - Database Management
 *     summary: Get supported database types
 *     description: Retrieve list of all supported database types
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 types:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["POSTGRES", "MONGO"]
 */
router.get('/types', auth, dbController.getDbTypes);

/**
 * @swagger
 * /db/instances:
 *   get:
 *     tags:
 *       - Database Management
 *     summary: Get database instances
 *     description: Retrieve database instances filtered by type
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [POSTGRES, MONGO]
 *         description: Database type to filter instances
 *         example: POSTGRES
 *     responses:
 *       200:
 *         description: Database instances retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 instances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "1"
 *                       name:
 *                         type: string
 *                         example: "local-postgres"
 *       400:
 *         description: Missing or invalid type parameter
 */
router.get('/instances', auth, validate({ query: dbTypeSchema }), dbController.getDbInstances);

/**
 * @swagger
 * /db/instances/{id}/name:
 *   get:
 *     tags:
 *       - Database Management
 *     summary: Get databases in instance
 *     description: Retrieve all databases available in a specific database instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Database instance ID
 *         example: "1"
 *     responses:
 *       200:
 *         description: Databases retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 databases:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["postgres", "template0", "template1", "test_ecommerce"]
 *       404:
 *         description: Instance not found
 */
router.get('/instances/:id/name', auth, dbController.getDatabasesByInstance);

module.exports = router;
