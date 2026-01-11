const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const approvalController = require("../controllers/approval.controller");

router.get("/", auth, approvalController.getApprovalRequests);
router.post("/:req_id/action", auth, approvalController.approveOrReject);

module.exports = router;
