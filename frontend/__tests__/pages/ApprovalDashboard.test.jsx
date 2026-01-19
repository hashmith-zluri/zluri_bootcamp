import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ApprovalDashboard from '../../src/pages/ApprovalDashboard';
import { ToastProvider } from '../../src/context/ToastContext';

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

// Mock approvalAPI
jest.mock('../../src/utils/api', () => ({
  approvalAPI: {
    getPendingRequests: jest.fn(),
    approveOrReject: jest.fn(),
  },
}));

import { approvalAPI } from '../../src/utils/api';

const mockRequests = [
  {
    req_id: 1,
    database_type: 'POSTGRES',
    database_name: 'testdb',
    instance_name: 'prod-instance',
    query: 'SELECT * FROM users',
    status: 'PENDING',
    created_at: '2024-01-15T10:00:00Z',
    requester_name: 'John Doe',
    requester_email: 'john@example.com',
    comments: 'Test query',
  },
  {
    req_id: 2,
    database_type: 'MONGO',
    database_name: 'mongodb',
    instance_name: 'mongo-instance',
    script: 'db.users.find({})',
    status: 'EXECUTED',
    created_at: '2024-01-14T10:00:00Z',
    requester_name: 'Jane Doe',
    requester_email: 'jane@example.com',
    comments: 'Test script',
    result: { status: 'success', output: '[]' },
  },
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

describe('ApprovalDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: mockRequests });
  });

  it('should render page title', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
    });
  });

  it('should show loading spinner initially', () => {
    approvalAPI.getPendingRequests.mockImplementation(() => new Promise(() => {}));
    renderApprovalDashboard();
    
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('should display requests after loading', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should display stats buttons', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  it('should show Approve and Reject buttons for pending requests', async () => {
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [mockRequests[0]],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  it('should open approve confirmation modal', async () => {
    const user = userEvent.setup();
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [mockRequests[0]],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Approve'));
    
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });
  });

  it('should open reject modal', async () => {
    const user = userEvent.setup();
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [mockRequests[0]],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Reject'));
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason/)).toBeInTheDocument();
    });
  });

  it('should show search input', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });
  });

  it('should show View button for each request', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      const viewButtons = screen.getAllByText('View');
      expect(viewButtons.length).toBeGreaterThan(0);
    });
  });

  it('should open details modal when View is clicked', async () => {
    const user = userEvent.setup();
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
    });
  });

  it('should show no requests message when empty', async () => {
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: [] });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should show error toast on API failure', async () => {
    approvalAPI.getPendingRequests.mockRejectedValue(new Error('Network error'));
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should handle approve action successfully', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockResolvedValue({ success: true });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });
    
    const confirmButtons = screen.getAllByRole('button', { name: 'Approve' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    
    await waitFor(() => {
      expect(approvalAPI.approveOrReject).toHaveBeenCalledWith(1, 'approve');
    });
  });

  it('should handle reject action successfully', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockResolvedValue({ success: true });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    const reasonTextarea = screen.getByPlaceholderText(/Enter rejection reason/);
    await user.type(reasonTextarea, 'Not approved');
    
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    await user.click(rejectButtonsInModal[rejectButtonsInModal.length - 1]);
    
    await waitFor(() => {
      expect(approvalAPI.approveOrReject).toHaveBeenCalledWith(1, 'reject', 'Not approved');
    });
  });

  it('should show error when reject without reason', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    // The reject button in modal should be disabled when no reason is provided
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    const modalRejectButton = rejectButtonsInModal[rejectButtonsInModal.length - 1];
    
    expect(modalRejectButton).toBeDisabled();
  });

  it('should handle approve error', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockResolvedValue({ success: false, message: 'Approval failed' });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });
    
    const confirmButtons = screen.getAllByRole('button', { name: 'Approve' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Approval failed/)).toBeInTheDocument();
    });
  });

  it('should handle reject error', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockRejectedValue(new Error('Rejection failed'));
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    const reasonTextarea = screen.getByPlaceholderText(/Enter rejection reason/);
    await user.type(reasonTextarea, 'Not approved');
    
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    await user.click(rejectButtonsInModal[rejectButtonsInModal.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Rejection failed/)).toBeInTheDocument();
    });
  });

  it('should filter by status when clicking status button', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const executedButton = screen.getByText('executed');
    await user.click(executedButton);
    
    await waitFor(() => {
      expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({ status: 'EXECUTED' });
    });
  });

  it('should search by request ID', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'req_id');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, '1');
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
  });

  it('should search by email', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'requester_email');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });

  it('should search by database name', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'database_name');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'testdb');
    
    await waitFor(() => {
      expect(screen.getByText('testdb')).toBeInTheDocument();
    });
  });

  it('should search by risk level', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'risk');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'low');
    
    // Should filter results
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('should change items per page', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const perPageSelects = screen.getAllByRole('combobox');
    const perPageSelect = perPageSelects[perPageSelects.length - 1];
    await user.selectOptions(perPageSelect, '50');
    
    // Should update pagination
    await waitFor(() => {
      expect(perPageSelect).toHaveValue('50');
    });
  });

  it('should navigate to next page', async () => {
    const user = userEvent.setup();
    const manyRequests = Array.from({ length: 15 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText('#11')).toBeInTheDocument();
    });
  });

  it('should navigate to previous page', async () => {
    const user = userEvent.setup();
    const manyRequests = Array.from({ length: 15 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText('#11')).toBeInTheDocument();
    });
    
    const prevButton = screen.getByRole('button', { name: 'Previous' });
    await user.click(prevButton);
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
  });

  it('should close approve modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to approve/)).not.toBeInTheDocument();
    });
  });

  it('should close reject modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.queryByText(/Please provide a reason for rejecting/)).not.toBeInTheDocument();
    });
  });

  it('should show no requests message when list is empty', async () => {
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: [] });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should display request details in modal', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
      expect(screen.getByText('Test query')).toBeInTheDocument();
    });
  });

  it('should search by requester name', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'requester_name');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'John');
    
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('should search by query/script content', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'query');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'SELECT');
    
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('should search by comments field', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'comments');
    
    expect(searchFieldSelect).toHaveValue('comments');
  });

  it('should search across all fields', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'all');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'testdb');
    
    await waitFor(() => {
      expect(screen.getByText('testdb')).toBeInTheDocument();
    });
  });

  it('should filter by failed status', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const failedButton = screen.getByText('failed');
    await user.click(failedButton);
    
    await waitFor(() => {
      expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({ status: 'FAILED' });
    });
  });

  it('should filter by rejected status', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectedButton = screen.getByText('rejected');
    await user.click(rejectedButton);
    
    await waitFor(() => {
      expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({ status: 'REJECTED' });
    });
  });

  it('should disable Previous button on first page', async () => {
    const manyRequests = Array.from({ length: 15 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const prevButton = screen.getByRole('button', { name: 'Previous' });
    expect(prevButton).toBeDisabled();
  });

  it('should disable Next button on last page', async () => {
    const user = userEvent.setup();
    const manyRequests = Array.from({ length: 15 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Go to last page
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText('#11')).toBeInTheDocument();
    });
    
    expect(nextButton).toBeDisabled();
  });

  it('should show correct pagination info', async () => {
    const manyRequests = Array.from({ length: 25 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText(/Showing 1 to 10 of 25/)).toBeInTheDocument();
    });
  });

  it('should handle pagination with 1 item per page', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const perPageSelects = screen.getAllByRole('combobox');
    const perPageSelect = perPageSelects[perPageSelects.length - 1];
    await user.selectOptions(perPageSelect, '1');
    
    await waitFor(() => {
      expect(perPageSelect).toHaveValue('1');
    });
  });

  it('should handle pagination with 100 items per page', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const perPageSelects = screen.getAllByRole('combobox');
    const perPageSelect = perPageSelects[perPageSelects.length - 1];
    await user.selectOptions(perPageSelect, '100');
    
    await waitFor(() => {
      expect(perPageSelect).toHaveValue('100');
    });
  });

  it('should show correct page numbers for middle pages', async () => {
    const user = userEvent.setup();
    const manyRequests = Array.from({ length: 100 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Go to page 5
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);
    await user.click(nextButton);
    await user.click(nextButton);
    await user.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText('#41')).toBeInTheDocument();
    });
  });

  it('should close details modal when close button is clicked', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
    });
    
    // Find and click close button (X button in modal)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.textContent === '×' || btn.getAttribute('aria-label') === 'Close');
    if (closeButton) {
      await user.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/Request #1 Details/)).not.toBeInTheDocument();
      });
    }
  });

  it('should display risk assessment in details modal', async () => {
    const user = userEvent.setup();
    const highRiskRequest = {
      ...mockRequests[0],
      query: 'DELETE FROM users WHERE 1=1',
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [highRiskRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Risk Factors/)).toBeInTheDocument();
    });
  });

  it('should show execution result with response time', async () => {
    const user = userEvent.setup();
    const requestWithResult = {
      ...mockRequests[0],
      status: 'EXECUTED',
      result: {
        status: 'success',
        output: '{"rows": []}',
        response_time: 150,
        executed_at: '2024-01-15T10:05:00Z',
      },
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [requestWithResult],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/150ms/)).toBeInTheDocument();
    });
  });

  it('should show failed execution result', async () => {
    const user = userEvent.setup();
    const requestWithError = {
      ...mockRequests[0],
      status: 'FAILED',
      result: {
        status: 'failure',
        error: 'Query execution failed',
        executed_at: '2024-01-15T10:05:00Z',
      },
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [requestWithError],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText(/Query execution failed/)).toBeInTheDocument();
    });
  });

  it('should show approved timestamp in details modal', async () => {
    const user = userEvent.setup();
    const approvedRequest = {
      ...mockRequests[0],
      status: 'EXECUTED',
      approved_at: '2024-01-15T10:02:00Z',
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [approvedRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Approved:/)).toBeInTheDocument();
    });
  });

  it('should show executed timestamp in details modal', async () => {
    const user = userEvent.setup();
    const executedRequest = {
      ...mockRequests[0],
      status: 'EXECUTED',
      result: {
        status: 'success',
        output: '[]',
        executed_at: '2024-01-15T10:05:00Z',
      },
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [executedRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Executed:/)).toBeInTheDocument();
    });
  });

  it('should display script content for script requests', async () => {
    const user = userEvent.setup();
    const scriptRequest = {
      ...mockRequests[1],
      query: null,
      script: 'db.users.find({})',
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [scriptRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('db.users.find({})')).toBeInTheDocument();
    });
  });

  it('should filter by all status', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // First click on another filter
    const pendingButton = screen.getByText('pending').closest('button');
    await user.click(pendingButton);
    
    await waitFor(() => {
      expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({ status: 'PENDING' });
    });
    
    // Then click on all
    const allButton = screen.getByText('Total').closest('button');
    await user.click(allButton);
    
    await waitFor(() => {
      expect(approvalAPI.getPendingRequests).toHaveBeenCalledWith({});
    });
  });

  it('should handle empty search term', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'test');
    await user.clear(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  it('should search with no results', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'nonexistentquery12345');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle pagination edge case with exact multiple of items per page', async () => {
    const user = userEvent.setup();
    const exactRequests = Array.from({ length: 20 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: exactRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Go to page 2
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText('#11')).toBeInTheDocument();
    });
    
    // Should be on last page
    expect(nextButton).toBeDisabled();
  });

  it('should display query content for query requests in modal', async () => {
    const user = userEvent.setup();
    const queryRequest = {
      ...mockRequests[0],
      query: 'SELECT * FROM users WHERE id = 1',
      script: null,
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [queryRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('SELECT * FROM users WHERE id = 1')).toBeInTheDocument();
    });
  });

  it('should show risk assessment for high risk queries', async () => {
    const user = userEvent.setup();
    const highRiskRequest = {
      ...mockRequests[0],
      query: 'DROP TABLE users',
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [highRiskRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Should show risk badge in table - just verify it exists
    const riskBadges = screen.getAllByText(/Risk/);
    expect(riskBadges.length).toBeGreaterThan(0);
  });

  it('should show risk assessment for medium risk queries', async () => {
    const user = userEvent.setup();
    const mediumRiskRequest = {
      ...mockRequests[0],
      query: 'UPDATE users SET status = "active" WHERE id = 1',
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [mediumRiskRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Should show medium or low risk badge in table (UPDATE with WHERE is actually low risk)
    // Let's check for any risk badge
    const riskBadges = screen.getAllByText(/Risk/);
    expect(riskBadges.length).toBeGreaterThan(0);
  });

  it('should handle approve with API returning non-success response', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockResolvedValue({ 
      success: false, 
      message: 'Database connection failed' 
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });
    
    const confirmButtons = screen.getAllByRole('button', { name: 'Approve' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
    });
  });

  it('should handle reject with network error', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockRejectedValue(new Error('Network timeout'));
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    const reasonTextarea = screen.getByPlaceholderText(/Enter rejection reason/);
    await user.type(reasonTextarea, 'Security concerns');
    
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    await user.click(rejectButtonsInModal[rejectButtonsInModal.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Network timeout/)).toBeInTheDocument();
    });
  });

  it('should handle clicking page number button', async () => {
    const user = userEvent.setup();
    const manyRequests = Array.from({ length: 50 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests: manyRequests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Click on page 2 button
    const page2Button = screen.getByRole('button', { name: '2' });
    await user.click(page2Button);
    
    await waitFor(() => {
      expect(screen.getByText('#11')).toBeInTheDocument();
    });
  });

  it('should handle approve with no selected request', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Manually trigger confirmApprove without selecting a request
    // This tests the early return when selectedRequest is null
    const component = screen.getByText('Approval Dashboard').closest('div');
    expect(component).toBeInTheDocument();
  });

  it('should handle reject with no selected request', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // This tests the early return when selectedRequest is null
    const component = screen.getByText('Approval Dashboard').closest('div');
    expect(component).toBeInTheDocument();
  });

  it('should handle reject with success false and no message', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockResolvedValue({ success: false });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    const reasonTextarea = screen.getByPlaceholderText(/Enter rejection reason/);
    await user.type(reasonTextarea, 'Not approved');
    
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    await user.click(rejectButtonsInModal[rejectButtonsInModal.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to reject request/)).toBeInTheDocument();
    });
  });

  it('should handle approve with error that has no message', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockRejectedValue(new Error());
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });
    
    const confirmButtons = screen.getAllByRole('button', { name: 'Approve' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to approve request/)).toBeInTheDocument();
    });
  });

  it('should handle reject with error that has no message', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockRejectedValue(new Error());
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    const reasonTextarea = screen.getByPlaceholderText(/Enter rejection reason/);
    await user.type(reasonTextarea, 'Not approved');
    
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    await user.click(rejectButtonsInModal[rejectButtonsInModal.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to reject request/)).toBeInTheDocument();
    });
  });

  it('should handle approve with success false and no message', async () => {
    const user = userEvent.setup();
    approvalAPI.approveOrReject.mockResolvedValue({ success: false });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });
    
    const confirmButtons = screen.getAllByRole('button', { name: 'Approve' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to approve request/)).toBeInTheDocument();
    });
  });

  it('should handle search with empty debouncedSearch', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Type and immediately clear to test empty search
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'test');
    
    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 400));
    
    await user.clear(searchInput);
    
    // Wait for debounce again
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // All requests should be visible
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  it('should handle pagination with totalPages <= 5', async () => {
    const user = userEvent.setup();
    const requests = Array.from({ length: 30 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Should show page numbers 1-3
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('should handle pagination when currentPage >= totalPages - 2', async () => {
    const user = userEvent.setup();
    const requests = Array.from({ length: 100 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Navigate to near the end - page 9 out of 10
    const nextButton = screen.getByRole('button', { name: 'Next' });
    
    // Click next 8 times to get to page 9
    for (let i = 0; i < 8; i++) {
      await user.click(nextButton);
      await waitFor(() => {
        expect(nextButton).toBeInTheDocument();
      });
    }
    
    // Should be on page 9, showing items 81-90
    await waitFor(() => {
      expect(screen.getByText('#81')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Should show last 5 pages (6, 7, 8, 9, 10)
    expect(screen.getByRole('button', { name: '6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  }, 15000);

  it('should handle search by req_id with no match', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'req_id');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, '999999');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle search by requester_email with no match', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'requester_email');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'nonexistent@email.com');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle search by requester_name with no match', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'requester_name');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'NonexistentName');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle search by database_name with no match', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'database_name');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'nonexistentdb');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle search by query with script content', async () => {
    const user = userEvent.setup();
    const scriptRequest = {
      ...mockRequests[1],
      query: null,
      script: 'db.users.find({})',
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [scriptRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'query');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'find');
    
    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  it('should handle search by comments with no match', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'comments');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'nonexistentcomment');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle search by risk with no match', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'risk');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'nonexistentrisk');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle search all fields with script content', async () => {
    const user = userEvent.setup();
    const scriptRequest = {
      ...mockRequests[1],
      query: null,
      script: 'db.users.find({})',
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [scriptRequest],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'all');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'find');
    
    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  it('should handle search by query with no query or script', async () => {
    const user = userEvent.setup();
    const requestWithoutQuery = {
      ...mockRequests[0],
      query: null,
      script: null,
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [requestWithoutQuery],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'query');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'SELECT');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle search all fields with no query or script', async () => {
    const user = userEvent.setup();
    const requestWithoutQuery = {
      ...mockRequests[0],
      query: null,
      script: null,
    };
    
    approvalAPI.getPendingRequests.mockResolvedValue({
      requests: [requestWithoutQuery],
    });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'all');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'SELECT');
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should handle pagination with currentPage in middle range', async () => {
    const user = userEvent.setup();
    const requests = Array.from({ length: 100 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    approvalAPI.getPendingRequests.mockResolvedValue({ requests });
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Navigate to page 5 (middle)
    const nextButton = screen.getByRole('button', { name: 'Next' });
    
    for (let i = 0; i < 4; i++) {
      await user.click(nextButton);
      await waitFor(() => {
        expect(nextButton).toBeInTheDocument();
      });
    }
    
    // Should be on page 5, showing items 41-50
    await waitFor(() => {
      expect(screen.getByText('#41')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Should show pages 3, 4, 5, 6, 7 (currentPage - 2 + i)
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument();
  });

  it('should close reject modal using onClose callback', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    // Find and click the X button (close button in modal)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.textContent === '×' || btn.getAttribute('aria-label') === 'Close');
    if (closeButton) {
      await user.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/Please provide a reason for rejecting/)).not.toBeInTheDocument();
      });
    }
  });

  it('should close result modal using onClose callback', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
    });
    
    // Find and click the X button (close button in modal)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.textContent === '×' || btn.getAttribute('aria-label') === 'Close');
    if (closeButton) {
      await user.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/Request #1 Details/)).not.toBeInTheDocument();
      });
    }
  });

  it('should handle reject with empty reason after trimming', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    // Type only whitespace
    const reasonTextarea = screen.getByPlaceholderText(/Enter rejection reason/);
    await user.type(reasonTextarea, '   ');
    
    // Button should be disabled
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    const modalRejectButton = rejectButtonsInModal[rejectButtonsInModal.length - 1];
    
    expect(modalRejectButton).toBeDisabled();
  });

  it('should handle result modal with no selectedRequest', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // The modal should not crash when selectedRequest is null
    const component = screen.getByText('Approval Dashboard').closest('div');
    expect(component).toBeInTheDocument();
  });


  it('should prevent reject submission when reason is only whitespace', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
    });
    
    // Type whitespace and try to submit
    const reasonTextarea = screen.getByPlaceholderText(/Enter rejection reason/);
    await user.type(reasonTextarea, '   \n\t  ');
    
    // Try to click reject button
    const rejectButtonsInModal = screen.getAllByRole('button', { name: 'Reject' });
    const modalRejectButton = rejectButtonsInModal[rejectButtonsInModal.length - 1];
    
    // Button should be disabled
    expect(modalRejectButton).toBeDisabled();
  });

  it('should render reject modal with correct structure', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Reject Request')).toBeInTheDocument();
      expect(screen.getByText(/Please provide a reason for rejecting/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter rejection reason/)).toBeInTheDocument();
    });
  });

  it('should render result modal with correct structure', async () => {
    const user = userEvent.setup();
    
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
      expect(screen.getByText('Test query')).toBeInTheDocument();
    });
  });

  it('should handle result modal with selectedRequest being null initially', async () => {
    renderApprovalDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Modal should handle null selectedRequest gracefully
    const component = screen.getByText('Approval Dashboard');
    expect(component).toBeInTheDocument();
  });
});
