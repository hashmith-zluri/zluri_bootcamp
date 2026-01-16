import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Topbar from '../../../src/components/layout/topbar';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Topbar', () => {
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

  it('should render title', () => {
    renderWithRouter(<Topbar />);
    expect(screen.getByText('Database Query Management Portal')).toBeInTheDocument();
  });

  it('should render user info when user is logged in', () => {
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Topbar />);
    
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('DEVELOPER')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument(); // First letter avatar
  });

  it('should render logout button when user is logged in', () => {
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Topbar />);
    
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should not render user info when no user', () => {
    localStorageMock.getItem.mockReturnValue(null);

    renderWithRouter(<Topbar />);
    
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('should call logout and navigate on logout click', async () => {
    const user = userEvent.setup();
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com', role: 'DEVELOPER' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    renderWithRouter(<Topbar />);
    
    await user.click(screen.getByText('Logout'));
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
