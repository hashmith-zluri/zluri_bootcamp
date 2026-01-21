import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SubmitRequest from '../../src/pages/SubmitRequest';
import { ToastProvider } from '../../src/context/ToastContext';

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

// Mock dbAPI
jest.mock('../../src/utils/api', () => ({
  dbAPI: {
    getInstances: jest.fn(),
    getDatabases: jest.fn(),
  },
}));

import { dbAPI } from '../../src/utils/api';

// Mock fetch for form submission
global.fetch = jest.fn();

const renderSubmitRequest = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <SubmitRequest />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('SubmitRequest - Branch Coverage Tests', () => {
  let localStorageMock;
  let sessionStorageMock;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup localStorage mock
    localStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', { 
      value: localStorageMock,
      writable: true 
    });

    // Setup sessionStorage mock
    sessionStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'sessionStorage', { 
      value: sessionStorageMock,
      writable: true 
    });

    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock successful API responses
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [
        { id: 1, name: 'test-instance', type: 'POSTGRES' }
      ]
    });

    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['testdb', 'proddb']
    });

    // Mock successful fetch
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle cloned request with invalid JSON', async () => {
    localStorageMock.getItem.mockReturnValue('invalid-json');

    renderSubmitRequest();

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse cloned request:', expect.any(Error));
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cloneRequest');
  });

  it('should handle cloned request with valid script data', async () => {
    const scriptRequest = {
      script: 'db.users.find()',
      database_type: 'MONGO',
      database_name: 'testdb',
      instance_name: 'test-instance',
      comments: 'Test script',
      pod_id: 'pod1'
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(scriptRequest));

    renderSubmitRequest();

    await waitFor(() => {
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('clonedInstanceName', 'test-instance');
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('clonedDatabaseName', 'testdb');
    });
  });

  it('should handle API failure for getInstances', async () => {
    dbAPI.getInstances.mockRejectedValue(new Error('API Error'));

    renderSubmitRequest();

    // Wait for component to mount and try to load instances
    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Select database type to trigger API call
    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    await waitFor(() => {
      expect(dbAPI.getInstances).toHaveBeenCalledWith('POSTGRES');
    });
  });

  it('should handle API failure for getDatabases', async () => {
    dbAPI.getDatabases.mockRejectedValue(new Error('Database API Error'));

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Select database type first
    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    await waitFor(() => {
      expect(dbAPI.getInstances).toHaveBeenCalled();
    });

    // Select instance to trigger database loading
    const instanceSelect = screen.getByDisplayValue('Select instance');
    fireEvent.change(instanceSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(dbAPI.getDatabases).toHaveBeenCalledWith('1');
    });
  });

  it('should handle unsuccessful API response for getInstances', async () => {
    dbAPI.getInstances.mockResolvedValue({
      success: false,
      message: 'Failed to load instances'
    });

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    await waitFor(() => {
      expect(dbAPI.getInstances).toHaveBeenCalledWith('POSTGRES');
    });
  });

  it('should handle unsuccessful API response for getDatabases', async () => {
    dbAPI.getDatabases.mockResolvedValue({
      success: false,
      message: 'Failed to load databases'
    });

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    // Wait for instances to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select instance')).toBeInTheDocument();
    });

    const instanceSelect = screen.getByDisplayValue('Select instance');
    fireEvent.change(instanceSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(dbAPI.getDatabases).toHaveBeenCalledWith('1');
    });
  });

  it('should handle file upload with wrong extension', async () => {
    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Switch to script mode first
    const scriptRadio = screen.getByRole('radio', { name: /script/i });
    fireEvent.click(scriptRadio);

    // Now the file input should be visible
    await waitFor(() => {
      expect(screen.getByText('Upload Script File')).toBeInTheDocument();
    });

    // Try to upload a non-JS file using the file input ID
    const fileInput = document.getElementById('script-upload');
    expect(fileInput).toBeInTheDocument();
    
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Should show error for wrong file type
    await waitFor(() => {
      expect(screen.getByText('Only JavaScript (.js) files are allowed')).toBeInTheDocument();
    });
  });

  it('should handle file upload with large file', async () => {
    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Switch to script mode first
    const scriptRadio = screen.getByRole('radio', { name: /script/i });
    fireEvent.click(scriptRadio);

    // Now the file input should be visible
    await waitFor(() => {
      expect(screen.getByText('Upload Script File')).toBeInTheDocument();
    });

    // Create a large file mock
    const largeFile = new File(['a'.repeat(6 * 1024 * 1024)], 'test.js', { type: 'text/javascript' });
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });
    
    const fileInput = document.getElementById('script-upload');
    expect(fileInput).toBeInTheDocument();
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('File size must be less than 5MB')).toBeInTheDocument();
    });
  });

  it('should handle empty file upload', async () => {
    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Switch to script mode first
    const scriptRadio = screen.getByRole('radio', { name: /script/i });
    fireEvent.click(scriptRadio);

    // Now the file input should be visible
    await waitFor(() => {
      expect(screen.getByText('Upload Script File')).toBeInTheDocument();
    });

    // Create empty file
    const emptyFile = new File([''], 'test.js', { type: 'text/javascript' });
    Object.defineProperty(emptyFile, 'size', { value: 0 });
    
    const fileInput = document.getElementById('script-upload');
    expect(fileInput).toBeInTheDocument();
    
    fireEvent.change(fileInput, { target: { files: [emptyFile] } });

    await waitFor(() => {
      expect(screen.getByText('Cannot upload empty file. Please add content to your script.')).toBeInTheDocument();
    });
  });

  it('should handle file reader error', async () => {
    // Mock FileReader to simulate error
    const mockFileReader = {
      readAsText: jest.fn(),
      onerror: null,
      onload: null,
    };
    
    global.FileReader = jest.fn(() => mockFileReader);

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Switch to script mode first
    const scriptRadio = screen.getByRole('radio', { name: /script/i });
    fireEvent.click(scriptRadio);

    // Now the file input should be visible
    await waitFor(() => {
      expect(screen.getByText('Upload Script File')).toBeInTheDocument();
    });

    const file = new File(['test content'], 'test.js', { type: 'text/javascript' });
    const fileInput = document.getElementById('script-upload');
    expect(fileInput).toBeInTheDocument();
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Simulate file reader error
    if (mockFileReader.onerror) {
      mockFileReader.onerror();
    }

    await waitFor(() => {
      expect(screen.getByText('Error reading file. Please try again.')).toBeInTheDocument();
    });
  });

  it('should handle form submission with network error', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Fill all required form fields step by step
    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    // Wait for instances to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select instance')).toBeInTheDocument();
    });
    
    const instanceSelect = screen.getByDisplayValue('Select instance');
    fireEvent.change(instanceSelect, { target: { value: '1' } });

    // Wait for databases to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select database')).toBeInTheDocument();
    });
    
    const databaseSelect = screen.getByDisplayValue('Select database');
    fireEvent.change(databaseSelect, { target: { value: 'testdb' } });

    // Select pod
    const podSelect = screen.getByDisplayValue('Select pod');
    fireEvent.change(podSelect, { target: { value: 'pod-1' } });

    // Fill comments
    const commentsTextarea = screen.getByPlaceholderText('Explain why you need to run this query/script...');
    fireEvent.change(commentsTextarea, { target: { value: 'Test comment' } });

    // Add query content
    const queryTextarea = screen.getByPlaceholderText('SELECT * FROM table_name;');
    fireEvent.change(queryTextarea, { target: { value: 'SELECT * FROM users;' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should handle form submission with validation errors from backend', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        errors: [
          { message: 'Query is required' },
          { message: 'Database is required' }
        ]
      }),
    });

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Fill all required form fields step by step
    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    // Wait for instances to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select instance')).toBeInTheDocument();
    });
    
    const instanceSelect = screen.getByDisplayValue('Select instance');
    fireEvent.change(instanceSelect, { target: { value: '1' } });

    // Wait for databases to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select database')).toBeInTheDocument();
    });
    
    const databaseSelect = screen.getByDisplayValue('Select database');
    fireEvent.change(databaseSelect, { target: { value: 'testdb' } });

    // Select pod
    const podSelect = screen.getByDisplayValue('Select pod');
    fireEvent.change(podSelect, { target: { value: 'pod-1' } });

    // Fill comments
    const commentsTextarea = screen.getByPlaceholderText('Explain why you need to run this query/script...');
    fireEvent.change(commentsTextarea, { target: { value: 'Test comment' } });

    // Add query content
    const queryTextarea = screen.getByPlaceholderText('SELECT * FROM table_name;');
    fireEvent.change(queryTextarea, { target: { value: 'SELECT * FROM users;' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should handle form submission with generic error from backend', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        message: 'Generic error'
      }),
    });

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Fill all required form fields step by step
    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    // Wait for instances to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select instance')).toBeInTheDocument();
    });
    
    const instanceSelect = screen.getByDisplayValue('Select instance');
    fireEvent.change(instanceSelect, { target: { value: '1' } });

    // Wait for databases to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select database')).toBeInTheDocument();
    });
    
    const databaseSelect = screen.getByDisplayValue('Select database');
    fireEvent.change(databaseSelect, { target: { value: 'testdb' } });

    // Select pod
    const podSelect = screen.getByDisplayValue('Select pod');
    fireEvent.change(podSelect, { target: { value: 'pod-1' } });

    // Fill comments
    const commentsTextarea = screen.getByPlaceholderText('Explain why you need to run this query/script...');
    fireEvent.change(commentsTextarea, { target: { value: 'Test comment' } });

    // Add query content
    const queryTextarea = screen.getByPlaceholderText('SELECT * FROM table_name;');
    fireEvent.change(queryTextarea, { target: { value: 'SELECT * FROM users;' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should handle successful form submission', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Fill all required form fields step by step
    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    // Wait for instances to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select instance')).toBeInTheDocument();
    });
    
    const instanceSelect = screen.getByDisplayValue('Select instance');
    fireEvent.change(instanceSelect, { target: { value: '1' } });

    // Wait for databases to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select database')).toBeInTheDocument();
    });
    
    const databaseSelect = screen.getByDisplayValue('Select database');
    fireEvent.change(databaseSelect, { target: { value: 'testdb' } });

    // Select pod
    const podSelect = screen.getByDisplayValue('Select pod');
    fireEvent.change(podSelect, { target: { value: 'pod-1' } });

    // Fill comments
    const commentsTextarea = screen.getByPlaceholderText('Explain why you need to run this query/script...');
    fireEvent.change(commentsTextarea, { target: { value: 'Test comment' } });

    // Add query content
    const queryTextarea = screen.getByPlaceholderText('SELECT * FROM table_name;');
    fireEvent.change(queryTextarea, { target: { value: 'SELECT * FROM users;' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should handle unsuccessful form submission response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, message: 'Submission failed' }),
    });

    renderSubmitRequest();

    await waitFor(() => {
      expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
    });

    // Fill all required form fields step by step
    const dbTypeSelect = screen.getByDisplayValue('Select type');
    fireEvent.change(dbTypeSelect, { target: { value: 'POSTGRES' } });

    // Wait for instances to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select instance')).toBeInTheDocument();
    });
    
    const instanceSelect = screen.getByDisplayValue('Select instance');
    fireEvent.change(instanceSelect, { target: { value: '1' } });

    // Wait for databases to load and select one
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select database')).toBeInTheDocument();
    });
    
    const databaseSelect = screen.getByDisplayValue('Select database');
    fireEvent.change(databaseSelect, { target: { value: 'testdb' } });

    // Select pod
    const podSelect = screen.getByDisplayValue('Select pod');
    fireEvent.change(podSelect, { target: { value: 'pod-1' } });

    // Fill comments
    const commentsTextarea = screen.getByPlaceholderText('Explain why you need to run this query/script...');
    fireEvent.change(commentsTextarea, { target: { value: 'Test comment' } });

    // Add query content
    const queryTextarea = screen.getByPlaceholderText('SELECT * FROM table_name;');
    fireEvent.change(queryTextarea, { target: { value: 'SELECT * FROM users;' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});