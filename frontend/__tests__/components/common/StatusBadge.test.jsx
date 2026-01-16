import { render, screen } from '@testing-library/react';
import StatusBadge from '../../../src/components/common/StatusBadge';

describe('StatusBadge', () => {
  it('should render PENDING status', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByText('PENDING');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    expect(badge).toHaveAttribute('title', 'Request is waiting for manager approval');
  });

  it('should render APPROVED status', () => {
    render(<StatusBadge status="APPROVED" />);
    const badge = screen.getByText('APPROVED');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(badge).toHaveAttribute('title', 'Request has been approved and is ready for execution');
  });

  it('should render EXECUTING status', () => {
    render(<StatusBadge status="EXECUTING" />);
    const badge = screen.getByText('EXECUTING');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
    expect(badge).toHaveAttribute('title', 'Request is currently being executed');
  });

  it('should render EXECUTED status', () => {
    render(<StatusBadge status="EXECUTED" />);
    const badge = screen.getByText('EXECUTED');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    expect(badge).toHaveAttribute('title', 'Request has been successfully executed');
  });

  it('should render FAILED status', () => {
    render(<StatusBadge status="FAILED" />);
    const badge = screen.getByText('FAILED');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    expect(badge).toHaveAttribute('title', 'Request execution failed due to an error');
  });

  it('should render REJECTED status', () => {
    render(<StatusBadge status="REJECTED" />);
    const badge = screen.getByText('REJECTED');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    expect(badge).toHaveAttribute('title', 'Request was rejected by the manager');
  });


  it('should render unknown status with default styling', () => {
    render(<StatusBadge status="UNKNOWN" />);
    const badge = screen.getByText('UNKNOWN');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
    expect(badge).toHaveAttribute('title', 'Unknown status');
  });

  it('should have correct base classes', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByText('PENDING');
    expect(badge).toHaveClass('inline-flex', 'items-center', 'px-2.5', 'py-0.5', 'rounded-full', 'text-xs', 'font-medium');
  });
});
