import { render, screen } from '@testing-library/react';
import AppRoutes from '../../src/routes/AppRoutes';
import { ToastProvider } from '../../src/context/ToastContext';

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

// Mock the API modules to prevent actual API calls
jest.mock('../../src/utils/api', () => ({
  requestAPI: {
    getMyRequests: jest.fn().mockResolvedValue({ requests: [] }),
  },
  approvalAPI: {
    getPendingRequests: jest.fn().mockResolvedValue({ requests: [] }),
  },
  dbAPI: {
    getInstances: jest.fn().mockResolvedValue({ success: true, instances: [] }),
    getDatabases: jest.fn().mockResolvedValue({ success: true, databases: [] }),
  },
}));

const renderAppRoutes = () => {
  return render(
    <ToastProvider>
      <AppRoutes />
    </ToastProvider>
  );
};

describe('AppRoutes', () => {
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
    
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset URL
    window.history.pushState({}, '', '/');
  });

  it('should render login page for unauthenticated users', () => {
    renderAppRoutes();
    expect(screen.getByText('Database Query Portal')).toBeInTheDocument();
  });

  it('should redirect to login when accessing protected route without auth', () => {
    window.history.pushState({}, '', '/submit');
    renderAppRoutes();
    expect(screen.getByText('Database Query Portal')).toBeInTheDocument();
  });

  it('should redirect DEVELOPER to /submit on root path', () => {
    const mockUser = { id: 1, email: 'dev@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    window.history.pushState({}, '', '/');
    renderAppRoutes();
    
    // Should redirect to submit page
    expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
  });

  it('should redirect MANAGER to /approvals on root path', () => {
    const mockUser = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    window.history.pushState({}, '', '/');
    renderAppRoutes();
    
    // Should redirect to approvals page
    expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
  });

  it('should show not authorized page for DEVELOPER accessing /approvals', () => {
    const mockUser = { id: 1, email: 'dev@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    window.history.pushState({}, '', '/approvals');
    renderAppRoutes();
    
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('should allow MANAGER to access /approvals', () => {
    const mockUser = { id: 2, email: 'manager@example.com', role: 'MANAGER' };
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    window.history.pushState({}, '', '/approvals');
    renderAppRoutes();
    
    expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
  });

  it('should allow ADMIN to access all routes', () => {
    const mockUser = { id: 3, email: 'admin@example.com', role: 'ADMIN' };
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    window.history.pushState({}, '', '/approvals');
    renderAppRoutes();
    
    expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
  });

  it('should redirect unknown routes to root', () => {
    const mockUser = { id: 1, email: 'dev@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    window.history.pushState({}, '', '/unknown-route');
    renderAppRoutes();
    
    // Should redirect to submit (default for DEVELOPER)
    expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
  });
});
