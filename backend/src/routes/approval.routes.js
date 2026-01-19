const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const approvalController = require("../controllers/approval.controller");
const { paginationSchema, approvalActionSchema, reqIdParamSchema } = require("../validators/schemas");

/**
 * @swagger
 * /approvals:
 *   get:
 *     tags:
 *       - Approval Management
 *     summary: Get pending approval requests
 *     description: |
 *       Retrieve all pending requests for the manager's assigned pods.
 *       
 *       ## Risk Assessment Integration
 *       Each request includes comprehensive risk assessment data to help managers make informed approval decisions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, EXECUTING, EXECUTED, FAILED]
 *         description: Filter by request status
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [created_at, approved_at]
 *         description: Sort field
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
 *     responses:
 *       200:
 *         description: Approval requests retrieved successfully
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
 *                         type: string
 *                         example: "123"
 *                       query:
 *                         type: string
 *                         nullable: true
 *                         example: "SELECT * FROM users"
 *                       script:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 *                       database_name:
 *                         type: string
 *                         example: "postgres"
 *                       comments:
 *                         type: string
 *                         example: "Need to check user data"
 *                       pod_id:
 *                         type: string
 *                         example: "pod-1"
 *                       created_at:
 *                         type: string
 *                         format: date-time
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
 *       403:
 *         description: Access denied - not a manager or no pods assigned
 */
router.get("/", auth, validate({ query: paginationSchema }), approvalController.getApprovalRequests);

/**
 * @swagger
 * /approvals/{req_id}/action:
 *   post:
 *     tags:
 *       - Approval Management
 *     summary: Approve or reject request
 *     description: |
 *       Approve or reject a pending request.
 *       
 *       ## Security Considerations
 *       Managers should carefully review the risk assessment before approving:
 *       - **Critical Risk**: Requires senior developer review
 *       - **High Risk**: Verify WHERE clauses and conditions
 *       - **Medium Risk**: Standard review recommended
 *       - **Low Risk**: Safe to execute
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Action to perform
 *                 example: "approve"
 *               reason:
 *                 type: string
 *                 description: Reason for rejection (required if action is reject)
 *                 example: "Query needs modification before approval"
 *     responses:
 *       200:
 *         description: Action completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   enum: [approved, rejected]
 *                   example: "approved"
 *                 reason:
 *                   type: string
 *                   nullable: true
 *                   description: Rejection reason (only present if rejected)
 *       400:
 *         description: Invalid action or request already processed
 *       403:
 *         description: Access denied
 *       404:
 *         description: Request not found
 */
router.post("/:req_id/action", auth, validate({ params: reqIdParamSchema, body: approvalActionSchema }), approvalController.approveOrReject);

module.exports = router;
