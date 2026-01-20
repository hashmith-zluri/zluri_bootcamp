const approvalController = require('../../src/controllers/approval.controller');
const approvalService = require('../../src/services/approval.service');
const executionService = require('../../src/services/execution.service');
const slackService = require('../../src/services/slack.service');
const pods = require('../../src/config/pods');

jest.mock('../../src/services/approval.service');
jest.mock('../../src/services/execution.service');
jest.mock('../../src/services/slack.service');
jest.mock('../../src/config/pods');

describe('ApprovalController - Additional Coverage', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 1, email: 'manager@example.com', role: 'MANAGER' },
      params: { req_id: '1' },
      body: { action: 'approve' },
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('triggerExecution error handling', () => {
    it('should handle execution service errors and update status to FAILED', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);
      pods.find = jest.fn().mockReturnValue({ id: 'pod-1', name: 'Pod 1' });

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock approved request
      const mockApprovedRequest = {
        id: 1,
        query_text: 'SELECT * FROM users',
        script_path: null
      };
      approvalService.approveRequest.mockResolvedValue(mockApprovedRequest);

      // Mock execution service to throw error
      const executionError = new Error('Execution failed');
      executionService.executeQuery.mockRejectedValue(executionError);

      // Mock updateRequestStatus to also throw error (to cover the catch block)
      approvalService.updateRequestStatus.mockRejectedValue(new Error('Status update failed'));

      await approvalController.approveOrReject(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'approved'
      });
    });

    it('should handle execution service throwing synchronous error', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);
      pods.find = jest.fn().mockReturnValue({ id: 'pod-1', name: 'Pod 1' });

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock approved request
      const mockApprovedRequest = {
        id: 1,
        query_text: 'SELECT * FROM users',
        script_path: null
      };
      approvalService.approveRequest.mockResolvedValue(mockApprovedRequest);

      // Mock execution service to throw synchronous error
      executionService.executeQuery.mockImplementation(() => {
        throw new Error('Synchronous execution error');
      });

      // Mock updateRequestStatus
      approvalService.updateRequestStatus.mockResolvedValue();

      await approvalController.approveOrReject(req, res);

      expect(approvalService.updateRequestStatus).toHaveBeenCalledWith('1', 'FAILED');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'approved'
      });
    });
  });

  describe('sendRejectionNotification error handling', () => {
    it('should handle slack service disabled', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);
      pods.find = jest.fn().mockReturnValue({ id: 'pod-1', name: 'Pod 1' });

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock rejected request
      const mockRejectedRequest = {
        id: 1
      };
      approvalService.rejectRequest.mockResolvedValue(mockRejectedRequest);
      approvalService.logRejection.mockResolvedValue();

      // Mock slack service disabled
      slackService.isEnabled.mockReturnValue(false);

      req.body = { action: 'reject', reason: 'Test rejection' };

      await approvalController.approveOrReject(req, res);

      expect(slackService.isEnabled).toHaveBeenCalled();
      expect(approvalService.getRequestForNotification).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'rejected',
        reason: 'Test rejection'
      });
    });

    it('should handle missing request data for notification', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);
      pods.find = jest.fn().mockReturnValue({ id: 'pod-1', name: 'Pod 1' });

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock rejected request
      const mockRejectedRequest = {
        id: 1
      };
      approvalService.rejectRequest.mockResolvedValue(mockRejectedRequest);
      approvalService.logRejection.mockResolvedValue();

      // Mock slack service enabled but no request data
      slackService.isEnabled.mockReturnValue(true);
      approvalService.getRequestForNotification.mockResolvedValue(null);

      req.body = { action: 'reject', reason: 'Test rejection' };

      await approvalController.approveOrReject(req, res);

      expect(approvalService.getRequestForNotification).toHaveBeenCalledWith('1');
      expect(slackService.notifyRejection).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle slack notification error', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);
      pods.find = jest.fn().mockReturnValue({ id: 'pod-1', name: 'Pod 1' });

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock rejected request
      const mockRejectedRequest = {
        id: 1
      };
      approvalService.rejectRequest.mockResolvedValue(mockRejectedRequest);
      approvalService.logRejection.mockResolvedValue();

      // Mock slack service enabled with request data
      slackService.isEnabled.mockReturnValue(true);
      const mockRequestData = {
        id: 1,
        requester_name: 'John Doe',
        requester_email: 'john@example.com',
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'test-instance',
        query_text: 'SELECT * FROM users',
        script_path: null
      };
      approvalService.getRequestForNotification.mockResolvedValue(mockRequestData);

      // Mock slack notification to throw error
      slackService.notifyRejection.mockRejectedValue(new Error('Slack API error'));

      // Mock console.error to verify it's called
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      req.body = { action: 'reject', reason: 'Test rejection' };

      await approvalController.approveOrReject(req, res);

      expect(slackService.notifyRejection).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Slack notification failed:', 'Slack API error');
      expect(res.status).toHaveBeenCalledWith(200);

      consoleSpy.mockRestore();
    });

    it('should handle pod not found in pods config', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);
      pods.find = jest.fn().mockReturnValue(undefined); // Pod not found

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock rejected request
      const mockRejectedRequest = {
        id: 1
      };
      approvalService.rejectRequest.mockResolvedValue(mockRejectedRequest);
      approvalService.logRejection.mockResolvedValue();

      // Mock slack service enabled with request data
      slackService.isEnabled.mockReturnValue(true);
      const mockRequestData = {
        id: 1,
        requester_name: 'John Doe',
        requester_email: 'john@example.com',
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'test-instance',
        query_text: 'SELECT * FROM users',
        script_path: null
      };
      approvalService.getRequestForNotification.mockResolvedValue(mockRequestData);
      slackService.notifyRejection.mockResolvedValue();

      req.body = { action: 'reject', reason: 'Test rejection' };

      await approvalController.approveOrReject(req, res);

      expect(slackService.notifyRejection).toHaveBeenCalledWith(
        expect.objectContaining({
          pod_name: 'pod-1' // Should use pod_id as fallback when pod not found
        }),
        'Test rejection'
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle pod not found in pods config', async () => {
      // Mock pods to return managed pods but find returns undefined
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);
      pods.find = jest.fn().mockReturnValue(undefined); // Pod not found

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock rejected request
      const mockRejectedRequest = {
        id: 1
      };
      approvalService.rejectRequest.mockResolvedValue(mockRejectedRequest);
      approvalService.logRejection.mockResolvedValue();

      // Mock slack service enabled with request data
      slackService.isEnabled = jest.fn().mockReturnValue(true);
      const mockRequestData = {
        id: 1,
        requester_name: 'John Doe',
        requester_email: 'john@example.com',
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'test-instance',
        query_text: 'SELECT * FROM users',
        script_path: null
      };
      approvalService.getRequestForNotification.mockResolvedValue(mockRequestData);
      slackService.notifyRejection = jest.fn().mockResolvedValue();

      req.body = { action: 'reject', reason: 'Test rejection' };

      await approvalController.approveOrReject(req, res);

      expect(slackService.notifyRejection).toHaveBeenCalledWith(
        expect.objectContaining({
          pod_name: 'pod-1' // Should use pod_id as fallback when pod not found
        }),
        'Test rejection'
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getApprovalRequests with search parameters', () => {
    it('should handle search parameters correctly', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);

      req.query = {
        search: 'test search',
        searchField: 'all',
        status: 'PENDING',
        limit: '10',
        offset: '0'
      };

      const mockRows = [
        {
          reqid: 1,
          query_text: 'SELECT * FROM users',
          status: 'PENDING',
          database_name: 'testdb',
          comments: 'Test comment',
          pod_id: 'pod-1',
          created_at: new Date(),
          approved_at: null,
          requester_email: 'john@example.com',
          requester_name: 'John Doe',
          instance_name: 'test-instance',
          database_type: 'POSTGRES',
          executed_at: null
        }
      ];

      approvalService.getApprovalRequestsByPods.mockResolvedValue(mockRows);

      await approvalController.getApprovalRequests(req, res);

      expect(approvalService.getApprovalRequestsByPods).toHaveBeenCalledWith(
        ['pod-1'],
        {
          status: 'PENDING',
          sortBy: undefined,
          limit: '10',
          offset: '0',
          search: 'test search',
          searchField: 'all'
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requests: expect.arrayContaining([
          expect.objectContaining({
            req_id: 1,
            query: 'SELECT * FROM users',
            status: 'PENDING'
          })
        ])
      });
    });
  });

  describe('execution with no query or script', () => {
    it('should handle request with no query or script to execute', async () => {
      // Mock pods to return managed pods
      pods.filter = jest.fn().mockReturnValue([{ id: 'pod-1' }]);

      // Mock request with valid pod
      const mockRequest = {
        pod_id: 'pod-1',
        status: 'PENDING'
      };
      approvalService.getRequestById.mockResolvedValue(mockRequest);

      // Mock approved request with no query or script
      const mockApprovedRequest = {
        id: 1,
        query_text: null,
        script_path: null
      };
      approvalService.approveRequest.mockResolvedValue(mockApprovedRequest);

      // Mock console.log to verify it's called
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await approvalController.approveOrReject(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('No query or script to execute for request 1');
      expect(executionService.executeQuery).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'approved'
      });

      consoleSpy.mockRestore();
    });
  });
});