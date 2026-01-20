import { render, screen } from '@testing-library/react';
import StatusBadge from '../../../src/components/common/StatusBadge';

describe('StatusBadge - Additional Coverage', () => {
  it('should render EXECUTING status correctly', () => {
    render(<StatusBadge status="EXECUTING" />);
    
    const badge = screen.getByText('EXECUTING');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(badge).toHaveAttribute('title', 'Request is currently being executed');
  });

  it('should render APPROVED status correctly', () => {
    render(<StatusBadge status="APPROVED" />);
    
    const badge = screen.getByText('APPROVED');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
    expect(badge).toHaveAttribute('title', 'Request has been approved and is ready for execution');
  });

  it('should handle unknown status', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    
    const badge = screen.getByText('UNKNOWN_STATUS');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
    expect(badge).toHaveAttribute('title', 'Unknown status');
  });

  it('should handle null status', () => {
    render(<StatusBadge status={null} />);
    
    const badge = screen.getByText('NULL');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('should handle undefined status', () => {
    render(<StatusBadge status={undefined} />);
    
    const badge = screen.getByText('UNDEFINED');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('should handle empty string status', () => {
    render(<StatusBadge status="" />);
    
    const badge = screen.getByText('EMPTY');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });
});