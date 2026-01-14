const requestService = require('../../src/services/request.service');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db');

describe('Request Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('should create a query request successfully', async () => {
      query.mockResolvedValue({
        rows: [{ id: 1, status: 'PENDING' }]
      });

      const result = await requestService.createRequest({
        userId: 1,
        instanceId: 1,
        dbName: 'test_db',
        queryText: 'SELECT * FROM users',
        scriptContent: null,
        comments: 'Test query',
        podId: 'pod1'
      });

      expect(result.id).toBe(1);
      expect(result.status).toBe('PENDING');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO query_requests'),
        expect.arrayContaining([1, 1, 'test_db', 'SELECT * FROM users', null, 'Test query', 'pod1'])
      );
    });

    it('should create a script request successfully', async () => {
      query.mockResolvedValue({
        rows: [{ id: 2, status: 'PENDING' }]
      });

      const result = await requestService.createRequest({
        userId: 1,
        instanceId: 1,
        dbName: 'test_db',
        queryText: null,
        scriptContent: 'console.log("test")',
        comments: 'Test script',
        podId: 'pod1'
      });

      expect(result.id).toBe(2);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('getUserRequests - Pagination', () => {
    it('should return all results when no pagination params provided', async () => {
      query.mockResolvedValueOnce({ rows: Array(25).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1);

      expect(result).toHaveLength(25);
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('LIMIT'),
        expect.arrayContaining([1])
      );
    });

    it('should handle custom limit and offset', async () => {
      query.mockResolvedValueOnce({ rows: Array(20).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, {
        limit: 20,
        offset: 20
      });

      expect(result).toHaveLength(20);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 20, 20])
      );
    });

    it('should handle boundary: limit = 1 (minimum)', async () => {
      query.mockResolvedValueOnce({ rows: [{ reqid: 1 }] });

      const result = await requestService.getUserRequests(1, { limit: 1, offset: 0 });

      expect(result).toHaveLength(1);
    });

    it('should handle boundary: limit = 100 (maximum)', async () => {
      query.mockResolvedValueOnce({ rows: Array(100).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, { limit: 100, offset: 0 });

      expect(result).toHaveLength(100);
    });

    it('should handle boundary: limit > 100 (should cap at 100)', async () => {
      query.mockResolvedValueOnce({ rows: Array(100).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, { limit: 500, offset: 0 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 100, 0])
      );
    });

    it('should handle boundary: limit = 0 (should default to 10)', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, { limit: 0, offset: 0 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 10, 0])
      );
    });

    it('should handle boundary: negative limit (should default to 1)', async () => {
      query.mockResolvedValueOnce({ rows: [{ reqid: 1 }] });

      const result = await requestService.getUserRequests(1, { limit: -5, offset: 0 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 1, 0])
      );
    });

    it('should handle boundary: offset = 0 (first page)', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, { limit: 10, offset: 0 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET'),
        expect.arrayContaining([1, 10, 0])
      );
    });

    it('should handle boundary: negative offset (should default to 0)', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, { limit: 10, offset: -10 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET'),
        expect.arrayContaining([1, 10, 0])
      );
    });

    it('should handle boundary: offset beyond total (empty results)', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await requestService.getUserRequests(1, { limit: 10, offset: 100 });

      expect(result).toHaveLength(0);
    });

    it('should handle boundary: total = 0 (no records)', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await requestService.getUserRequests(1);

      expect(result).toHaveLength(0);
    });

    it('should handle last page correctly', async () => {
      query.mockResolvedValueOnce({ rows: Array(5).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, {
        limit: 10,
        offset: 20
      });

      expect(result).toHaveLength(5);
    });
  });

  describe('getUserRequests - Filtering', () => {
    it('should filter by status: PENDING', async () => {
      query.mockResolvedValueOnce({ rows: Array(5).fill({ reqid: 1, status: 'PENDING' }) });

      const result = await requestService.getUserRequests(1, { status: 'PENDING' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([1, 'PENDING'])
      );
    });

    it('should filter by status: APPROVED', async () => {
      query.mockResolvedValueOnce({ rows: Array(3).fill({ reqid: 1, status: 'APPROVED' }) });

      await requestService.getUserRequests(1, { status: 'APPROVED' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([1, 'APPROVED'])
      );
    });

    it('should filter by status: EXECUTED', async () => {
      query.mockResolvedValueOnce({ rows: Array(8).fill({ reqid: 1, status: 'EXECUTED' }) });

      await requestService.getUserRequests(1, { status: 'EXECUTED' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([1, 'EXECUTED'])
      );
    });

    it('should ignore invalid status filter', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await requestService.getUserRequests(1, { status: 'INVALID_STATUS' });

      // Should not include status filter in query
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('qr.status = $2'),
        expect.arrayContaining([1])
      );
    });

    it('should handle case-insensitive status filter', async () => {
      query.mockResolvedValueOnce({ rows: Array(5).fill({ reqid: 1 }) });

      await requestService.getUserRequests(1, { status: 'pending' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([1, 'PENDING'])
      );
    });
  });

  describe('getUserRequests - Sorting', () => {
    it('should sort by created_at DESC (default)', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await requestService.getUserRequests(1);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY qr.created_at DESC'),
        expect.any(Array)
      );
    });

    it('should sort by status', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await requestService.getUserRequests(1, { sortBy: 'status' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY qr.status DESC'),
        expect.any(Array)
      );
    });

    it('should sort by database_name', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await requestService.getUserRequests(1, { sortBy: 'database_name' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY qr.database_name DESC'),
        expect.any(Array)
      );
    });

    it('should ignore invalid sortBy field', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await requestService.getUserRequests(1, { sortBy: 'invalid_field' });

      // Should default to created_at
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY qr.created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('getUserRequests - Combined Filters', () => {
    it('should handle status filter + pagination + sorting', async () => {
      query.mockResolvedValueOnce({ rows: Array(5).fill({ reqid: 1 }) });

      const result = await requestService.getUserRequests(1, {
        status: 'PENDING',
        sortBy: 'created_at',
        limit: 5,
        offset: 10
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([1, 'PENDING', 5, 10])
      );
    });
  });
});
