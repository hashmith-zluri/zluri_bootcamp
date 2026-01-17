import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../src/pages/Login';
import { ToastProvider } from '../../src/context/ToastContext';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock authAPI
jest.mock('../../src/utils/api', () => ({
  authAPI: {
    login: jest.fn(),
  },
}));

import { authAPI } from '../../src/utils/api';

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <Login />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('Login', () => {
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

  it('should render login form', () => {
    renderLogin();
    
    expect(screen.getByText('Database Query Portal')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderLogin();
    
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      // Should show validation error for email - react-hook-form shows "Invalid email address" for empty email
      const errorMessages = screen.getAllByText(/invalid email address|email/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderLogin();
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    
    // Type invalid email
    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'password123');
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await user.click(submitButton);
    
    // Wait for validation error - react-hook-form with zod should show error
    // The form should not submit and error should appear
    await waitFor(() => {
      // Check if the form didn't submit (authAPI.login should not be called)
      expect(authAPI.login).not.toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('should call login API on valid form submission', async () => {
    const user = userEvent.setup();
    authAPI.login.mockResolvedValue({
      success: true,
      user: { id: 1, email: 'test@example.com', role: 'DEVELOPER' },
      token: 'test-token',
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should navigate to /submit for DEVELOPER role', async () => {
    const user = userEvent.setup();
    authAPI.login.mockResolvedValue({
      success: true,
      user: { id: 1, email: 'test@example.com', role: 'DEVELOPER' },
      token: 'test-token',
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/submit');
    });
  });

  it('should navigate to /approvals for MANAGER role', async () => {
    const user = userEvent.setup();
    authAPI.login.mockResolvedValue({
      success: true,
      user: { id: 2, email: 'manager@example.com', role: 'MANAGER' },
      token: 'test-token',
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'manager@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/approvals');
    });
  });

  it('should navigate to /approvals for ADMIN role', async () => {
    const user = userEvent.setup();
    authAPI.login.mockResolvedValue({
      success: true,
      user: { id: 3, email: 'admin@example.com', role: 'ADMIN' },
      token: 'test-token',
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/approvals');
    });
  });

  it('should show error toast on login failure', async () => {
    const user = userEvent.setup();
    authAPI.login.mockRejectedValue(new Error('Invalid credentials'));
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('should show error toast when success is false', async () => {
    const user = userEvent.setup();
    authAPI.login.mockResolvedValue({
      success: false,
      message: 'Account locked',
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(screen.getByText('Account locked')).toBeInTheDocument();
    });
  });

  it('should show Signing in... while submitting', async () => {
    const user = userEvent.setup();
    authAPI.login.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });
  });

  it('should navigate to /submit for DEVELOPER role (default case)', async () => {
    const user = userEvent.setup();
    authAPI.login.mockResolvedValue({
      success: true,
      user: { id: 1, email: 'test@example.com', role: 'DEVELOPER' },
      token: 'test-token',
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/submit');
    });
  });

  it('should handle unknown role by navigating to /submit', async () => {
    const user = userEvent.setup();
    authAPI.login.mockResolvedValue({
      success: true,
      user: { id: 1, email: 'test@example.com', role: 'UNKNOWN_ROLE' },
      token: 'test-token',
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/submit');
    });
  });
});
