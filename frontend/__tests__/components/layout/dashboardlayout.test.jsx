import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../../src/components/layout/dashboardlayout';
import { ToastProvider } from '../../../src/context/ToastContext';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock toast functions
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
};

jest.mock('../../../src/context/ToastContext', () => ({
  ...jest.requireActual('../../../src/context/ToastContext'),
  useToast: () => mockToast,
}));

const renderWithRouter = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('DashboardLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));
  });

  it('should render sidebar', () => {
    renderWithRouter();
    expect(screen.getByText('DB Portal')).toBeInTheDocument();
  });

  it('should render topbar', () => {
    renderWithRouter();
    expect(screen.getByText('Database Query Management Portal')).toBeInTheDocument();
  });

  it('should render outlet content', () => {
    renderWithRouter();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('should have correct layout structure', () => {
    const { container } = renderWithRouter();
    
    // Main container should have flex and h-screen
    const mainContainer = container.querySelector('.flex.h-screen');
    expect(mainContainer).toBeInTheDocument();
    
    // Should have bg-gray-100
    expect(mainContainer).toHaveClass('bg-gray-100');
  });
});
