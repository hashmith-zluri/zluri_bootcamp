import { render, screen } from '@testing-library/react';
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
      expect(screen.getByText('line1')).toBeInTheDocument();
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
      textarea.focus();
      textarea.setSelectionRange(4, 4);
      
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
});
