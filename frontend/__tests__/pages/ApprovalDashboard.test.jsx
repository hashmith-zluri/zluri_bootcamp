import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ApprovalDashboard from '../../src/pages/ApprovalDashboard';
import { ToastProvider } from '../../src/context/ToastContext';

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
});
