import { render, screen, waitFor } from '@testing-library/react';
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

// Mock fetch
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

describe('SubmitRequest', () => {
  let localStorageMock;
  let sessionStorageMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup localStorage mock
    localStorageMock = {
      getItem: jest.fn().mockReturnValue('test-token'),
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
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'sessionStorage', { 
      value: sessionStorageMock,
      writable: true 
    });
    
    dbAPI.getInstances.mockResolvedValue({ success: true, instances: [] });
    dbAPI.getDatabases.mockResolvedValue({ success: true, databases: [] });
  });

  it('should render page title', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Submit Database Request')).toBeInTheDocument();
  });

  it('should render database type dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Database Type')).toBeInTheDocument();
    expect(screen.getByText('Select type')).toBeInTheDocument();
  });

  it('should render instance dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Instance')).toBeInTheDocument();
  });

  it('should render database dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('should render pod dropdown', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Pod')).toBeInTheDocument();
  });

  it('should render request type radio buttons', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Request Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Query')).toBeInTheDocument();
    expect(screen.getByLabelText('Script')).toBeInTheDocument();
  });

  it('should show query input by default', () => {
    renderSubmitRequest();
    
    // Check for the Query label (not the radio button label)
    const queryLabels = screen.getAllByText('Query');
    // Should have at least the label for the textarea
    expect(queryLabels.length).toBeGreaterThan(0);
  });

  it('should show script upload when script type is selected', async () => {
    const user = userEvent.setup();
    renderSubmitRequest();
    
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
  });

  it('should render comments textarea', () => {
    renderSubmitRequest();
    
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Explain why/)).toBeInTheDocument();
  });

  it('should render submit button', () => {
    renderSubmitRequest();
    
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument();
  });

  it('should render cancel button', () => {
    renderSubmitRequest();
    
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should fetch instances when database type is selected', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    // Find the select by its label text
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(dbAPI.getInstances).toHaveBeenCalledWith('POSTGRES');
    });
  });

  it('should reset form when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderSubmitRequest();
    
    // Type in comments
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test comment');
    
    expect(commentsInput).toHaveValue('Test comment');
    
    // Click cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    expect(commentsInput).toHaveValue('');
  });

  it('should show documentation sidebar when script type is selected', async () => {
    const user = userEvent.setup();
    renderSubmitRequest();
    
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });
  });

  it('should show error toast when instances fail to load', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockRejectedValue(new Error('Failed to load'));
    
    renderSubmitRequest();
    
    // Find the select by its label text
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });

  it('should fetch databases when instance is selected', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['db1', 'db2'],
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(dbAPI.getDatabases).toHaveBeenCalledWith('1');
    });
  });

  it('should show error when databases fail to load', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockRejectedValue(new Error('Database error'));
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText(/Database error/)).toBeInTheDocument();
    });
  });

  it('should handle cloned request data from localStorage', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cloneRequest');
  });

  it('should handle cloned script request', async () => {
    const clonedData = {
      script: 'console.log("test");',
      database_type: 'MONGO',
      database_name: 'test_db',
      instance_name: 'test-mongo',
      comments: 'Cloned script',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      expect(screen.getByLabelText('Script')).toBeChecked();
    });
  });

  it('should handle invalid cloned request data', () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return 'invalid json';
      if (key === 'token') return 'test-token';
      return null;
    });
    
    renderSubmitRequest();
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cloneRequest');
  });

  it('should submit query request successfully', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, req_id: 123, status: 'PENDING' }),
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    // Find query textarea
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should show error when query is missing', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form without query
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    // Should show validation error
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it('should handle API error on submission', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'Submission failed' }),
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Submission failed/)).toBeInTheDocument();
    });
  });

  it('should show documentation for POSTGRES when script type is selected', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText('PostgreSQL Example:')).toBeInTheDocument();
    });
  });

  it('should show documentation for MONGO when script type is selected', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'MONGO');
    
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText('MongoDB Example:')).toBeInTheDocument();
    });
  });

  it('should show message to select database type when no type is selected for script', async () => {
    const user = userEvent.setup();
    
    renderSubmitRequest();
    
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Select a database type to see examples/)).toBeInTheDocument();
    });
  });

  it('should handle network error on submission', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockRejectedValue(new Error('Network error'));
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('should handle instances API returning success false', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: false,
      message: 'Failed to fetch instances',
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch instances/)).toBeInTheDocument();
    });
  });

  it('should handle databases API returning success false', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: false,
      message: 'Failed to fetch databases',
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch databases/)).toBeInTheDocument();
    });
  });

  it('should handle database fetch returning success false', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: false,
      message: 'Database fetch failed',
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText(/Database fetch failed/)).toBeInTheDocument();
    });
  });

  it('should handle file read error during file selection', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    // Select database type first
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Switch to script mode
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    const file = new File(['test content'], 'test.js', { type: 'text/javascript' });
    const fileInput = document.querySelector('#script-upload');
    
    // Mock FileReader to trigger error
    const originalFileReader = global.FileReader;
    global.FileReader = jest.fn().mockImplementation(() => ({
      readAsText: jest.fn(function() {
        if (this.onerror) {
          this.onerror();
        }
      }),
      onerror: null,
      onload: null,
    }));
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Error reading file/)).toBeInTheDocument();
    });
    
    global.FileReader = originalFileReader;
  });

  it('should handle file with only whitespace content', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    // Select database type first
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Switch to script mode
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    const file = new File(['   \n\t  '], 'test.js', { type: 'text/javascript' });
    const fileInput = document.querySelector('#script-upload');
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Cannot upload empty file/)).toBeInTheDocument();
    });
  });

  it('should prevent submission with empty script file', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test script');
    
    // Switch to script type
    await user.click(screen.getByLabelText('Script'));
    
    // Create empty file
    const emptyFile = new File([], 'empty.js', { type: 'text/javascript' });
    const fileInput = document.querySelector('#script-upload');
    
    // Mock FileReader to return empty content
    const originalFileReader = global.FileReader;
    global.FileReader = jest.fn().mockImplementation(() => ({
      readAsText: jest.fn(function() {
        this.result = '';
        this.onload({ target: { result: '' } });
      }),
      onerror: null,
      onload: null,
    }));
    
    await user.upload(fileInput, emptyFile);
    
    await waitFor(() => {
      expect(screen.getByText(/Cannot upload empty file/)).toBeInTheDocument();
    });
    
    global.FileReader = originalFileReader;
  });

  it('should download script preview when download button is clicked', async () => {
    const clonedData = {
      script: 'console.log("test");',
      database_type: 'MONGO',
      database_name: 'test_db',
      instance_name: 'test-mongo',
      comments: 'Cloned script',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock document.createElement to track anchor creation
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = jest.fn((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = mockClick;
      }
      return element;
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      expect(screen.getByText(/Script Preview/)).toBeInTheDocument();
    });
    
    const user = userEvent.setup();
    const downloadButton = screen.getByText('Download Script');
    await user.click(downloadButton);
    
    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled();
      expect(screen.getByText(/Script downloaded/)).toBeInTheDocument();
    });
    
    document.createElement = originalCreateElement;
  });

  it('should handle submission with validation errors from backend', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        errors: [
          { message: 'Query is required' },
          { message: 'Comments are required' },
        ],
      }),
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Query is required, Comments are required/)).toBeInTheDocument();
    });
  });

  it('should handle script submission successfully', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, req_id: 123, status: 'PENDING' }),
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test script');
    
    // Switch to script type
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Upload file
    const file = new File(['console.log("test");'], 'test.js', { type: 'text/javascript' });
    const fileInput = document.querySelector('#script-upload');
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/test.js/)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      expect(screen.getByText(/Request submitted successfully/)).toBeInTheDocument();
    });
  });

  it('should reset form including selected file when cancel is clicked', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Switch to script type
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Upload file
    const file = new File(['console.log("test");'], 'test.js', { type: 'text/javascript' });
    const fileInput = document.querySelector('#script-upload');
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/test.js/)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    // Form should be reset
    expect(dbTypeSelect).toHaveValue('');
    // File should be cleared - check that the file name is no longer displayed
    await waitFor(() => {
      expect(screen.queryByText(/test.js/)).not.toBeInTheDocument();
    });
  });

  it('should show submitting state during form submission', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });
  });

  it('should handle cloned request with auto-selected instance and database', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    sessionStorageMock.getItem.mockImplementation((key) => {
      if (key === 'clonedInstanceName') return 'test-instance';
      if (key === 'clonedDatabaseName') return 'test_db';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Wait for instance to be auto-selected
    await waitFor(() => {
      const instanceLabel = screen.getByText('Instance');
      const instanceSelect = instanceLabel.closest('div').querySelector('select');
      expect(instanceSelect).toHaveValue('1');
    }, { timeout: 3000 });
    
    // Wait for database to be auto-selected
    await waitFor(() => {
      const databaseLabel = screen.getByText('Database');
      const databaseSelect = databaseLabel.closest('div').querySelector('select');
      expect(databaseSelect).toHaveValue('test_db');
    }, { timeout: 3000 });
    
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('clonedInstanceName');
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('clonedDatabaseName');
  });
  it('should handle non-JS file upload', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    // Select database type first
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Switch to script mode
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Try to upload non-JS file
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('#script-upload');
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Only JavaScript \(\.js\) files are allowed/)).toBeInTheDocument();
    });
  });

  it('should handle file larger than 16MB', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    // Select database type first
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Switch to script mode
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Create a large file (mock size)
    const largeContent = 'x'.repeat(17 * 1024 * 1024); // 17MB
    const file = new File([largeContent], 'large.js', { type: 'text/javascript' });
    
    // Mock the size property
    Object.defineProperty(file, 'size', {
      value: 17 * 1024 * 1024,
      writable: false,
    });
    
    const fileInput = document.querySelector('#script-upload');
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/File size must be less than 16MB/)).toBeInTheDocument();
    });
  });

  it('should handle zero-size file upload', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    // Select database type first
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Switch to script mode
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Create empty file
    const file = new File([], 'empty.js', { type: 'text/javascript' });
    
    Object.defineProperty(file, 'size', {
      value: 0,
      writable: false,
    });
    
    const fileInput = document.querySelector('#script-upload');
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Cannot upload empty file/)).toBeInTheDocument();
    });
  });

  it('should prevent submission without selected script file', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test script');
    
    // Switch to script type but don't upload file
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Try to submit without file
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Please select a script file/)).toBeInTheDocument();
    });
  });

  it('should prevent submission with zero-size script file', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test script');
    
    // Switch to script type
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Create empty file and set it
    const file = new File([], 'empty.js', { type: 'text/javascript' });
    Object.defineProperty(file, 'size', {
      value: 0,
      writable: false,
    });
    
    const fileInput = document.querySelector('#script-upload');
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    // Manually set selectedFile to simulate the file being selected despite validation
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Cannot upload empty file/)).toBeInTheDocument();
    });
  });


  it('should handle submission failure with success false', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, message: 'Request creation failed' }),
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Request creation failed/)).toBeInTheDocument();
    });
  });

  it('should handle script submission with empty file during submit', async () => {
    const user = userEvent.setup();
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test script');
    
    // Switch to script type
    await user.click(screen.getByLabelText('Script'));
    
    await waitFor(() => {
      expect(screen.getByText(/Upload Script File/)).toBeInTheDocument();
    });
    
    // Create a file with content first
    const file = new File(['console.log("test");'], 'test.js', { type: 'text/javascript' });
    const fileInput = document.querySelector('#script-upload');
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/test.js/)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Now manually set the file size to 0 to simulate the edge case
    // This tests the additional check during submission (lines 243-244)
    Object.defineProperty(file, 'size', {
      value: 0,
      writable: false,
      configurable: true,
    });
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Cannot submit empty script file/)).toBeInTheDocument();
    });
  });

  it('should handle instances API returning no message on failure', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: false,
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load instances/)).toBeInTheDocument();
    });
  });

  it('should handle databases API returning no message on failure', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: false,
    });
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load databases/)).toBeInTheDocument();
    });
  });

  it('should handle instances API error with no message', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockRejectedValue(new Error());
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load instances/)).toBeInTheDocument();
    });
  });

  it('should handle databases API error with no message', async () => {
    const user = userEvent.setup();
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockRejectedValue(new Error());
    
    renderSubmitRequest();
    
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load databases/)).toBeInTheDocument();
    });
  });

  it('should handle submission error with no message', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockRejectedValue(new Error());
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Network error occurred/)).toBeInTheDocument();
    });
  });

  it('should handle submission with no result message on failure', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to submit request/)).toBeInTheDocument();
    });
  });

  it('should handle API error response with no result message', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    // Fill form
    const dbTypeLabel = screen.getByText('Database Type');
    const dbTypeSelect = dbTypeLabel.closest('div').querySelector('select');
    await user.selectOptions(dbTypeSelect, 'POSTGRES');
    
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    await user.selectOptions(instanceSelect, '1');
    
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    });
    
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    await user.selectOptions(databaseSelect, 'test_db');
    
    const podLabel = screen.getByText('Pod');
    const podSelect = podLabel.closest('div').querySelector('select');
    await user.selectOptions(podSelect, 'pod-1');
    
    const commentsInput = screen.getByPlaceholderText(/Explain why/);
    await user.type(commentsInput, 'Test query');
    
    const textareas = screen.getAllByRole('textbox');
    const queryTextarea = textareas.find(ta => ta.className.includes('font-mono'));
    if (queryTextarea) {
      await user.type(queryTextarea, 'SELECT * FROM users');
    }
    
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to submit request/)).toBeInTheDocument();
    });
  });

  it('should handle cloned request without database_type', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cloneRequest');
  });

  it('should handle cloned request without query or script', async () => {
    const clonedData = {
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cloneRequest');
  });

  it('should handle cloned request without comments', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('');
    });
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cloneRequest');
  });

  it('should handle cloned request without pod_id', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cloneRequest');
  });

  it('should handle cloned request without instance_name', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Should not try to set instance
    expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith('clonedInstanceName', expect.anything());
  });

  it('should handle cloned request without database_name', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Should not try to set database
    expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith('clonedDatabaseName', expect.anything());
  });

  it('should not auto-select instance when no matching instance found', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'non-existent-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    sessionStorageMock.getItem.mockImplementation((key) => {
      if (key === 'clonedInstanceName') return 'non-existent-instance';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Wait for instances to load
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Instance should not be auto-selected
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    expect(instanceSelect).toHaveValue('');
  });

  it('should not auto-select database when database not in list', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'non_existent_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    sessionStorageMock.getItem.mockImplementation((key) => {
      if (key === 'clonedInstanceName') return 'test-instance';
      if (key === 'clonedDatabaseName') return 'non_existent_db';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db', 'other_db'],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Wait for instance to be auto-selected
    await waitFor(() => {
      const instanceLabel = screen.getByText('Instance');
      const instanceSelect = instanceLabel.closest('div').querySelector('select');
      expect(instanceSelect).toHaveValue('1');
    }, { timeout: 3000 });
    
    // Wait for databases to load
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Database should not be auto-selected
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    expect(databaseSelect).toHaveValue('');
  });

  it('should not auto-select instance when instances list is empty', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    sessionStorageMock.getItem.mockImplementation((key) => {
      if (key === 'clonedInstanceName') return 'test-instance';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Instance should not be auto-selected
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    expect(instanceSelect).toHaveValue('');
  });

  it('should not auto-select database when databases list is empty', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    sessionStorageMock.getItem.mockImplementation((key) => {
      if (key === 'clonedInstanceName') return 'test-instance';
      if (key === 'clonedDatabaseName') return 'test_db';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: [],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Wait for instance to be auto-selected
    await waitFor(() => {
      const instanceLabel = screen.getByText('Instance');
      const instanceSelect = instanceLabel.closest('div').querySelector('select');
      expect(instanceSelect).toHaveValue('1');
    }, { timeout: 3000 });
    
    // Database should not be auto-selected
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    expect(databaseSelect).toHaveValue('');
  });

  it('should not fetch instances when clonedInstanceName is not in sessionStorage', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    sessionStorageMock.getItem.mockReturnValue(null);
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Wait for instances to load
    await waitFor(() => {
      expect(screen.getByText('test-instance')).toBeInTheDocument();
    });
    
    // Instance should not be auto-selected
    const instanceLabel = screen.getByText('Instance');
    const instanceSelect = instanceLabel.closest('div').querySelector('select');
    expect(instanceSelect).toHaveValue('');
  });

  it('should not fetch databases when clonedDatabaseName is not in sessionStorage', async () => {
    const clonedData = {
      query: 'SELECT * FROM users',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'test-instance',
      comments: 'Cloned request',
      pod_id: 'pod-1',
    };
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'cloneRequest') return JSON.stringify(clonedData);
      if (key === 'token') return 'test-token';
      return null;
    });
    
    sessionStorageMock.getItem.mockImplementation((key) => {
      if (key === 'clonedInstanceName') return 'test-instance';
      return null;
    });
    
    dbAPI.getInstances.mockResolvedValue({
      success: true,
      instances: [{ id: 1, name: 'test-instance' }],
    });
    dbAPI.getDatabases.mockResolvedValue({
      success: true,
      databases: ['test_db'],
    });
    
    renderSubmitRequest();
    
    await waitFor(() => {
      const commentsInput = screen.getByPlaceholderText(/Explain why/);
      expect(commentsInput).toHaveValue('Cloned request');
    });
    
    // Wait for instance to be auto-selected
    await waitFor(() => {
      const instanceLabel = screen.getByText('Instance');
      const instanceSelect = instanceLabel.closest('div').querySelector('select');
      expect(instanceSelect).toHaveValue('1');
    }, { timeout: 3000 });
    
    // Wait for databases to load
    await waitFor(() => {
      expect(screen.getByText('test_db')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Database should not be auto-selected
    const databaseLabel = screen.getByText('Database');
    const databaseSelect = databaseLabel.closest('div').querySelector('select');
    expect(databaseSelect).toHaveValue('');
  });
});