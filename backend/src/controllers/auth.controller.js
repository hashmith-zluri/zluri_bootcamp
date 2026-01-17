const authService = require("../services/auth.service");

// Helper functions
const createErrorResponse = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message
  });
};

const createSuccessResponse = (res, data, status = 200) => {
  return res.status(status).json({
    success: true,
    ...data
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    return createSuccessResponse(res, {
      token: result.token,
      user: result.user
    });
  } catch (error) {
    return createErrorResponse(res, 401, error.message || "Authentication failed");
  }
};

const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (token) {
      authService.logout(token);
    }
    
    return createSuccessResponse(res, {
      message: "Logged out successfully"
    });
  } catch (error) {
    return createErrorResponse(res, 500, error.message || "Logout failed");
  }
};

module.exports = {
  login,
  logout,
};
