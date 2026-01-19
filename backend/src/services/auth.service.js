const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/user.repository");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

const activeTokens = new Set();

// Functional validation utilities
const createValidator = (predicate, errorMessage) => (value) => 
  predicate(value) ? null : errorMessage;

const validateUser = createValidator(
  (user) => user !== null, 
  "Invalid email or password"
);

const validatePassword = (user, password) => 
  bcrypt.compare(password, user.password)
    .then(isValid => isValid ? null : "Invalid email or password")
    .catch(() => "Invalid email or password");

// Functional token verification
const createTokenVerifier = (activeTokens) => (token) => {
  const verificationStrategies = [
    // Strategy 1: JWT verification
    () => {
      try {
        return { success: true, decoded: jwt.verify(token, JWT_SECRET) };
      } catch (error) {
        return { success: false, error };
      }
    },
    
    // Strategy 2: Active token check
    (decoded) => activeTokens.has(token) 
      ? { success: true, decoded } 
      : { success: false, error: { name: 'TokenNotActive' } }
  ];
  
  const jwtResult = verificationStrategies[0]();
  if (!jwtResult.success) {
    activeTokens.delete(token);
    return mapJwtError(jwtResult.error);
  }
  
  const activeResult = verificationStrategies[1](jwtResult.decoded);
  return activeResult.success 
    ? activeResult.decoded 
    : { error: "TOKEN_NOT_ACTIVE" };
};

// Error mapping utility
const mapJwtError = (error) => {
  const errorMap = new Map([
    ['TokenExpiredError', { error: "TOKEN_EXPIRED", expiredAt: error.expiredAt }],
    ['JsonWebTokenError', { error: "TOKEN_INVALID" }]
  ]);
  
  return errorMap.get(error.name) || { error: "TOKEN_VERIFICATION_FAILED" };
};

const login = async (email, password) => {
  try {
    const user = await UserRepository.findByEmail(email);
    
    // Functional validation chain
    const userValidation = validateUser(user);
    if (userValidation) throw new Error(userValidation);
    
    const passwordValidation = await validatePassword(user, password);
    if (passwordValidation) throw new Error(passwordValidation);

    // Token creation with functional approach
    const createToken = (userData) => jwt.sign(
      {
        userId: userData.id,
        email: userData.email,
        role: userData.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const token = createToken(user);
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

const verifyToken = createTokenVerifier(activeTokens);

module.exports = {
  login,
  logout,
  verifyToken,
};
