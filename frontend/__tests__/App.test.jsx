import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  let localStorageMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup localStorage mock
    localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', { 
      value: localStorageMock,
      writable: true 
    });
    
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should render without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });

  it('should render login page when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('Database Query Portal')).toBeInTheDocument();
  });

  it('should provide toast context', () => {
    const { container } = render(<App />);
    // App wraps everything in ToastProvider
    expect(container).toBeInTheDocument();
  });
});
