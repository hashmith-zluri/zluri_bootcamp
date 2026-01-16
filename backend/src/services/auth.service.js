const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/user.repository");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

const activeTokens = new Set();

const login = async (email, password) => {
  try {
    const user = await UserRepository.findByEmail(email);
    
    if (!user) {
      throw new Error("Invalid email or password");
    }
    
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
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!activeTokens.has(token)) {
      return { error: "TOKEN_NOT_ACTIVE" };
    }
    
    return decoded;
  } catch (error) {
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
