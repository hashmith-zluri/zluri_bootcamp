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

  it('should show tooltip on focus', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    await user.click(trigger);
    
    expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
  });

  it('should hide tooltip on blur', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    await user.click(trigger);
    expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
    
    await user.tab();
    expect(screen.queryByText('This is a tooltip')).not.toBeInTheDocument();
  });

  it('should render with top position by default', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} />);
    
    const trigger = screen.getByText('Hover me');
    await user.hover(trigger);
    
    const tooltip = screen.getByText('This is a tooltip');
    expect(tooltip).toHaveClass('bottom-full', 'mb-2');
  });

  it('should render with bottom position', async () => {
    const user = userEvent.setup();
    render(<Tooltip {...defaultProps} position="bottom" />);
    
    const trigger = screen.getByText('Hover me');
    await user.hover(trigger);
    
    const tooltip = screen.getByText('This is a tooltip');
    expect(tooltip).toHaveClass('top-full', 'mt-2');
  });

  it('should render with left position', async () => {
    c
    const button = screen.getByText('Hover me');
    await user.hover(button);
    
    const tooltip = screen.getByText('Tooltip text');
    expect(tooltip).toHaveClass(
      'absolute',
      'bottom-full',
      'left-1/2',
      'transform',
      '-translate-x-1/2',
      'mb-2',
      'px-2',
      'py-1',
      'text-xs',
      'text-white',
      'bg-gray-800',
      'rounded',
      'whitespace-nowrap',
      'z-10'
    );
  });

  it('should render tooltip arrow', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    const button = screen.getByText('Hover me');
    await user.hover(button);
    
    const arrow = container.querySelector('.border-t-gray-800');
    expect(arrow).toBeInTheDocument();
  });

  it('should handle multiple hover/unhover cycles', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    const button = screen.getByText('Hover me');
    
    // First cycle
    await user.hover(button);
    expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    await user.unhover(button);
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    
    // Second cycle
    await user.hover(button);
    expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    await user.unhover(button);
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
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
