const express = require("express");
const router = express.Router();

const requestController = require("../controllers/request.controller");
const approvalController = require("../controllers/approval.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { paginationSchema, reqIdParamSchema } = require("../validators/schemas");
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
    fileSize: 16 * 1024 * 1024,
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
      'LIMIT_FILE_SIZE': 'File too large. Maximum size is 16MB.',
      'LIMIT_FILE_COUNT': 'Too many files. Only one file allowed.'
    };
    
    const message = err instanceof multer.MulterError
      ? multerErrors[err.code] || `Upload error: ${err.message}`
      : err.message;
    
    return res.status(400).json({ success: false, message });
  });
};

router.post("/",authMiddleware,smartUploadMiddleware,requestController.submitRequest);
router.get("/mine",authMiddleware,validate({ query: paginationSchema }),requestController.getMyRequests);
router.get("/:req_id/result",authMiddleware,validate({ params: reqIdParamSchema }),approvalController.getExecutionResult);

module.exports = router;
