import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MySubmissions from '../../src/pages/MySubmissions';
import { ToastProvider } from '../../src/context/ToastContext';

// Mock requestAPI
jest.mock('../../src/utils/api', () => ({
  requestAPI: {
    getMyRequests: jest.fn(),
    getResult: jest.fn(),
  },
}));

import { requestAPI } from '../../src/utils/api';

const mockRequests = [
  {
    req_id: 1,
    database_type: 'POSTGRES',
    database_name: 'testdb',
    instance_name: 'prod-instance',
    query: 'SELECT * FROM users',
    status: 'PENDING',
    created_at: '2024-01-15T10:00:00Z',
    pod_id: 'pod1',
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
    pod_id: 'pod2',
    comments: 'Test script',
    result: { status: 'success', output: '[]' },
  },
];

const renderMySubmissions = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <MySubmissions />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('MySubmissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requestAPI.getMyRequests.mockResolvedValue({ requests: mockRequests });
  });

  it('should render page title', async () => {
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('My Submissions')).toBeInTheDocument();
    });
  });

  it('should show loading spinner initially', () => {
    requestAPI.getMyRequests.mockImplementation(() => new Promise(() => {}));
    renderMySubmissions();
    
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('should display requests after loading', async () => {
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  it('should display stats buttons', async () => {
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('executed')).toBeInTheDocument();
    });
  });

  it('should filter requests when clicking status button', async () => {
    const user = userEvent.setup();
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Click on PENDING filter
    const pendingButton = screen.getByText('pending').closest('button');
    await user.click(pendingButton);
    
    await waitFor(() => {
      expect(requestAPI.getMyRequests).toHaveBeenCalledWith({ status: 'PENDING' });
    });
  });

  it('should show search input', async () => {
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });
  });

  it('should show View button for each request', async () => {
    renderMySubmissions();
    
    await waitFor(() => {
      const viewButtons = screen.getAllByText('View');
      expect(viewButtons.length).toBeGreaterThan(0);
    });
  });

  it('should open modal when View is clicked', async () => {
    const user = userEvent.setup();
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Request #1 Details/)).toBeInTheDocument();
    });
  });

  it('should show Clone button for rejected requests', async () => {
    requestAPI.getMyRequests.mockResolvedValue({
      requests: [{ ...mockRequests[0], status: 'REJECTED' }],
    });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('Clone')).toBeInTheDocument();
    });
  });

  it('should show Clone button for failed requests', async () => {
    requestAPI.getMyRequests.mockResolvedValue({
      requests: [{ ...mockRequests[0], status: 'FAILED' }],
    });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('Clone')).toBeInTheDocument();
    });
  });

  it('should show no requests message when empty', async () => {
    requestAPI.getMyRequests.mockResolvedValue({ requests: [] });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should show error toast on API failure', async () => {
    requestAPI.getMyRequests.mockRejectedValue(new Error('Network error'));
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should change items per page', async () => {
    const user = userEvent.setup();
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const perPageSelect = screen.getByDisplayValue('10');
    await user.selectOptions(perPageSelect, '50');
    
    expect(perPageSelect).toHaveValue('50');
  });
});
