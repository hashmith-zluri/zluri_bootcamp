import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../../src/components/common/Modal';

describe('Modal', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={jest.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    );
    
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    );
    
    const backdrop = container.querySelector('.bg-black\\/50');
    await user.click(backdrop);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    );
    
    const closeButton = screen.getByRole('button');
    await user.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it('should render with small size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal" size="sm">
        <div>Content</div>
      </Modal>
    );
    
    const modal = container.querySelector('.max-w-md');
    expect(modal).toBeInTheDocument();
  });

  it('should render with medium size by default', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    );
    
    const modal = container.querySelector('.max-w-lg');
    expect(modal).toBeInTheDocument();
  });

  it('should render with large size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal" size="lg">
        <div>Content</div>
      </Modal>
    );
    
    const modal = container.querySelector('.max-w-2xl');
    expect(modal).toBeInTheDocument();
  });

  it('should render with extra large size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal" size="xl">
        <div>Content</div>
      </Modal>
    );
    
    const modal = container.querySelector('.max-w-4xl');
    expect(modal).toBeInTheDocument();
  });

  it('should render title in header', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="My Custom Title">
        <div>Content</div>
      </Modal>
    );
    
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  it('should render children in content area', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal">
        <div>Custom Content</div>
        <button>Action Button</button>
      </Modal>
    );
    
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  it('should have correct structure classes', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    );
    
    expect(container.querySelector('.fixed.inset-0.z-50')).toBeInTheDocument();
    expect(container.querySelector('.bg-white.rounded-lg.shadow-xl')).toBeInTheDocument();
  });
});
