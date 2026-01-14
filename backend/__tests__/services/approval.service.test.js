const approvalService = require('../../src/services/approval.service');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db');

describe('Approval Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getApprovalRequestsByPods - Basic', () => {
    const managedPods = ['pod1', 'pod2'];

    it('should return all results when no pagination params provided', async () => {
      query.mockResolvedValueOnce({ rows: Array(30).fill({ reqid: 1 }) });

      const result = await approvalService.getApprovalRequestsByPods(managedPods);

      expect(result).toHaveLength(30);
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('LIMIT'),
        expect.arrayContaining([managedPods])
      );
    });

    it('should handle custom limit and offset', async () => {
      query.mockResolvedValueOnce({ rows: Array(25).fill({ reqid: 1 }) });

      const result = await approvalService.getApprovalRequestsByPods(managedPods, {
        limit: 25,
        offset: 50
      });

      expect(result).toHaveLength(25);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([managedPods, 25, 50])
      );
    });
  });

  describe('getApprovalRequestsByPods - Filtering', () => {
    const managedPods = ['pod1', 'pod2'];

    it('should filter by status: PENDING', async () => {
      query.mockResolvedValueOnce({ rows: Array(8).fill({ reqid: 1, status: 'PENDING' }) });

      const result = await approvalService.getApprovalRequestsByPods(managedPods, { status: 'PENDING' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([managedPods, 'PENDING'])
      );
    });

    it('should filter by status: EXECUTED', async () => {
      query.mockResolvedValueOnce({ rows: Array(12).fill({ reqid: 1, status: 'EXECUTED' }) });

      await approvalService.getApprovalRequestsByPods(managedPods, { status: 'EXECUTED' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([managedPods, 'EXECUTED'])
      );
    });

    it('should ignore invalid status filter', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await approvalService.getApprovalRequestsByPods(managedPods, { status: 'INVALID' });

      // Should not include status filter
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('qr.status = $2'),
        expect.arrayContaining([managedPods])
      );
    });

    it('should handle case-insensitive status filter', async () => {
      query.mockResolvedValueOnce({ rows: Array(5).fill({ reqid: 1 }) });

      await approvalService.getApprovalRequestsByPods(managedPods, { status: 'pending' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([managedPods, 'PENDING'])
      );
    });
  });

  describe('getApprovalRequestsByPods - Sorting', () => {
    const managedPods = ['pod1', 'pod2'];

    it('should sort by created_at DESC (default)', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await approvalService.getApprovalRequestsByPods(managedPods);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY qr.created_at DESC'),
        expect.any(Array)
      );
    });

    it('should sort by status', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await approvalService.getApprovalRequestsByPods(managedPods, {
        sortBy: 'status'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY qr.status DESC'),
        expect.any(Array)
      );
    });

    it('should ignore invalid sortBy field', async () => {
      query.mockResolvedValueOnce({ rows: Array(10).fill({ reqid: 1 }) });

      await approvalService.getApprovalRequestsByPods(managedPods, { sortBy: 'invalid_field' });

      // Should default to created_at
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY qr.created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('getRequestById', () => {
    it('should return request when found', async () => {
      query.mockResolvedValue({
        rows: [{ pod_id: 'pod1', status: 'PENDING' }]
      });

      const result = await approvalService.getRequestById(1);

      expect(result).toEqual({ pod_id: 'pod1', status: 'PENDING' });
    });

    it('should return null when not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await approvalService.getRequestById(999);

      expect(result).toBeNull();
    });
  });

  describe('approveRequest', () => {
    it('should approve request successfully', async () => {
      query.mockResolvedValue({
        rows: [{ id: 1, query_text: 'SELECT 1', script_path: null }]
      });

      const result = await approvalService.approveRequest(1, 2);

      expect(result).toEqual({ id: 1, query_text: 'SELECT 1', script_path: null });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE query_requests'),
        [2, 1]
      );
    });

    it('should return null when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await approvalService.approveRequest(999, 2);

      expect(result).toBeNull();
    });
  });

  describe('rejectRequest', () => {
    it('should reject request with reason', async () => {
      query.mockResolvedValue({
        rows: [{ id: 1 }]
      });

      const result = await approvalService.rejectRequest(1, 2, 'Invalid query');

      expect(result).toEqual({ id: 1 });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE query_requests'),
        expect.arrayContaining([2, 1, '\n[REJECTED] Invalid query'])
      );
    });

    it('should reject request without reason', async () => {
      query.mockResolvedValue({
        rows: [{ id: 1 }]
      });

      const result = await approvalService.rejectRequest(1, 2, null);

      expect(result).toEqual({ id: 1 });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE query_requests'),
        expect.arrayContaining([2, 1, '\n[REJECTED] No reason provided'])
      );
    });

    it('should return null when request not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await approvalService.rejectRequest(999, 2, 'reason');

      expect(result).toBeNull();
    });
  });

  describe('logRejection', () => {
    it('should log rejection with reason', async () => {
      query.mockResolvedValue({ rows: [] });

      await approvalService.logRejection(1, 'Invalid query');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_logs'),
        expect.arrayContaining([1, false, null, 'Request rejected by manager. Reason: Invalid query', 0])
      );
    });

    it('should log rejection without reason', async () => {
      query.mockResolvedValue({ rows: [] });

      await approvalService.logRejection(1, null);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_logs'),
        expect.arrayContaining([1, false, null, 'Request rejected by manager. Reason: No reason provided', 0])
      );
    });
  });

  describe('getRequestOwnership', () => {
    it('should return ownership details when found', async () => {
      query.mockResolvedValue({
        rows: [{ requester_id: 5 }]
      });

      const result = await approvalService.getRequestOwnership(1);

      expect(result).toEqual({ requester_id: 5 });
    });

    it('should return null when not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await approvalService.getRequestOwnership(999);

      expect(result).toBeNull();
    });
  });
});
