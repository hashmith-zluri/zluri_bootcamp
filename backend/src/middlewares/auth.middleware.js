const authService = require("../services/auth.service");

module.exports = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const decoded = authService.verifyToken(token);

    if (!decoded || decoded.error) {
      const errorMessages = {
        TOKEN_EXPIRED: "Token has expired. Please login again.",
        TOKEN_NOT_ACTIVE: "Token is not active. Please login again.",
        TOKEN_INVALID: "Invalid token. Please login again.",
        TOKEN_VERIFICATION_FAILED: "Token verification failed. Please login again."
      };
      
      const message = errorMessages[decoded?.error] || "Invalid or expired token";
      
      return res.status(401).json({
        success: false,
        message: message,
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    req.token = token;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};
