const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const approvalController = require("../controllers/approval.controller");
const { paginationSchema, approvalActionSchema, reqIdParamSchema } = require("../validators/schemas");

router.get("/", auth, validate({ query: paginationSchema }), approvalController.getApprovalRequests);
router.post("/:req_id/action", auth, validate({ params: reqIdParamSchema, body: approvalActionSchema }), approvalController.approveOrReject);

module.exports = router;
