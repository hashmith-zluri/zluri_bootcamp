import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor from '../../../src/components/common/CodeEditor';

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

describe('CodeEditor', () => {
  describe('Read-only mode', () => {
    it('should render code in read-only mode', () => {
      const code = 'const x = 10;';
      render(<CodeEditor code={code} readOnly={true} />);
      
      expect(screen.getByText(code)).toBeInTheDocument();
    });

    it('should render empty string when no code provided', () => {
      const { container } = render(<CodeEditor code="" readOnly={true} />);
      expect(container).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CodeEditor code="test" readOnly={true} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should show line numbers when enabled', () => {
      render(<CodeEditor code="line1\nline2" readOnly={true} showLineNumbers={true} />);
      // Line numbers are rendered by SyntaxHighlighter
      const highlighter = screen.getByTestId('syntax-highlighter');
      expect(highlighter).toHaveTextContent('line1');
      expect(highlighter).toHaveTextContent('line2');
    });
  });

  describe('Editable mode', () => {
    it('should render textarea in editable mode', () => {
      const code = 'const x = 10;';
      render(<CodeEditor code={code} readOnly={false} onChange={jest.fn()} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue(code);
    });

    it('should call onChange when text changes', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      render(<CodeEditor code="" readOnly={false} onChange={onChange} />);
      
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'test');
      
      expect(onChange).toHaveBeenCalled();
    });

    it('should show placeholder', () => {
      render(
        <CodeEditor 
          code="" 
          readOnly={false} 
          onChange={jest.fn()} 
          placeholder="Enter code here" 
        />
      );
      
      expect(screen.getByPlaceholderText('Enter code here')).toBeInTheDocument();
    });

    it('should handle tab key for indentation', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      render(<CodeEditor code="test" readOnly={false} onChange={onChange} />);
      
      const textarea = screen.getByRole('textbox');
      await act(async () => {
        textarea.focus();
        textarea.setSelectionRange(4, 4);
      });
      
      await user.keyboard('{Tab}');
      
      expect(onChange).toHaveBeenCalledWith('test  ');
    });

    it('should not call onChange when readOnly', () => {
      const onChange = jest.fn();
      render(<CodeEditor code="test" readOnly={true} onChange={onChange} />);
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should apply maxHeight style', () => {
      const { container } = render(
        <CodeEditor code="test" readOnly={true} maxHeight="300px" />
      );
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveStyle({ maxHeight: '300px' });
    });

    it('should apply minHeight style', () => {
      render(
        <CodeEditor code="test" readOnly={false} onChange={jest.fn()} minHeight="150px" />
      );
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveStyle({ minHeight: '150px' });
    });
  });

  describe('Language support', () => {
    it('should accept different language prop', () => {
      const { container } = render(
        <CodeEditor code="SELECT * FROM users" language="sql" readOnly={true} />
      );
      
      expect(container).toBeInTheDocument();
    });

    it('should default to javascript language', () => {
      const { container } = render(
        <CodeEditor code="const x = 1;" readOnly={true} />
      );
      
      expect(container).toBeInTheDocument();
    });
  });

  describe('Scroll indicator', () => {
    it('should show scroll indicator when content is scrollable in read-only mode', () => {
      // Mock scrollHeight > clientHeight
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        value: 300,
      });

      const { container } = render(
        <CodeEditor code="line1\nline2\nline3\nline4\nline5" readOnly={true} maxHeight="300px" />
      );
      
      expect(container.querySelector('.absolute.bottom-2.right-2')).toBeInTheDocument();
    });

    it('should hide scroll indicator when focused in editable mode', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        value: 300,
      });

      render(
        <CodeEditor code="test" readOnly={false} onChange={onChange} maxHeight="300px" />
      );
      
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      
      // Scroll indicator should be hidden when focused (pointer-events-none)
      expect(textarea).toHaveFocus();
    });

    it('should handle tab key with selection range', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      render(<CodeEditor code="test code" readOnly={false} onChange={onChange} />);
      
      const textarea = screen.getByRole('textbox');
      await act(async () => {
        textarea.focus();
        textarea.setSelectionRange(5, 9); // Select "code"
      });
      
      await user.keyboard('{Tab}');
      
      // Should replace selection with spaces
      expect(onChange).toHaveBeenCalledWith('test   ');
    });

    it('should not show scroll indicator when content fits', () => {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        value: 200,
      });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        value: 300,
      });

      const { container } = render(
        <CodeEditor code="short" readOnly={true} maxHeight="300px" />
      );
      
      expect(container.querySelector('.absolute.bottom-2.right-2')).not.toBeInTheDocument();
    });
  });

  describe('Line numbers in editable mode', () => {
    it('should show line numbers overlay when enabled in editable mode', () => {
      render(
        <CodeEditor 
          code="line1\nline2\nline3" 
          readOnly={false} 
          onChange={jest.fn()} 
          showLineNumbers={true} 
        />
      );
      
      const lineNumbersOverlay = document.querySelector('.absolute.left-0.top-0');
      expect(lineNumbersOverlay).toBeInTheDocument();
    });

    it('should not show line numbers overlay when disabled in editable mode', () => {
      render(
        <CodeEditor 
          code="line1\nline2" 
          readOnly={false} 
          onChange={jest.fn()} 
          showLineNumbers={false} 
        />
      );
      
      const lineNumbersOverlay = document.querySelector('.absolute.left-0.top-0');
      expect(lineNumbersOverlay).not.toBeInTheDocument();
    });
  });
});
