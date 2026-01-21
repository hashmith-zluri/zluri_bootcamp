import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tooltip from '../../../src/components/common/Tooltip';

describe('Tooltip', () => {
  const defaultProps = {
    content: 'This is a tooltip',
    children: <button>Hover me</button>,
  };

  it('should render children', () => {
    render(<Tooltip {...defaultProps} />);
    
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('should show tooltip on hover', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    await user.hover(trigger);
    
    expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
  });

  it('should hide tooltip on unhover', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    await user.hover(trigger);
    expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
    
    await user.unhover(trigger);
    expect(screen.queryByText('This is a tooltip')).not.toBeInTheDocument();
  });

  it('should render with default position (top)', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    await user.hover(trigger);
    
    const tooltip = screen.getByText('This is a tooltip');
    expect(tooltip).toHaveClass('bottom-full', 'mb-2');
  });

  it('should render tooltip arrow', async () => {
    const user = userEvent.setup();
    const { container } = render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    await user.hover(trigger);
    
    const arrow = container.querySelector('.border-t-gray-800');
    expect(arrow).toBeInTheDocument();
  });

  it('should handle multiple hover/unhover cycles', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    
    // First cycle
    await user.hover(trigger);
    expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
    await user.unhover(trigger);
    expect(screen.queryByText('This is a tooltip')).not.toBeInTheDocument();
    
    // Second cycle
    await user.hover(trigger);
    expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
    await user.unhover(trigger);
    expect(screen.queryByText('This is a tooltip')).not.toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(
      <Tooltip content="Tooltip text" className="custom-class">
        <button>Hover me</button>
      </Tooltip>
    );
    
    expect(container.firstChild).toHaveClass('relative', 'inline-block', 'custom-class');
  });

  it('should render without className when not provided', () => {
    const { container } = render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    expect(container.firstChild).toHaveClass('relative', 'inline-block');
  });
});