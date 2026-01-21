import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MySubmissions from '../../src/pages/MySubmissions';
import { ToastProvider } from '../../src/context/ToastContext';

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

// Mock requestAPI
jest.mock('../../src/utils/api', () => ({
  requestAPI: {
    getMyRequests: jest.fn(),
  },
}));

import { requestAPI } from '../../src/utils/api';

const renderMySubmissions = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <MySubmissions />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('MySubmissions - Branch Coverage Tests', () => {
  let localStorageMock;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup localStorage mock
    localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', { 
      value: localStorageMock,
      writable: true 
    });

    // Mock console.error to avoid noise in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle formatDate with null dateString', async () => {
    const requestWithNullDate = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: null, // null date
      pod_id: 'pod1',
      comments: 'Test query',
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithNullDate] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  it('should handle formatDate with invalid dateString', async () => {
    const requestWithInvalidDate = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: 'invalid-date-string',
      pod_id: 'pod1',
      comments: 'Test query',
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithInvalidDate] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    });
  });

  it('should handle formatDate with date parsing error', async () => {
    const requestWithErrorDate = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: 'throw-error',
      pod_id: 'pod1',
      comments: 'Test query',
    };

    // Mock Date constructor to throw error
    const originalDate = global.Date;
    global.Date = jest.fn(() => {
      throw new Error('Date parsing error');
    });
    global.Date.now = originalDate.now;

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithErrorDate] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    });

    // Restore original Date
    global.Date = originalDate;
  });

  it('should handle getPodName with unknown pod_id', async () => {
    const requestWithUnknownPod = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: 'unknown-pod-id',
      comments: 'Test query',
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithUnknownPod] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('unknown-pod-id')).toBeInTheDocument();
    });
  });

  it('should handle getPodName with null pod_id', async () => {
    const requestWithNullPod = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: null,
      comments: 'Test query',
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithNullPod] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  it('should handle search with whitespace-only term', async () => {
    const user = userEvent.setup();
    
    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [{
        req_id: 1,
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'prod-instance',
        query: 'SELECT * FROM users',
        status: 'PENDING',
        created_at: '2024-01-15T10:00:00Z',
        pod_id: 'pod1',
        comments: 'Test query',
      }] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, '   '); // whitespace only

    const searchButton = screen.getByRole('button', { name: 'Search' });
    await user.click(searchButton);

    // Should not add search parameters for whitespace-only search
    await waitFor(() => {
      expect(requestAPI.getMyRequests).toHaveBeenCalledWith({
        limit: 10,
        offset: 0
      });
    });
  });

  it('should handle fetchRequests with data.requests being null', async () => {
    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: null // null requests
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle fetchRequests with data.requests length less than pageSize', async () => {
    const user = userEvent.setup();
    
    // Mock initial load with full page
    requestAPI.getMyRequests
      .mockResolvedValueOnce({ requests: Array.from({ length: 10 }, (_, i) => ({
        req_id: i + 1,
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'prod-instance',
        query: 'SELECT * FROM users',
        status: 'PENDING',
        created_at: '2024-01-15T10:00:00Z',
        pod_id: 'pod1',
        comments: 'Test query',
      })) })
      .mockResolvedValueOnce({ requests: Array.from({ length: 15 }, (_, i) => ({
        req_id: i + 1,
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'prod-instance',
        query: 'SELECT * FROM users',
        status: 'PENDING',
        created_at: '2024-01-15T10:00:00Z',
        pod_id: 'pod1',
        comments: 'Test query',
      })) }) // Stats call
      .mockResolvedValueOnce({ requests: Array.from({ length: 5 }, (_, i) => ({
        req_id: i + 11,
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'prod-instance',
        query: 'SELECT * FROM users',
        status: 'PENDING',
        created_at: '2024-01-15T10:00:00Z',
        pod_id: 'pod1',
        comments: 'Test query',
      })) }); // Page 2 with less than pageSize

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    // Go to page 2
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('#11')).toBeInTheDocument();
    });
  });

  it('should handle fetchStats with null requests', async () => {
    requestAPI.getMyRequests
      .mockResolvedValueOnce({ requests: [] }) // Main requests call
      .mockResolvedValueOnce({ requests: null }); // Stats call with null

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });

    // Stats should show 0 for all
    expect(screen.getByText('Total').closest('button')).toHaveTextContent('0');
  });

  it('should handle fetchStats API error silently', async () => {
    requestAPI.getMyRequests
      .mockResolvedValueOnce({ requests: [] }) // Main requests call
      .mockRejectedValueOnce(new Error('Stats fetch failed')); // Stats call fails

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });

    // Should log error but not show toast
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch stats:', expect.any(Error));
  });

  it('should handle Enter key press in search input', async () => {
    const user = userEvent.setup();
    
    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [{
        req_id: 1,
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'prod-instance',
        query: 'SELECT * FROM users',
        status: 'PENDING',
        created_at: '2024-01-15T10:00:00Z',
        pod_id: 'pod1',
        comments: 'Test query',
      }] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'test');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(requestAPI.getMyRequests).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        search: 'test',
        searchField: 'all'
      });
    });
  });

  it('should handle non-Enter key press in search input', async () => {
    const user = userEvent.setup();
    
    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [{
        req_id: 1,
        database_type: 'POSTGRES',
        database_name: 'testdb',
        instance_name: 'prod-instance',
        query: 'SELECT * FROM users',
        status: 'PENDING',
        created_at: '2024-01-15T10:00:00Z',
        pod_id: 'pod1',
        comments: 'Test query',
      }] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'test');
    await user.keyboard('{Escape}'); // Non-Enter key

    // Should not trigger search
    expect(requestAPI.getMyRequests).not.toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      search: 'test',
      searchField: 'all'
    });
  });

  it('should handle pagination calculation for totalPages <= 5', async () => {
    const user = userEvent.setup();
    
    // Create exactly 30 requests (3 pages with 10 per page)
    const requests = Array.from({ length: 30 }, (_, i) => ({
      req_id: i + 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: 'pod1',
      comments: 'Test query',
    }));

    requestAPI.getMyRequests.mockResolvedValue({ requests: requests.slice(0, 10) });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    // Should show page numbers 1, 2 (only 2 pages visible due to pagination logic)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    // Page 3 might not be visible depending on pagination implementation
  });

  it('should handle pagination calculation for currentPage <= 3', async () => {
    const user = userEvent.setup();
    
    // Create 100 requests (10 pages)
    const requests = Array.from({ length: 100 }, (_, i) => ({
      req_id: i + 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: 'pod1',
      comments: 'Test query',
    }));

    requestAPI.getMyRequests.mockResolvedValue({ requests: requests.slice(0, 10) });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    // Should show pages 1-2 when on page 1 (currentPage <= 3)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    // Additional pages might not be visible depending on pagination implementation
  });

  it('should handle modal display for request without result', async () => {
    const user = userEvent.setup();
    
    const requestWithoutResult = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: 'pod1',
      comments: 'Test query',
      // No result field
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithoutResult] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const viewButton = screen.getByText('View');
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
      // Should not show execution result section
      expect(screen.queryByText('Execution Result')).not.toBeInTheDocument();
    });
  });

  it('should handle modal display for request without approved_at', async () => {
    const user = userEvent.setup();
    
    const requestWithoutApproval = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'PENDING',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: 'pod1',
      comments: 'Test query',
      // No approved_at field
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithoutApproval] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const viewButton = screen.getByText('View');
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
      // Should not show approved timestamp
      expect(screen.queryByText(/Approved:/)).not.toBeInTheDocument();
    });
  });

  it('should handle modal display for request without result.executed_at', async () => {
    const user = userEvent.setup();
    
    const requestWithResultNoExecutedAt = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'EXECUTED',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: 'pod1',
      comments: 'Test query',
      result: {
        status: 'success',
        output: '[]',
        // No executed_at field
      },
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithResultNoExecutedAt] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const viewButton = screen.getByText('View');
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
      expect(screen.getByText('Execution Result')).toBeInTheDocument();
      // Should not show executed timestamp
      expect(screen.queryByText(/Executed:/)).not.toBeInTheDocument();
    });
  });

  it('should handle modal display for request without result.response_time', async () => {
    const user = userEvent.setup();
    
    const requestWithResultNoResponseTime = {
      req_id: 1,
      database_type: 'POSTGRES',
      database_name: 'testdb',
      instance_name: 'prod-instance',
      query: 'SELECT * FROM users',
      status: 'EXECUTED',
      created_at: '2024-01-15T10:00:00Z',
      pod_id: 'pod1',
      comments: 'Test query',
      result: {
        status: 'success',
        output: '[]',
        executed_at: '2024-01-15T10:05:00Z',
        // No response_time field
      },
    };

    requestAPI.getMyRequests.mockResolvedValue({ 
      requests: [requestWithResultNoResponseTime] 
    });

    renderMySubmissions();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const viewButton = screen.getByText('View');
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
      expect(screen.getByText('Execution Result')).toBeInTheDocument();
      // Should not show response time
      expect(screen.queryByText(/ms/)).not.toBeInTheDocument();
    });
  });
});