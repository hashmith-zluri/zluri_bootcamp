import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../../../src/components/layout/sidebar';

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Sidebar', () => {
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
  });

  it('should render DB Portal header', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('DB Portal')).toBeInTheDocument();
  });

  it('should render user info when user is logged in', () => {
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Sidebar />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('DEVELOPER')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument(); // First letter avatar
  });

  it('should show Submit Request and My Submissions for DEVELOPER', () => {
    const mockUser = { id: 1, name: 'Dev User', role: 'DEVELOPER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Sidebar />);
    
    expect(screen.getByText('Submit Request')).toBeInTheDocument();
    expect(screen.getByText('My Submissions')).toBeInTheDocument();
    expect(screen.queryByText('Approval Dashboard')).not.toBeInTheDocument();
  });

  it('should show all navigation items for MANAGER', () => {
    const mockUser = { id: 2, name: 'Manager User', role: 'MANAGER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Sidebar />);
    
    expect(screen.getByText('Submit Request')).toBeInTheDocument();
    expect(screen.getByText('My Submissions')).toBeInTheDocument();
    expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
  });

  it('should show all navigation items for ADMIN', () => {
    const mockUser = { id: 3, name: 'Admin User', role: 'ADMIN' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Sidebar />);
    
    expect(screen.getByText('Submit Request')).toBeInTheDocument();
    expect(screen.getByText('My Submissions')).toBeInTheDocument();
    expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
  });

  it('should not show navigation items when no user', () => {
    localStorageMock.getItem.mockReturnValue(null);

    renderWithRouter(<Sidebar />);
    
    expect(screen.queryByText('Submit Request')).not.toBeInTheDocument();
    expect(screen.queryByText('My Submissions')).not.toBeInTheDocument();
    expect(screen.queryByText('Approval Dashboard')).not.toBeInTheDocument();
  });

  it('should have correct link paths', () => {
    const mockUser = { id: 2, name: 'Manager User', role: 'MANAGER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Sidebar />);
    
    expect(screen.getByText('Submit Request').closest('a')).toHaveAttribute('href', '/submit');
    expect(screen.getByText('My Submissions').closest('a')).toHaveAttribute('href', '/my-submissions');
    expect(screen.getByText('Approval Dashboard').closest('a')).toHaveAttribute('href', '/approvals');
  });
});
