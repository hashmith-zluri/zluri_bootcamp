const express = require("express");
const router = express.Router();

const requestController = require("../controllers/request.controller");
const approvalController = require("../controllers/approval.controller");
const authMiddleware = require("../middlewares/auth.middleware");
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
  storage: storage, // Store in memory, not on disk
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit
    files: 1
  },
  fileFilter: fileFilter
});

// Smart middleware that handles both queries and scripts
const smartUploadMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('script');
  
  uploadSingle(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB.'
        });
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Only one file allowed.'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    // File upload succeeded or no file was provided - both are OK
    next();
  });
};

router.post(
  "/",
  authMiddleware,
  smartUploadMiddleware,
  requestController.submitRequest
);

router.get(
  "/mine",
  authMiddleware,
  requestController.getMyRequests
);

router.get(
  "/:req_id/result",
  authMiddleware,
  approvalController.getExecutionResult
);

module.exports = router;
