const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET ;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

const activeTokens = new Set();

const login = async (email, password) => {
  try {
    const userResult = await query(
      "SELECT id, email, name, password, role FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      throw new Error("Invalid email or password");
    }
    const user = userResult.rows[0];
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (error) {
      isPasswordValid = false;
    }
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    activeTokens.add(token);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    throw error;
  }
};

const logout = (token) => {
  activeTokens.delete(token);
  return true;
};

const verifyToken = (token) => {
  try {
    // First check JWT validity
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Then check if token is in active set
    if (!activeTokens.has(token)) {
      return { error: "TOKEN_NOT_ACTIVE" };
    }
    
    return decoded;
  } catch (error) {
    // Remove invalid token from active set
    activeTokens.delete(token);
    
    const jwtErrorMap = {
      TokenExpiredError: { error: "TOKEN_EXPIRED", expiredAt: error.expiredAt },
      JsonWebTokenError: { error: "TOKEN_INVALID" }
    };
    
    return jwtErrorMap[error.name] || { error: "TOKEN_VERIFICATION_FAILED" };
  }
};

module.exports = {
  login,
  logout,
  verifyToken,
};
