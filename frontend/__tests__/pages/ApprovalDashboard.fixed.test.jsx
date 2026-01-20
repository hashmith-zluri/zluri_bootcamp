import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ApprovalDashboard from '../../src/pages/ApprovalDashboard';
import { ToastProvider } from '../../src/context/ToastContext';
import { approvalAPI } from '../../src/utils/api';

// Mock the API
jest.mock('../../src/utils/api', () => ({
  approvalAPI: {
    getPendingRequests: jest.fn(),
    approveOrReject: jest.fn()
  }
}));

// Mock CodeEditor component
jest.mock('../../src/components/common/CodeEditor', () => {
  return function MockCodeEditor({ code, readOnly }) {
    return <div data-testid="code-editor">{code}</div>;
  };
});

const mockRequests = [
  {
    req_id: 1,
    query: 'SELECT * FROM users',
    script: null,
    status: 'PENDING',
    database_name: 'testdb',
    comments: 'Test comment',
    pod_id: 'pod-1',
    created_at: '2024-01-15T15:30:00Z',
    approved_at: null,
    requester_email: 'john@example.com',
    requester_name: 'John Doe',
    instance_name: 'prod-instance',
    database_type: 'POSTGRES',
    result: null
  },
  {
    req_id: 2,
    query: null,
    script: 'console.log("test")',
    status: 'EXECUTED',
    database_name: 'mongodb',
    comments: 'Script test',
    pod_id: 'pod-2',
    created_at: '2024-01-14T15:30:00Z',
    approved_at: '2024-01-14T16:00:00Z',
    requester_email: 'jane@example.com',
    requester_name: 'Jane Doe',
    instance_name: 'mongo-instance',
    database_type: 'MONGO',
    result: {
      output: 'Success',
      response_time: 150,
      status: 'success',
      error: null,
      executed_at: '2024-01-14T16:01:00Z'
    }
  }
];

const renderApprovalDashboard = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <ApprovalDashboard />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('ApprovalDashboard - Fixed Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock setup
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: mockRequests });
  });

  describe('Search functionality with empty results', () => {
    it('should show "No requests found" when search returns empty results', async () => {
      const user = userEvent.setup();
      
      renderApprovalDashboard();
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Reset mock to return empty results for search
      approvalAPI.getPendingRequests.mockResolvedValue({ requests: [] });
      
      // Perform search
      const searchInput = screen.getByPlaceholderText(/Search by/);
      await user.type(searchInput, 'nonexistent');
      
      const searchButton = screen.getByRole('button', { name: 'Search' });
      await user.click(searchButton);
      
      // Wait for empty results
      await waitFor(() => {
        expect(screen.getByText('No requests found')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle search by specific field with empty results', async () => {
      const user = userEvent.setup();
      
      renderApprovalDashboard();
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Reset mock to return empty results for search
      approvalAPI.getPendingRequests.mockResolvedValue({ requests: [] });
      
      // Select search field
      const searchFieldSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(searchFieldSelect, 'comments');
      
      // Perform search
      const searchInput = screen.getByPlaceholderText(/Search by/);
      await user.type(searchInput, 'nonexistent');
      
      const searchButton = screen.getByRole('button', { name: 'Search' });
      await user.click(searchButton);
      
      // Verify API call
      await waitFor(() => {
        expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({
          limit: 10,
          offset: 0,
          status: 'PENDING',
          search: 'nonexistent',
          searchField: 'comments'
        });
      });
      
      // Wait for empty results
      await waitFor(() => {
        expect(screen.getByText('No requests found')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Modal functionality', () => {
    it('should open and close reject modal', async () => {
      const user = userEvent.setup();
      
      renderApprovalDashboard();
      
      // Wait for requests to load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Click reject button in table (first one)
      const tableRejectButtons = screen.getAllByRole('button', { name: 'Reject' });
      await user.click(tableRejectButtons[0]);
      
      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
      });
      
      // Close modal by clicking Cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);
      
      // Wait for modal to close
      await waitFor(() => {
        expect(screen.queryByText(/Please provide a reason for rejecting/)).not.toBeInTheDocument();
      });
    });

    it('should handle reject action', async () => {
      const user = userEvent.setup();
      
      approvalAPI.approveOrReject.mockResolvedValue({ success: true });
      
      renderApprovalDashboard();
      
      // Wait for requests to load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Click reject button in table (first one)
      const tableRejectButtons = screen.getAllByRole('button', { name: 'Reject' });
      await user.click(tableRejectButtons[0]);
      
      // Wait for modal and fill reason
      await waitFor(() => {
        expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
      });
      
      const reasonTextarea = screen.getByPlaceholderText('Enter rejection reason...');
      await user.type(reasonTextarea, 'Test rejection reason');
      
      // Submit rejection - use getAllByRole to get modal button specifically
      const modalRejectButtons = screen.getAllByRole('button', { name: 'Reject' });
      const modalRejectButton = modalRejectButtons.find(btn => 
        btn.closest('[role="dialog"]') || btn.closest('.fixed.inset-0')
      );
      await user.click(modalRejectButton);
      
      // Verify API call
      await waitFor(() => {
        expect(approvalAPI.approveOrReject).toHaveBeenCalledWith(1, 'reject', 'Test rejection reason');
      });
    });
  });

  describe('Pagination', () => {
    it('should handle pagination controls', async () => {
      const user = userEvent.setup();
      
      // Mock data for pagination
      const manyRequests = Array.from({ length: 15 }, (_, i) => ({
        ...mockRequests[0],
        req_id: i + 1,
        requester_name: `User ${i + 1}`
      }));
      
      approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
      
      renderApprovalDashboard();
      
      // Wait for requests to load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Change items per page
      const itemsPerPageSelect = screen.getAllByRole('combobox')[1]; // Second combobox is items per page
      await user.selectOptions(itemsPerPageSelect, '1');
      
      // Verify API call with new limit
      await waitFor(() => {
        expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({
          limit: 1,
          offset: 0,
          status: 'PENDING'
        });
      });
    });
  });

  describe('Status filtering', () => {
    it('should filter by status', async () => {
      const user = userEvent.setup();
      
      renderApprovalDashboard();
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Click on EXECUTED status filter
      const executedButton = screen.getByText('executed');
      await user.click(executedButton);
      
      // Verify API call with status filter
      await waitFor(() => {
        expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({
          limit: 10,
          offset: 0,
          status: 'EXECUTED'
        });
      });
    });
  });

  describe('View request details', () => {
    it('should open view modal when clicking View button', async () => {
      const user = userEvent.setup();
      
      renderApprovalDashboard();
      
      // Wait for requests to load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Click view button
      const viewButtons = screen.getAllByText('View');
      await user.click(viewButtons[0]);
      
      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('Request #1 Details')).toBeInTheDocument();
      });
      
      // Verify request details are shown
      expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument();
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
  });

  describe('Approve functionality', () => {
    it('should handle approve action', async () => {
      const user = userEvent.setup();
      
      approvalAPI.approveOrReject.mockResolvedValue({ success: true });
      
      renderApprovalDashboard();
      
      // Wait for requests to load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Click approve button in table (first one)
      const tableApproveButtons = screen.getAllByRole('button', { name: 'Approve' });
      await user.click(tableApproveButtons[0]);
      
      // Wait for confirmation modal
      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
      });
      
      // Confirm approval - use getAllByRole to get modal button specifically
      const modalApproveButtons = screen.getAllByRole('button', { name: 'Approve' });
      const modalApproveButton = modalApproveButtons.find(btn => 
        btn.closest('[role="dialog"]') || btn.closest('.fixed.inset-0')
      );
      await user.click(modalApproveButton);
      
      // Verify API call
      await waitFor(() => {
        expect(approvalAPI.approveOrReject).toHaveBeenCalledWith(1, 'approve');
      });
    });
  });

  describe('Search and clear functionality', () => {
    it('should clear search when clicking Clear button', async () => {
      const user = userEvent.setup();
      
      renderApprovalDashboard();
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
      
      // Type in search
      const searchInput = screen.getByPlaceholderText(/Search by/);
      await user.clear(searchInput);
      await user.type(searchInput, 'test search');
      
      // Click search
      const searchButton = screen.getByRole('button', { name: 'Search' });
      await user.click(searchButton);
      
      // Clear button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
      });
      
      // Click clear
      const clearButton = screen.getByRole('button', { name: 'Clear' });
      await user.click(clearButton);
      
      // Search input should be cleared
      await waitFor(() => {
        expect(searchInput.value).toBe('');
      });
      
      // Clear button should disappear
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      approvalAPI.getPendingRequests.mockRejectedValue(new Error('API Error'));
      
      renderApprovalDashboard();
      
      // Component should still render even with API error
      await waitFor(() => {
        expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
  });
});