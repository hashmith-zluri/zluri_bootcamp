import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from '../../../src/components/common/ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    message: 'Are you sure?',
  };

  it('should render title and message', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should render default button texts', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render custom button texts', () => {
    render(
      <ConfirmModal 
        {...defaultProps} 
        confirmText="Yes, Delete"
        cancelText="No, Keep"
      />
    );
    
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('No, Keep')).toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    
    await user.click(screen.getByText('Confirm'));
    
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should render with primary style by default', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700', 'text-white');
  });

  it('should render with danger style', () => {
    render(<ConfirmModal {...defaultProps} confirmStyle="danger" />);
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-red-600', 'hover:bg-red-700', 'text-white');
  });

  it('should render with success style', () => {
    render(<ConfirmModal {...defaultProps} confirmStyle="success" />);
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-green-600', 'hover:bg-green-700', 'text-white');
  });

  it('should show loading state', () => {
    render(<ConfirmModal {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('should disable buttons when loading', () => {
    render(<ConfirmModal {...defaultProps} loading={true} />);
    
    const cancelButton = screen.getByText('Cancel');
    const confirmButton = screen.getByText('Processing...');
    
    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });

  it('should not disable buttons when not loading', () => {
    render(<ConfirmModal {...defaultProps} loading={false} />);
    
    const cancelButton = screen.getByText('Cancel');
    const confirmButton = screen.getByText('Confirm');
    
    expect(cancelButton).not.toBeDisabled();
    expect(confirmButton).not.toBeDisabled();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<ConfirmModal {...defaultProps} isOpen={false} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should render with small modal size', () => {
    const { container } = render(<ConfirmModal {...defaultProps} />);
    
    // ConfirmModal uses size="sm" for Modal component
    const modal = container.querySelector('.max-w-md');
    expect(modal).toBeInTheDocument();
  });
});
