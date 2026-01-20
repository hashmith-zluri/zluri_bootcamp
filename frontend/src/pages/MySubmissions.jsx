import { useState, useEffect } from 'react';
import { requestAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OutputDisplay from '../components/common/OutputDisplay';
import CodeEditor from '../components/common/CodeEditor';
// import { assessQueryRisk, getRiskLabel } from '../utils/riskAssessment';
import { PODS } from '../utils/constants';

export default function MySubmissions() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [stats, setStats] = useState({ all: 0, PENDING: 0, EXECUTED: 0, FAILED: 0, REJECTED: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const toast = useToast();

  const fetchRequests = async (statusFilter = null, page = 1, pageSize = itemsPerPage, searchTerm = '', searchField = 'all') => {
    try {
      setLoading(true);
      
      const params = {
        limit: pageSize,
        offset: (page - 1) * pageSize
      };
      
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      // Add search parameters for server-side search
      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
        params.searchField = searchField;
      }
      
      const data = await requestAPI.getMyRequests(params);
      setRequests(data.requests || []);
      
      // For server-side search, we get accurate count
      if (data.requests) {
        if (data.requests.length < pageSize) {
          // If we got less than requested, we're on the last page
          setTotalCount((page - 1) * pageSize + data.requests.length);
        } else {
          // Estimate there might be more pages
          setTotalCount(page * pageSize + 1);
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats separately (all requests without filter)
  const fetchStats = async () => {
    try {
      const data = await requestAPI.getMyRequests({});
      const allRequests = data.requests || [];
      
      // Single loop optimization: calculate all stats in one pass
      const stats = allRequests.reduce((acc, request) => {
        acc.all++;
        acc[request.status] = (acc[request.status] || 0) + 1;
        return acc;
      }, { all: 0, PENDING: 0, EXECUTED: 0, FAILED: 0, REJECTED: 0 });
      
      setStats(stats);
    } catch (err) {
      // Silently fail for stats
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchRequests(filter, currentPage, itemsPerPage, appliedSearch, searchField);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, currentPage, itemsPerPage, appliedSearch, searchField]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const getPodName = (podId) => {
    const pod = PODS.find(p => p.id === podId);
    return pod ? pod.name : podId || 'N/A';
  };

  // Handle search button click
  const handleSearch = () => {
    setAppliedSearch(searchTerm);
    setCurrentPage(1);
    // Server-side search will be triggered by useEffect
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setAppliedSearch('');
    setCurrentPage(1);
    // Server-side search will be triggered by useEffect
  };

  // Handle Enter key in search input
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredRequests = requests; // Server-side filtering

  // No client-side search needed - all handled by server
  const searchedRequests = filteredRequests;

  // Server-side pagination - use server results directly
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const paginatedRequests = searchedRequests;

  const handleViewResult = (request) => {
    setSelectedRequest(request);
    setShowResultModal(true);
  };

  const handleClone = (request) => {
    // Store complete request data for cloning
    localStorage.setItem('cloneRequest', JSON.stringify({
      query: request.query || null,
      script: request.script || null,
      database_type: request.database_type,
      database_name: request.database_name,
      instance_name: request.instance_name,
      comments: request.comments,
      pod_id: request.pod_id,
    }));
    toast.success('Request data copied! Redirecting to Submit Request...');
    
    // Redirect to submit request page after a short delay
    setTimeout(() => {
      window.location.href = '/submit';
    }, 1000);
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'N/A';
    }
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
        <p className="text-gray-600 mt-1">Track your submitted requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {['all', 'PENDING', 'EXECUTED', 'FAILED', 'REJECTED'].map(status => {
          const count = stats[status] || 0;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
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
          <option value="database_name">Database</option>
          <option value="instance_name">Instance</option>
          <option value="pod">Pod</option>
          <option value="query">Query/Script</option>
          <option value="comments">Comments</option>
          <option value="created_at">Created Date</option>
          <option value="approved_at">Approved Date</option>
          {/* <option value="risk">Risk Level</option> */}
        </select>
        
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder={`Search by ${searchField === 'all' ? 'any field' : searchField.replace('_', ' ')}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            className="flex-1 min-w-50 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Search
          </button>
          {appliedSearch && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Clear
            </button>
          )}
        </div>
        
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Database</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pod</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
              {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th> */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {loading ? 'Loading...' : 'No requests found'}
                </td>
              </tr>
            ) : (
              paginatedRequests.map(request => {
                // const riskAssessment = assessQueryRisk(request.query, request.script, request.database_type);
                
                return (
                <tr key={request.req_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{request.req_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      request.query ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {request.query ? 'Query' : 'Script'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{request.database_name}</div>
                    <div className="text-xs text-gray-400">{request.instance_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getPodName(request.pod_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{formatDate(request.created_at)}</div>
                  </td>
                  {/* <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskAssessment.bgColor} ${riskAssessment.color}`}>
                      {getRiskLabel(riskAssessment.level)}
                    </span>
                  </td> */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewResult(request)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                      {(request.status === 'REJECTED' || request.status === 'FAILED') && (
                        <button
                          onClick={() => handleClone(request)}
                          className="text-green-600 hover:text-green-800"
                        >
                          Clone
                        </button>
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
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                // Show first page, last page, current page, and pages around current
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 border rounded text-sm ${
                      currentPage === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
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

      {/* Result Modal */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={`Request #${selectedRequest?.req_id} Details`}
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-4">
            {/* Status & Info */}
            <div className="flex items-center gap-4">
              <StatusBadge status={selectedRequest.status} />
              <span className="text-sm text-gray-500">
                {selectedRequest.database_type} • {selectedRequest.instance_name} • {selectedRequest.database_name}
              </span>
            </div>

            {/* Pod Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Pod</h4>
              <p className="text-sm text-gray-600">
                {getPodName(selectedRequest.pod_id)}
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
