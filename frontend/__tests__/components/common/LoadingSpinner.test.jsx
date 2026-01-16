import { render } from '@testing-library/react';
import LoadingSpinner from '../../../src/components/common/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default medium size', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('w-8', 'h-8');
  });

  it('should render with small size', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('w-4', 'h-4');
  });

  it('should render with medium size', () => {
    const { container } = render(<LoadingSpinner size="md" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('w-8', 'h-8');
  });

  it('should render with large size', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('w-12', 'h-12');
  });

  it('should apply custom className to container', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    const spinnerContainer = container.firstChild;
    expect(spinnerContainer).toHaveClass('custom-class');
  });

  it('should have correct base classes', () => {
    const { container } = render(<LoadingSpinner />);
    const spinnerContainer = container.firstChild;
    const spinner = container.querySelector('.animate-spin');
    
    expect(spinnerContainer).toHaveClass('flex', 'justify-center', 'items-center');
    expect(spinner).toHaveClass('border-4', 'border-blue-200', 'border-t-blue-600', 'rounded-full', 'animate-spin');
  });

  it('should render without className when not provided', () => {
    const { container } = render(<LoadingSpinner />);
    const spinnerContainer = container.firstChild;
    expect(spinnerContainer).toHaveClass('flex', 'justify-center', 'items-center');
  });
});
