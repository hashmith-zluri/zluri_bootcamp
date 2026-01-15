import { useState, useEffect, useMemo } from 'react';
import { approvalAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OutputDisplay from '../components/common/OutputDisplay';
import CodeEditor from '../components/common/CodeEditor';
import Tooltip from '../components/common/Tooltip';
import { assessQueryRisk, getRiskLabel } from '../utils/riskAssessment';

export default function ApprovalDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState({ all: 0, PENDING: 0, EXECUTED: 0, FAILED: 0, REJECTED: 0 });
  const toast = useToast();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchRequests = async (statusFilter = null) => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await approvalAPI.getPendingRequests(params);
      setRequests(data.requests || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats separately (all requests without filter)
  const fetchStats = async () => {
    try {
      const data = await approvalAPI.getPendingRequests({});
      const allRequests = data.requests || [];
      setStats({
        all: allRequests.length,
        PENDING: allRequests.filter(r => r.status === 'PENDING').length,
        EXECUTED: allRequests.filter(r => r.status === 'EXECUTED').length,
        FAILED: allRequests.filter(r => r.status === 'FAILED').length,
        REJECTED: allRequests.filter(r => r.status === 'REJECTED').length,
      });
    } catch (err) {
      // Silently fail for stats
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchRequests(filter);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Filter and search (search is client-side, status filter is server-side)
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (!debouncedSearch) return true;
      
      const searchLower = debouncedSearch.toLowerCase();
      
      switch (searchField) {
        case 'req_id':
          return req.req_id?.toString().includes(debouncedSearch);
        case 'requester_email':
          return req.requester_email?.toLowerCase().includes(searchLower);
        case 'requester_name':
          return req.requester_name?.toLowerCase().includes(searchLower);
        case 'database_name':
          return req.database_name?.toLowerCase().includes(searchLower);
        case 'query':
          return req.query?.toLowerCase().includes(searchLower) || req.script?.toLowerCase().includes(searchLower);
        case 'comments':
          return req.comments?.toLowerCase().includes(searchLower);
        case 'all':
        default:
          return (
            req.req_id?.toString().includes(debouncedSearch) ||
            req.requester_email?.toLowerCase().includes(searchLower) ||
            req.requester_name?.toLowerCase().includes(searchLower) ||
            req.database_name?.toLowerCase().includes(searchLower) ||
            req.query?.toLowerCase().includes(searchLower) ||
            req.script?.toLowerCase().includes(searchLower) ||
            req.comments?.toLowerCase().includes(searchLower)
          );
      }
    });
  }, [requests, debouncedSearch, searchField]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleApprove = (request) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleViewResult = (request) => {
    setSelectedRequest(request);
    setShowResultModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedRequest) return;
    
    setActionLoading(true);
    try {
      const result = await approvalAPI.approveOrReject(selectedRequest.req_id, 'approve');
      
      if (result.success) {
        toast.success(`Request #${selectedRequest.req_id} approved successfully`);
        setShowApproveModal(false);
        
        // Refresh to get latest data without changing filter
        setTimeout(() => {
          fetchRequests(filter);
          fetchStats();
        }, 1000);
      } else {
        toast.error(result.message || 'Failed to approve request');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmReject = async () => {
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    
    setActionLoading(true);
    try {
      const result = await approvalAPI.approveOrReject(selectedRequest.req_id, 'reject', rejectReason);
      
      if (result.success) {
        toast.success(`Request #${selectedRequest.req_id} rejected`);
        setShowRejectModal(false);
        
        // Refresh to get latest data without changing filter
        setTimeout(() => {
          fetchRequests(filter);
          fetchStats();
        }, 1000);
      } else {
        toast.error(result.message || 'Failed to reject request');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Approval Dashboard</h1>
        <p className="text-gray-600 mt-1">Review and manage pending requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {['all', 'PENDING', 'EXECUTED', 'FAILED', 'REJECTED'].map(status => {
          const count = stats[status] || 0;
          return (
            <button
              key={status}
              onClick={() => { setFilter(status); setCurrentPage(1); }}
              className={`p-4 rounded-lg border text-center transition-colors cursor-pointer ${
                filter === status 
                  ? 'bg-blue-50 border-blue-500 text-blue-700' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-gray-600 capitalize">
                {status === 'all' ? 'Total' : status.toLowerCase()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <select
          value={searchField}
          onChange={(e) => setSearchField(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="all">All Fields</option>
          <option value="req_id">Request ID</option>
          <option value="requester_email">Email</option>
          <option value="requester_name">Name</option>
          <option value="database_name">Database</option>
          <option value="query">Query/Script</option>
          <option value="comments">Comments</option>
        </select>
        
        <input
          type="text"
          placeholder={`Search by ${searchField === 'all' ? 'any field' : searchField.replace('_', ' ')}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-50 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Per page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value={1}>1</option>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requester</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Database</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No requests found
                </td>
              </tr>
            ) : (
              paginatedRequests.map(request => {
                const riskAssessment = assessQueryRisk(request.query, request.script, request.database_type);
                
                return (
                <tr key={request.req_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{request.req_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{request.requester_name}</div>
                    <div className="text-xs text-gray-400">{request.requester_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{request.database_name}</div>
                    <div className="text-xs text-gray-400">{request.instance_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        request.query ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {request.query ? 'Query' : 'Script'}
                      </span>
                      <Tooltip content={getRiskLabel(riskAssessment.level)}>
                        <span className={`text-xl ${riskAssessment.color}`}>
                          {riskAssessment.icon}
                        </span>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(request.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewResult(request)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                      {request.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(request)}
                            className="text-green-600 hover:text-green-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 border rounded text-sm ${
                    currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={confirmApprove}
        title="Approve Request"
        message={`Are you sure you want to approve request #${selectedRequest?.req_id}? This will execute the query/script immediately.`}
        confirmText="Approve"
        confirmStyle="success"
        loading={actionLoading}
      />

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Request"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for rejecting request #{selectedRequest?.req_id}
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowRejectModal(false)}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmReject}
              disabled={actionLoading || !rejectReason.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Result Modal */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={`Request #${selectedRequest?.req_id} Details`}
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-4">
            {/* Risk Assessment */}
            {(() => {
              const riskAssessment = assessQueryRisk(selectedRequest.query, selectedRequest.script, selectedRequest.database_type);
              return (
                <div className={`p-4 rounded-lg border-2 ${riskAssessment.bgColor} ${riskAssessment.borderColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-2xl ${riskAssessment.color}`}>{riskAssessment.icon}</span>
                    <span className={`text-lg font-semibold ${riskAssessment.color}`}>
                      {getRiskLabel(riskAssessment.level)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <p className={`font-medium mb-1 ${riskAssessment.color}`}>Risk Factors:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {riskAssessment.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {/* Status & Info */}
            <div className="flex items-center gap-4">
              <StatusBadge status={selectedRequest.status} />
              <span className="text-sm text-gray-500">
                {selectedRequest.database_type} • {selectedRequest.instance_name} • {selectedRequest.database_name}
              </span>
            </div>

            {/* Requester Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Requested by</h4>
              <p className="text-sm text-gray-600">
                {selectedRequest.requester_name} ({selectedRequest.requester_email})
              </p>
            </div>

            {/* Query/Script */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {selectedRequest.query ? 'Query' : 'Script'}
              </h4>
              <CodeEditor
                code={selectedRequest.query || selectedRequest.script}
                language={selectedRequest.query ? 
                  (selectedRequest.database_type === 'MONGO' ? 'javascript' : 'sql') : 
                  'javascript'
                }
                readOnly={true}
                showLineNumbers={false}
                maxHeight="300px"
                minHeight="150px"
              />
            </div>

            {/* Comments */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Comments</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {selectedRequest.comments}
              </p>
            </div>

            {/* Execution Result */}
            {selectedRequest.result && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Execution Result</h4>
                <div className={`p-4 rounded-lg ${
                  selectedRequest.result.status === 'success' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      {selectedRequest.result.status === 'success' ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={`text-sm font-medium ${
                        selectedRequest.result.status === 'success' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {selectedRequest.result.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    {selectedRequest.result.response_time && (
                      <span className="text-xs text-gray-500">
                        ({selectedRequest.result.response_time}ms)
                      </span>
                    )}
                  </div>
                  
                  <OutputDisplay 
                    output={selectedRequest.result.output}
                    error={selectedRequest.result.error}
                  />
                </div>
              </div>
            )}

            {/* Timestamps - moved to bottom */}
            <div className="text-xs text-gray-500 pt-4 border-t space-y-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Created:</span> {formatDate(selectedRequest.created_at)}
                </div>
                {selectedRequest.approved_at && (
                  <div>
                    <span className="font-medium">Approved:</span> {formatDate(selectedRequest.approved_at)}
                  </div>
                )}
              </div>
              {selectedRequest.result?.executed_at && (
                <div>
                  <span className="font-medium">Executed:</span> {formatDate(selectedRequest.result.executed_at)}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
