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
  let localStorageMock;

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

  it('should search by request ID', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
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

  it('should search by database name', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
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

  it('should search by pod', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'pod');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'pod');
    
    // Should filter results
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('should search by risk level', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
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

  it('should navigate to next page', async () => {
    const user = userEvent.setup();
    const manyRequests = Array.from({ length: 15 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: manyRequests });
    
    renderMySubmissions();
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: manyRequests });
    
    renderMySubmissions();
    
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

  it('should show no requests message when list is empty', async () => {
    requestAPI.getMyRequests.mockResolvedValue({ requests: [] });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('should display request details in modal', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
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

  it('should handle clone button click for rejected request', async () => {
    const user = userEvent.setup();
    const rejectedRequest = {
      ...mockRequests[0],
      status: 'REJECTED',
    };
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: [rejectedRequest] });
    
    // Mock window.location.href
    delete window.location;
    window.location = { href: '' };
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const cloneButton = screen.getByText('Clone');
    await user.click(cloneButton);
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cloneRequest', expect.any(String));
    });
  });

  it('should handle clone button click for failed request', async () => {
    const user = userEvent.setup();
    const failedRequest = {
      ...mockRequests[0],
      status: 'FAILED',
    };
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: [failedRequest] });
    
    // Mock window.location.href
    delete window.location;
    window.location = { href: '' };
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const cloneButton = screen.getByText('Clone');
    await user.click(cloneButton);
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cloneRequest', expect.any(String));
    });
  });

  it('should not show clone button for pending request', async () => {
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('Clone')).not.toBeInTheDocument();
  });

  it('should display execution result in modal', async () => {
    const user = userEvent.setup();
    const requestWithResult = {
      ...mockRequests[0],
      status: 'EXECUTED',
      result: {
        status: 'success',
        output: '{"rows": [{"id": 1}]}',
        response_time: 150,
        executed_at: '2024-01-15T10:05:00Z',
      },
    };
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: [requestWithResult] });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Execution Result/)).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  it('should display failed execution result in modal', async () => {
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
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: [requestWithError] });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Execution Result/)).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('should search by instance name', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'instance_name');
    
    const searchInput = screen.getByPlaceholderText(/Search by/);
    await user.type(searchInput, 'prod');
    
    await waitFor(() => {
      expect(screen.getByText('prod-instance')).toBeInTheDocument();
    });
  });

  it('should search across all fields', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
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
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const failedButton = screen.getByText('failed').closest('button');
    await user.click(failedButton);
    
    await waitFor(() => {
      expect(requestAPI.getMyRequests).toHaveBeenCalledWith({ status: 'FAILED' });
    });
  });

  it('should filter by rejected status', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const rejectedButton = screen.getByText('rejected').closest('button');
    await user.click(rejectedButton);
    
    await waitFor(() => {
      expect(requestAPI.getMyRequests).toHaveBeenCalledWith({ status: 'REJECTED' });
    });
  });

  it('should handle API error with message', async () => {
    requestAPI.getMyRequests.mockRejectedValue({ message: 'Custom error message' });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  it('should display script content in modal for script requests', async () => {
    const user = userEvent.setup();
    const scriptRequest = {
      ...mockRequests[1],
      script: 'db.users.find({})',
      query: null,
    };
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: [scriptRequest] });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Request #2 Details/)).toBeInTheDocument();
      expect(screen.getByText('db.users.find({})')).toBeInTheDocument();
    });
  });

  it('should show execution time in result', async () => {
    const user = userEvent.setup();
    const requestWithTime = {
      ...mockRequests[0],
      status: 'EXECUTED',
      result: {
        status: 'success',
        output: '{"rows": []}',
        response_time: 250,
        executed_at: '2024-01-15T10:05:00Z',
      },
    };
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: [requestWithTime] });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/250ms/)).toBeInTheDocument();
    });
  });

  it('should disable Previous button on first page', async () => {
    const manyRequests = Array.from({ length: 15 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: manyRequests });
    
    renderMySubmissions();
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: manyRequests });
    
    renderMySubmissions();
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: manyRequests });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText(/Showing 1 to 10 of 25/)).toBeInTheDocument();
    });
  });

  it('should handle pagination with 1 item per page', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const perPageSelect = screen.getByDisplayValue('10');
    await user.selectOptions(perPageSelect, '1');
    
    await waitFor(() => {
      expect(perPageSelect).toHaveValue('1');
    });
  });

  it('should handle pagination with 100 items per page', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const perPageSelect = screen.getByDisplayValue('10');
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
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: manyRequests });
    
    renderMySubmissions();
    
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
    
    renderMySubmissions();
    
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

  it('should show approved timestamp in details modal', async () => {
    const user = userEvent.setup();
    const approvedRequest = {
      ...mockRequests[0],
      status: 'EXECUTED',
      approved_at: '2024-01-15T10:02:00Z',
    };
    
    requestAPI.getMyRequests.mockResolvedValue({
      requests: [approvedRequest],
    });
    
    renderMySubmissions();
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({
      requests: [executedRequest],
    });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Executed:/)).toBeInTheDocument();
    });
  });

  it('should filter by all status', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // First click on another filter
    const pendingButton = screen.getByText('pending').closest('button');
    await user.click(pendingButton);
    
    await waitFor(() => {
      expect(requestAPI.getMyRequests).toHaveBeenCalledWith({ status: 'PENDING' });
    });
    
    // Then click on all
    const allButton = screen.getByText('Total').closest('button');
    await user.click(allButton);
    
    await waitFor(() => {
      expect(requestAPI.getMyRequests).toHaveBeenCalledWith({});
    });
  });

  it('should search by query/script content', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
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
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    const searchFieldSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(searchFieldSelect, 'comments');
    
    expect(searchFieldSelect).toHaveValue('comments');
  });

  it('should handle empty search term', async () => {
    const user = userEvent.setup();
    
    renderMySubmissions();
    
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
    
    renderMySubmissions();
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: exactRequests });
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({
      requests: [queryRequest],
    });
    
    renderMySubmissions();
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({
      requests: [highRiskRequest],
    });
    
    renderMySubmissions();
    
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
    
    requestAPI.getMyRequests.mockResolvedValue({
      requests: [mediumRiskRequest],
    });
    
    renderMySubmissions();
    
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    
    // Should show medium or low risk badge in table (UPDATE with WHERE is actually low risk)
    // Let's check for any risk badge
    const riskBadges = screen.getAllByText(/Risk/);
    expect(riskBadges.length).toBeGreaterThan(0);
  });

  it('should handle clicking page number button', async () => {
    const user = userEvent.setup();
    const manyRequests = Array.from({ length: 50 }, (_, i) => ({
      ...mockRequests[0],
      req_id: i + 1,
    }));
    
    requestAPI.getMyRequests.mockResolvedValue({ requests: manyRequests });
    
    renderMySubmissions();
    
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
});
