const validate = require('../../src/middlewares/validate.middleware');
const { z } = require('zod');

describe('Validate Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('body validation', () => {
    it('should pass valid body data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      mockReq.body = { name: 'John', age: 30 };

      validate({ body: schema })(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid body data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      mockReq.body = { name: 'John', age: 'not a number' };

      validate({ body: schema })(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errors: expect.any(Array)
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('query validation', () => {
    it('should pass valid query params', () => {
      const schema = z.object({
        limit: z.string().optional(),
        offset: z.string().optional()
      });

      mockReq.query = { limit: '10', offset: '0' };

      validate({ query: schema })(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 for invalid query params', () => {
      const schema = z.object({
        limit: z.string()
          .transform(val => parseInt(val))
          .refine(val => val >= 0, { message: 'Limit cannot be negative' })
      });

      mockReq.query = { limit: '-5' };

      validate({ query: schema })(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Limit cannot be negative'
        })
      );
    });
  });

  describe('params validation', () => {
    it('should pass valid params', () => {
      const schema = z.object({
        id: z.string().transform(val => parseInt(val))
      });

      mockReq.params = { id: '123' };

      validate({ params: schema })(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.params.id).toBe(123);
    });

    it('should return 400 for invalid params', () => {
      const schema = z.object({
        id: z.string()
          .transform(val => parseInt(val))
          .refine(val => !isNaN(val), { message: 'Invalid ID' })
      });

      mockReq.params = { id: 'abc' };

      validate({ params: schema })(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('combined validation', () => {
    it('should validate body, query, and params together', () => {
      const bodySchema = z.object({ name: z.string() });
      const querySchema = z.object({ page: z.string().optional() });
      const paramsSchema = z.object({ id: z.string() });

      mockReq.body = { name: 'Test' };
      mockReq.query = { page: '1' };
      mockReq.params = { id: '123' };

      validate({ body: bodySchema, query: querySchema, params: paramsSchema })(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should pass non-Zod errors to next', () => {
      const schema = {
        parse: () => { throw new Error('Non-Zod error'); }
      };

      validate({ body: schema })(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
