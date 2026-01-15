const { ZodError } = require('zod');

/**
 * Validation middleware factory
 * @param {Object} schemas - Object containing schemas for body, query, params
 * @returns {Function} Express middleware
 */
const validate = (schemas) => {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          message: errors[0]?.message || 'Validation failed',
          errors
        });
      }
      next(error);
    }
  };
};

module.exports = validate;
