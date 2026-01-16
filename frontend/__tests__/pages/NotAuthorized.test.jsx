import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NotAuthorized from '../../src/pages/NotAuthorized';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderNotAuthorized = () => {
  return render(
    <BrowserRouter>
      <NotAuthorized />
    </BrowserRouter>
  );
};

describe('NotAuthorized', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render access denied message', () => {
    renderNotAuthorized();
    
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
  });

  it('should render Go Back button', () => {
    renderNotAuthorized();
    
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should render Return to Dashboard button', () => {
    renderNotAuthorized();
    
    expect(screen.getByText('Return to Dashboard')).toBeInTheDocument();
  });

  it('should navigate back when Go Back is clicked', async () => {
    const user = userEvent.setup();
    renderNotAuthorized();
    
    await user.click(screen.getByText('Go Back'));
    
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should navigate to home when Return to Dashboard is clicked', async () => {
    const user = userEvent.setup();
    renderNotAuthorized();
    
    await user.click(screen.getByText('Return to Dashboard'));
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should render warning icon', () => {
    const { container } = renderNotAuthorized();
    
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-red-600');
  });
});
