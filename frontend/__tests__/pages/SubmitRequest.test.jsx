import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SubmitRequest from '../../src/pages/SubmitRequest';
import { ToastProvider } from '../../src/context/ToastContext';

// Mock dbAPI
jest.mock('../../src/utils/api', () => ({
  dbAPI: {
    getInstances: jest.fn(),
    getDatabases: jest.fn(),
  },
}));

import { dbAPI } from '../../src/utils/api';

// Mock fetch
global.fetch = jest.fn();

const renderSubmitRequest = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <SubmitRequest />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('SubmitRequest', () => {
  let localStorageMock;
  let sessionStorageMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup localStorage mock
    localStorageMock = {
      getItem: jest.fn().mockReturnValue('test-token'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', { 
      value: localStorageMock,
      writable: true 
    });
    
    // Setup sessionStorage mock
    sessionStorageMock = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'sessionStorage', { 
      value: sessionStorageMock,
      writable: true 
    });
    
    dbAPI.getInstances.mockResolvedValue({ success: true, instances: [] });
    dbAPI.getDatabases.mockResolvedValue({ success: true, databases: [] });
  });

  it('should render page title', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
  });

  it('should render database type dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Database Type')).toBeInTheDocument();
    expect(screen.getByText('Select type')).toBeInTheDocument();
  });

  it('should render instance dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Instance')).toBeInTheDocument();
  });

  it('should render database dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('should render pod dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Pod')).toBeInTheDocument();
  });

  it('should render request type radio buttons', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Request Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Query')).toBeInTheDocument();
    expect(screen.getByLabelText('Script')).toBeInTheDocument();
  });

  it('should show query input by default', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Query')).toBeInTheDocument();
  });

  it('should show script upload when script type is selected', async () => {
    const user = userEvent.setup();
    renderSubmitRequest();
    
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
  });

  it('should render comments textarea', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Explain why/)).toBeInTheDocument();
  });

  it('should render submit button', () => {
    renderSubmitRequest();
    
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument();
  });

  it('should render cancel button', () => {
    renderSubmitRequest();
    
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should fetch instances when database type is selected', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    const dbTypeSelect = screen.getByRole('combobox', { name: /database type/i });
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(dbAPI.getInstances).toHaveBeenCalledWith('POSTGRES');
    });
  });

  it('should reset form when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderSubmitRequest();
    
    // Type in comments
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test comment');
    
    expect(commentsInput).toHaveValue('Test comment');
    
    // Click cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    expect(commentsInput).toHaveValue('');
  });

  it('should show documentation sidebar when script type is selected', async () => {
    const user = userEvent.setup();
    renderSubmitRequest();
    
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });
  });

  it('should show error toast when instances fail to load', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockRejectedValue(new Error('Failed to load'));
    
    renderSubmitRequest();
    
    const dbTypeSelect = screen.getByRole('combobox', { name: /database type/i });
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });
});
