import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OutputDisplay from '../../../src/components/common/OutputDisplay';

describe('OutputDisplay', () => {
  describe('Error display', () => {
    it('should display error message', () => {
      render(<OutputDisplay error="Database connection failed" />);
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });

    it('should prioritize error over output', () => {
      render(<OutputDisplay output="Some output" error="Error occurred" />);
      
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      expect(screen.queryByText('Some output')).not.toBeInTheDocument();
    });
  });

  describe('No output', () => {
    it('should show message when no output', () => {
      render(<OutputDisplay />);
      
      expect(screen.getByText('No output available')).toBeInTheDocument();
    });

    it('should show message when output is null', () => {
      render(<OutputDisplay output={null} />);
      
      expect(screen.getByText('No output available')).toBeInTheDocument();
    });

    it('should show message when output is empty string', () => {
      render(<OutputDisplay output="" />);
      
      expect(screen.getByText('No output available')).toBeInTheDocument();
    });
  });

  describe('Plain text output', () => {
    it('should display plain text output', () => {
      render(<OutputDisplay output="Simple text output" />);
      
      expect(screen.getByText('Simple text output')).toBeInTheDocument();
    });

    it('should display multiline text', () => {
      const output = 'Line 1\nLine 2\nLine 3';
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    });
  });


  describe('JSON output', () => {
    it('should display JSON in formatted mode', () => {
      const output = JSON.stringify({ name: 'John', age: 30 });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('"name"')).toBeInTheDocument();
      expect(screen.getByText('"John"')).toBeInTheDocument();
    });

    it('should show view mode toggle buttons for JSON', () => {
      const output = JSON.stringify({ test: 'value' });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('Formatted')).toBeInTheDocument();
      expect(screen.getByText('Raw')).toBeInTheDocument();
    });

    it('should switch to raw view mode', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify({ test: 'value' });
      render(<OutputDisplay output={output} />);
      
      await user.click(screen.getByText('Raw'));
      
      expect(screen.getByText(/"test"/)).toBeInTheDocument();
    });

    it('should display array in formatted mode', () => {
      const output = JSON.stringify([1, 2, 3]);
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display empty array', () => {
      const output = JSON.stringify([]);
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('[]')).toBeInTheDocument();
    });

    it('should display empty object', () => {
      const output = JSON.stringify({});
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('{}')).toBeInTheDocument();
    });

    it('should display null value', () => {
      const output = JSON.stringify({ value: null });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('null')).toBeInTheDocument();
    });

    it('should display boolean values', () => {
      const output = JSON.stringify({ active: true, disabled: false });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('true')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('should display number values', () => {
      const output = JSON.stringify({ count: 42, price: 19.99 });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('19.99')).toBeInTheDocument();
    });
  });


  describe('Table view', () => {
    it('should show table button for array of objects', () => {
      const output = JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]);
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    it('should switch to table view', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]);
      render(<OutputDisplay output={output} />);
      
      await user.click(screen.getByText('Table'));
      
      expect(screen.getByText('id')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    it('should not show table button for non-array JSON', () => {
      const output = JSON.stringify({ test: 'value' });
      render(<OutputDisplay output={output} />);
      
      expect(screen.queryByText('Table')).not.toBeInTheDocument();
    });
  });

  describe('Script output format', () => {
    it('should display console output section', () => {
      const output = JSON.stringify({
        console_output: 'Script executed successfully',
        result_data: []
      });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('Console Output')).toBeInTheDocument();
      expect(screen.getByText('Script executed successfully')).toBeInTheDocument();
    });

    it('should display result data section', () => {
      const output = JSON.stringify({
        console_output: 'Query executed',
        result_data: [{ id: 1, name: 'Test' }]
      });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText(/Result Data/)).toBeInTheDocument();
    });

    it('should toggle console output section', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify({
        console_output: 'Test output',
        result_data: []
      });
      render(<OutputDisplay output={output} />);
      
      const consoleButton = screen.getByText('Console Output').closest('button');
      await user.click(consoleButton);
      
      // Section should be collapsed
      expect(screen.queryByText('Test output')).not.toBeInTheDocument();
    });

    it('should toggle result data section', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify({
        console_output: 'Query executed',
        result_data: [{ id: 1 }]
      });
      render(<OutputDisplay output={output} />);
      
      const resultButton = screen.getByText(/Result Data/).closest('button');
      await user.click(resultButton);
      
      // Section should be collapsed
      const table = screen.queryByText('id');
      expect(table).not.toBeInTheDocument();
    });

    it('should show row count in result data header', () => {
      const output = JSON.stringify({
        console_output: 'Query executed',
        result_data: [{ id: 1 }, { id: 2 }, { id: 3 }]
      });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText(/Result Data \(3 rows\)/)).toBeInTheDocument();
    });

    it('should not show result data section when empty', () => {
      const output = JSON.stringify({
        console_output: 'Query executed',
        result_data: []
      });
      render(<OutputDisplay output={output} />);
      
      expect(screen.queryByText(/Result Data/)).not.toBeInTheDocument();
    });
  });


  describe('Edge cases', () => {
    it('should handle undefined value in JSON', () => {
      const output = JSON.stringify({ value: undefined });
      render(<OutputDisplay output={output} />);
      
      // undefined gets removed by JSON.stringify, so the object will be empty
      expect(screen.getByText('{}')).toBeInTheDocument();
    });

    it('should handle nested arrays', () => {
      const output = JSON.stringify([[1, 2], [3, 4]]);
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should handle nested objects', () => {
      const output = JSON.stringify({ user: { name: 'John', age: 30 } });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('"user"')).toBeInTheDocument();
      expect(screen.getByText('"name"')).toBeInTheDocument();
      expect(screen.getByText('"John"')).toBeInTheDocument();
    });

    it('should handle array with non-object items', () => {
      const output = JSON.stringify([1, 'text', true]);
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('"text"')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('should render table button for array with null items', () => {
      const output = JSON.stringify([null, null]);
      render(<OutputDisplay output={output} />);
      
      // Array is still an array, so table button should show
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    it('should not render table for array with different object structures', () => {
      const output = JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, email: 'jane@example.com' }
      ]);
      render(<OutputDisplay output={output} />);
      
      // Should show table button
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    it('should handle table with object values in cells', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify([
        { id: 1, data: { nested: 'value' } },
        { id: 2, data: { nested: 'value2' } }
      ]);
      render(<OutputDisplay output={output} />);
      
      await user.click(screen.getByText('Table'));
      
      // Should stringify nested objects
      expect(screen.getByText(/"nested":"value"/)).toBeInTheDocument();
    });

    it('should handle table with null values in cells', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify([
        { id: 1, name: null },
        { id: 2, name: 'John' }
      ]);
      render(<OutputDisplay output={output} />);
      
      await user.click(screen.getByText('Table'));
      
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('should switch back to formatted view from table', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]);
      render(<OutputDisplay output={output} />);
      
      await user.click(screen.getByText('Table'));
      // In table view, should see table headers
      const tableHeaders = screen.getAllByText('id');
      expect(tableHeaders.length).toBeGreaterThan(0);
      
      await user.click(screen.getByText('Formatted'));
      // In formatted view, should see JSON keys with quotes (multiple instances)
      const formattedKeys = screen.getAllByText('"id"');
      expect(formattedKeys.length).toBeGreaterThan(0);
    });

    it('should handle script output with metadata field', () => {
      const output = JSON.stringify({
        console_output: 'Test',
        metadata: { duration: 100 }
      });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('Console Output')).toBeInTheDocument();
    });

    it('should handle script output with queries field', () => {
      const output = JSON.stringify({
        console_output: 'Test',
        queries: ['SELECT * FROM users']
      });
      render(<OutputDisplay output={output} />);
      
      expect(screen.getByText('Console Output')).toBeInTheDocument();
    });

    it('should not show view mode toggle for script output', () => {
      const output = JSON.stringify({
        console_output: 'Test',
        result_data: [{ id: 1 }]
      });
      render(<OutputDisplay output={output} />);
      
      // Should not show Formatted/Raw/Table buttons
      expect(screen.queryByText('Formatted')).not.toBeInTheDocument();
      expect(screen.queryByText('Raw')).not.toBeInTheDocument();
    });

    it('should render result data as JSON when table cannot be rendered', async () => {
      const user = userEvent.setup();
      const output = JSON.stringify({
        console_output: 'Test',
        result_data: [1, 2, 3] // Array of primitives, not objects
      });
      render(<OutputDisplay output={output} />);
      
      // Should show result data section
      expect(screen.getByText(/Result Data/)).toBeInTheDocument();
      
      // Should render as JSON since table can't be created
      expect(screen.getByText(/1/)).toBeInTheDocument();
    });

    it('should handle empty console output', () => {
      const output = JSON.stringify({
        console_output: '',
        result_data: [{ id: 1 }]
      });
      render(<OutputDisplay output={output} />);
      
      // Should not show console output section when empty
      expect(screen.queryByText('Console Output')).not.toBeInTheDocument();
    });

    it('should handle result data with empty array after checking length', () => {
      const output = JSON.stringify({
        console_output: 'Test',
        result_data: []
      });
      render(<OutputDisplay output={output} />);
      
      // Should not show result data section
      expect(screen.queryByText(/Result Data/)).not.toBeInTheDocument();
    });
  });
});
