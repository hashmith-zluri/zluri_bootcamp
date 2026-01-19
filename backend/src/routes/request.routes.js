const express = require("express");
const router = express.Router();

const requestController = require("../controllers/request.controller");
const approvalController = require("../controllers/approval.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { paginationSchema, reqIdParamSchema, submitRequestSchema } = require("../validators/schemas");
const multer = require('multer');
const path = require('path');

// Configure multer for in-memory storage (no file saving)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.js'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Only JavaScript (.js) files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: fileFilter
});

// Smart middleware that handles both queries and scripts
const smartUploadMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('script');
  
  uploadSingle(req, res, function (err) {
    if (!err) return next();
    
    // Multer error handling with lookup map
    const multerErrors = {
      'LIMIT_FILE_SIZE': 'File too large. Maximum size is 5MB.',
      'LIMIT_FILE_COUNT': 'Too many files. Only one file allowed.'
    };
    
    const message = err instanceof multer.MulterError
      ? multerErrors[err.code] || `Upload error: ${err.message}`
      : err.message;
    
    return res.status(400).json({ success: false, message });
  });
};

// Validation middleware for submit request (after multer)
const validateSubmitRequest = (req, res, next) => {
  try {
    // Convert instance_id to number if it's a string (from form-data)
    if (req.body.instance_id) {
      req.body.instance_id = parseInt(req.body.instance_id);
    }
    
    // Validate using schema
    submitRequestSchema.parse(req.body);
    next();
  } catch (error) {
    if (error.name === 'ZodError') {
      const errors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: errors[0]?.message || 'Validation failed',
        errors
      });
    }
    next(error);
  }
};

/**
 * @swagger
 * /request:
 *   post:
 *     tags:
 *       - Request Management
 *     summary: Submit query request
 *     description: |
 *       Submit a new database query or script request for approval.
 *       
 *       ## Risk Assessment
 *       All requests are automatically analyzed for security risks:
 *       - **SQL Queries**: AST-based analysis detects dangerous operations
 *       - **Scripts**: Pattern analysis identifies security vulnerabilities
 *       - **Risk Levels**: Critical, High, Medium, Low with detailed reasons
 *       
 *       ## Request Types
 *       - **Query**: Direct SQL/MongoDB query execution
 *       - **Script**: JavaScript code with database operations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - databasetype
 *               - instance_id
 *               - db_name
 *               - pod_id
 *             properties:
 *               databasetype:
 *                 type: string
 *                 enum: [POSTGRES, MONGO]
 *                 description: Database type
 *                 example: "POSTGRES"
 *               instance_id:
 *                 type: integer
 *                 description: Database instance ID
 *                 example: 1
 *               db_name:
 *                 type: string
 *                 description: Database name
 *                 example: "postgres"
 *               query_text:
 *                 type: string
 *                 description: SQL or MongoDB query to execute (mutually exclusive with script)
 *                 example: "SELECT * FROM users LIMIT 10;"
 *               script:
 *                 type: string
 *                 format: binary
 *                 description: JavaScript file to execute (mutually exclusive with query_text)
 *               comments:
 *                 type: string
 *                 description: Optional comments about the request
 *                 example: "Need to check user data"
 *               pod_id:
 *                 type: string
 *                 description: Pod ID for approval routing
 *                 example: "pod-1"
 *     responses:
 *       200:
 *         description: Request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 req_id:
 *                   type: string
 *                   example: "123"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: Invalid request data or file upload error
 *       401:
 *         description: Authentication required
 */
router.post("/", authMiddleware, smartUploadMiddleware, validateSubmitRequest, requestController.submitRequest);

/**
 * @swagger
 * /requests/mine:
 *   get:
 *     tags:
 *       - Request Management
 *     summary: Get user requests
 *     description: Retrieve all requests submitted by the authenticated user, including execution results
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of results per page
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Number of results to skip
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [created_at, approved_at]
 *         description: Sort field
 *     responses:
 *       200:
 *         description: User requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 requests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       req_id:
 *                         type: integer
 *                         example: 47
 *                       query:
 *                         type: string
 *                         nullable: true
 *                         example: "SELECT * FROM users LIMIT 1;"
 *                       script:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [PENDING, APPROVED, EXECUTING, EXECUTED, FAILED, REJECTED]
 *                         example: "EXECUTED"
 *                       database_name:
 *                         type: string
 *                         example: "test_ecommerce"
 *                       comments:
 *                         type: string
 *                         example: "Need to check"
 *                       pod_id:
 *                         type: string
 *                         example: "db"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       approved_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       requester_email:
 *                         type: string
 *                         example: "dev1@zluri.com"
 *                       requester_name:
 *                         type: string
 *                         example: "Dev1"
 *                       instance_name:
 *                         type: string
 *                         example: "local-postgres"
 *                       database_type:
 *                         type: string
 *                         enum: [POSTGRES, MONGO]
 *                         example: "POSTGRES"
 *                       result:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           output:
 *                             type: string
 *                             nullable: true
 *                           response_time:
 *                             type: integer
 *                             nullable: true
 *                           status:
 *                             type: string
 *                             enum: [success, failure, pending]
 *                           error:
 *                             type: string
 *                             nullable: true
 *                           executed_at:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 */
router.get("/mine",authMiddleware,validate({ query: paginationSchema }),requestController.getMyRequests);

/**
 * @swagger
 * /requests/{req_id}/result:
 *   get:
 *     tags:
 *       - Request Management
 *     summary: Get request execution result
 *     description: Retrieve the execution result for a specific request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: req_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Request ID
 *         example: "123"
 *     responses:
 *       200:
 *         description: Execution result retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 output:
 *                   type: string
 *                   nullable: true
 *                 response_time:
 *                   type: integer
 *                   nullable: true
 *                 status:
 *                   type: string
 *                   enum: [success, failure, pending]
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *                   nullable: true
 *       403:
 *         description: Access denied
 *       404:
 *         description: Request not found
 */
router.get("/:req_id/result",authMiddleware,validate({ params: reqIdParamSchema }),approvalController.getExecutionResult);

module.exports = router;
