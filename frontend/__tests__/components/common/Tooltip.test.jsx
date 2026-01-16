import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tooltip from '../../../src/components/common/Tooltip';

describe('Tooltip', () => {
  it('should render children', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('should not show tooltip initially', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
  });

  it('should show tooltip on mouse enter', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    const button = screen.getByText('Hover me');
    await user.hover(button);
    
    expect(screen.getByText('Tooltip text')).toBeInTheDocument();
  });

  it('should hide tooltip on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    const button = screen.getByText('Hover me');
    await user.hover(button);
    expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    
    await user.unhover(button);
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
  });

  it('should apply custom className to container', () => {
    const { container } = render(
      <Tooltip content="Tooltip text" className="custom-class">
        <button>Hover me</button>
      </Tooltip>
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });


  it('should have correct base classes on container', () => {
    const { container } = render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    expect(container.firstChild).toHaveClass('relative', 'inline-block');
  });

  it('should render tooltip with correct styling', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
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
