import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../../src/context/ToastContext';

// Test component that uses the toast context
function TestComponent() {
  const toast = useToast();
  
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Success</button>
      <button onClick={() => toast.error('Error message')}>Error</button>
      <button onClick={() => toast.info('Info message')}>Info</button>
      <button onClick={() => toast.warning('Warning message')}>Warning</button>
      <button onClick={() => toast.addToast('Custom message', 'custom')}>Custom</button>
    </div>
  );
}

describe('ToastContext', () => {
  it('should throw error when useToast is used outside ToastProvider', () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');
    
    spy.mockRestore();
  });

  it('should render children', () => {
    render(
      <ToastProvider>
        <div>Test Content</div>
      </ToastProvider>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should show success toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Success'));
    
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });


  it('should show error toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Error'));
    
    expect(screen.getByText('Error message')).toBeInTheDocument();
    // Error toast uses ✕ icon
    const closeButtons = screen.getAllByText('✕');
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  it('should show info toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Info'));
    
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('ℹ')).toBeInTheDocument();
  });

  it('should show warning toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Warning'));
    
    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('should show custom toast with default info style', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Custom'));
    
    expect(screen.getByText('Custom message')).toBeInTheDocument();
    expect(screen.getByText('ℹ')).toBeInTheDocument();
  });

  it('should auto-remove toast after 5 seconds', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
    
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    await waitFor(() => {
      expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });


  it('should remove toast when close button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
    
    const closeButtons = screen.getAllByRole('button', { name: /✕/i });
    const toastCloseButton = closeButtons[closeButtons.length - 1];
    await user.click(toastCloseButton);
    
    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
  });

  it('should show multiple toasts', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Success'));
    await user.click(screen.getByText('Error'));
    await user.click(screen.getByText('Info'));
    
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('should apply correct styles for success toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Success'));
    
    const toast = screen.getByText('Success message').closest('div');
    expect(toast).toHaveClass('bg-green-500', 'text-white');
  });

  it('should apply correct styles for error toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Error'));
    
    const toast = screen.getByText('Error message').closest('div');
    expect(toast).toHaveClass('bg-red-500', 'text-white');
  });

  it('should apply correct styles for warning toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Warning'));
    
    const toast = screen.getByText('Warning message').closest('div');
    expect(toast).toHaveClass('bg-yellow-500', 'text-white');
  });

  it('should apply correct styles for info toast', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Info'));
    
    const toast = screen.getByText('Info message').closest('div');
    expect(toast).toHaveClass('bg-blue-500', 'text-white');
  });

  it('should not render toast container when no toasts', () => {
    const { container } = render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );
    
    const toastContainer = container.querySelector('.fixed.top-4.right-4');
    expect(toastContainer).not.toBeInTheDocument();
  });

  it('should render toast container when toasts exist', async () => {
    const user = userEvent.setup();
    
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    await user.click(screen.getByText('Success'));
    
    const toastContainer = container.querySelector('.fixed.top-4.right-4');
    expect(toastContainer).toBeInTheDocument();
  });
});
