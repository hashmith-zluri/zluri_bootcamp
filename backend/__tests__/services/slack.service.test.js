const { WebClient } = require('@slack/web-api');
const { Message, Blocks } = require('slack-block-builder');

// Mock the dependencies
jest.mock('@slack/web-api');
jest.mock('slack-block-builder');

// Shared test setup
let slackService;
let mockClient;
let originalEnv;

// Helper to create service with specific config
const createService = (enabled = true) => {
  process.env.SLACK_ENABLED = enabled ? 'true' : 'false';
  process.env.SLACK_BOT_TOKEN = 'test-token';
  process.env.SLACK_APPROVAL_CHANNEL = 'test-channel';
  process.env.SLACK_ADMIN_EMAIL = 'admin@test.com';
  
  jest.resetModules();
  return require('../../src/services/slack.service');
};

describe('Slack Service', () => {
  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock client
    mockClient = {
      chat: {
        postMessage: jest.fn().mockResolvedValue({ ok: true })
      },
      users: {
        lookupByEmail: jest.fn().mockResolvedValue({ user: { id: 'U12345' } })
      },
      auth: {
        test: jest.fn().mockResolvedValue({ user: 'test-bot', team: 'Test Team' })
      }
    };
    
    WebClient.mockImplementation(() => mockClient);
    
    // Setup mock message builder
    const mockMessageBuilder = {
      blocks: jest.fn().mockReturnThis(),
      buildToObject: jest.fn().mockReturnValue({ blocks: [] })
    };
    
    Message.mockReturnValue(mockMessageBuilder);
    
    Blocks.Header = jest.fn().mockReturnValue({});
    Blocks.Section = jest.fn().mockReturnValue({ 
      fields: jest.fn().mockReturnThis()
    });
    Blocks.Divider = jest.fn().mockReturnValue({});
    Blocks.Context = jest.fn().mockReturnValue({ 
      elements: jest.fn().mockReturnThis() 
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  describe('constructor and isEnabled', () => {
    it('should be enabled when SLACK_ENABLED is true', () => {
      slackService = createService(true);
      expect(slackService.isEnabled()).toBe(true);
    });

    it('should be disabled when SLACK_ENABLED is false', () => {
      slackService = createService(false);
      expect(slackService.isEnabled()).toBe(false);
    });

    it('should be disabled when SLACK_ENABLED is undefined', () => {
      process.env.SLACK_ENABLED = undefined;
      jest.resetModules();
      const SlackServiceNew = require('../../src/services/slack.service');
      expect(SlackServiceNew.isEnabled()).toBe(false);
    });

    it('should be disabled when SLACK_ENABLED is empty string', () => {
      process.env.SLACK_ENABLED = '';
      jest.resetModules();
      const SlackServiceNew = require('../../src/services/slack.service');
      expect(SlackServiceNew.isEnabled()).toBe(false);
    });

    it('should be disabled when SLACK_ENABLED is false string', () => {
      process.env.SLACK_ENABLED = 'false';
      jest.resetModules();
      const SlackServiceNew = require('../../src/services/slack.service');
      expect(SlackServiceNew.isEnabled()).toBe(false);
    });

    it('should use default admin email when not provided', () => {
      delete process.env.SLACK_ADMIN_EMAIL;
      process.env.SLACK_ENABLED = 'true';
      jest.resetModules();
      const SlackServiceNew = require('../../src/services/slack.service');
      expect(SlackServiceNew.adminEmail).toBe('hashmith.b@zluri.com');
    });

    it('should use custom admin email when provided', () => {
      process.env.SLACK_ADMIN_EMAIL = 'custom@example.com';
      process.env.SLACK_ENABLED = 'true';
      jest.resetModules();
      const SlackServiceNew = require('../../src/services/slack.service');
      expect(SlackServiceNew.adminEmail).toBe('custom@example.com');
    });

    it('should use default frontend URL when not provided', () => {
      delete process.env.FRONTEND_URL;
      process.env.SLACK_ENABLED = 'true';
      jest.resetModules();
      const SlackServiceNew = require('../../src/services/slack.service');
      expect(SlackServiceNew.frontendUrl).toBe('https://zluri-bootcamp.vercel.app');
    });

    it('should use custom frontend URL when provided', () => {
      process.env.FRONTEND_URL = 'https://custom.example.com';
      process.env.SLACK_ENABLED = 'true';
      jest.resetModules();
      const SlackServiceNew = require('../../src/services/slack.service');
      expect(SlackServiceNew.frontendUrl).toBe('https://custom.example.com');
    });
  });

  describe('truncateText', () => {
    beforeEach(() => {
      slackService = createService(true);
    });

    it('should return empty string for null', () => {
      expect(slackService.truncateText(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(slackService.truncateText(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(slackService.truncateText('')).toBe('');
    });

    it('should return empty string for false', () => {
      expect(slackService.truncateText(false)).toBe('');
    });

    it('should return empty string for 0', () => {
      expect(slackService.truncateText(0)).toBe('');
    });

    it('should not truncate text shorter than max length', () => {
      expect(slackService.truncateText('short', 500)).toBe('short');
    });

    it('should truncate text longer than max length', () => {
      const longText = 'a'.repeat(600);
      const result = slackService.truncateText(longText, 500);
      expect(result).toBe('a'.repeat(500) + '...');
      expect(result.length).toBe(503);
    });

    it('should use default max length of 500', () => {
      const longText = 'a'.repeat(600);
      const result = slackService.truncateText(longText);
      expect(result.length).toBe(503);
    });

    it('should not truncate text exactly at max length', () => {
      const exactText = 'a'.repeat(500);
      expect(slackService.truncateText(exactText, 500)).toBe(exactText);
    });

    it('should handle custom max length', () => {
      const text = 'Hello World';
      expect(slackService.truncateText(text, 5)).toBe('Hello...');
    });

    it('should handle max length of 0', () => {
      expect(slackService.truncateText('test', 0)).toBe('...');
    });

    it('should handle negative max length', () => {
      expect(slackService.truncateText('test', -5)).toBe('...');
    });

    it('should handle very long text with small max length', () => {
      const longText = 'a'.repeat(1000);
      const result = slackService.truncateText(longText, 10);
      expect(result).toBe('a'.repeat(10) + '...');
      expect(result.length).toBe(13);
    });
  });

  describe('formatQueryPreview', () => {
    beforeEach(() => {
      slackService = createService(true);
    });

    it('should return query when provided', () => {
      expect(slackService.formatQueryPreview('SELECT * FROM users', null)).toBe('SELECT * FROM users');
    });

    it('should return script when query is null', () => {
      expect(slackService.formatQueryPreview(null, 'script.js')).toBe('script.js');
    });

    it('should return script when query is undefined', () => {
      expect(slackService.formatQueryPreview(undefined, 'script.js')).toBe('script.js');
    });

    it('should return script when query is empty string', () => {
      expect(slackService.formatQueryPreview('', 'script.js')).toBe('script.js');
    });

    it('should return script when query is false', () => {
      expect(slackService.formatQueryPreview(false, 'script.js')).toBe('script.js');
    });

    it('should prefer query over script', () => {
      expect(slackService.formatQueryPreview('SELECT 1', 'script.js')).toBe('SELECT 1');
    });

    it('should return N/A when both are null', () => {
      expect(slackService.formatQueryPreview(null, null)).toBe('N/A');
    });

    it('should return N/A when both are undefined', () => {
      expect(slackService.formatQueryPreview(undefined, undefined)).toBe('N/A');
    });

    it('should return N/A when both are empty strings', () => {
      expect(slackService.formatQueryPreview('', '')).toBe('N/A');
    });

    it('should return N/A when both are falsy', () => {
      expect(slackService.formatQueryPreview(false, 0)).toBe('N/A');
    });

    it('should truncate long queries to 200 chars', () => {
      const longQuery = 'SELECT ' + 'a'.repeat(300);
      const result = slackService.formatQueryPreview(longQuery, null);
      expect(result.length).toBe(203);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should truncate long scripts to 200 chars', () => {
      const longScript = 'console.log(' + 'a'.repeat(300) + ')';
      const result = slackService.formatQueryPreview(null, longScript);
      expect(result.length).toBe(203);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle multiline queries', () => {
      const multilineQuery = 'SELECT *\nFROM users\nWHERE active = true';
      expect(slackService.formatQueryPreview(multilineQuery, null)).toBe(multilineQuery);
    });

    it('should handle special characters', () => {
      const queryWithSpecialChars = "SELECT * FROM users WHERE name = 'O''Reilly'";
      expect(slackService.formatQueryPreview(queryWithSpecialChars, null)).toBe(queryWithSpecialChars);
    });
  });

  describe('formatExecutionOutput', () => {
    beforeEach(() => {
      slackService = createService(true);
    });

    describe('null/undefined/empty handling', () => {
      it('should return "No output" for null', () => {
        expect(slackService.formatExecutionOutput(null)).toBe('No output');
      });

      it('should return "No output" for undefined', () => {
        expect(slackService.formatExecutionOutput(undefined)).toBe('No output');
      });

      it('should return "No output" for empty string', () => {
        expect(slackService.formatExecutionOutput('')).toBe('No output');
      });

      it('should return "No output" for false', () => {
        expect(slackService.formatExecutionOutput(false)).toBe('No output');
      });

      it('should return "No output" for 0', () => {
        expect(slackService.formatExecutionOutput(0)).toBe('No output');
      });
    });

    describe('query format (console_output + result_data)', () => {
      it('should show sample when more than 3 results', () => {
        const output = JSON.stringify({
          console_output: 'Query executed. 5 rows.',
          result_data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
        });
        const result = slackService.formatExecutionOutput(output);
        
        expect(result).toContain('Query executed. 5 rows.');
        expect(result).toContain('Showing 3 of 5 results');
        expect(result).toContain('"id": 1');
        expect(result).toContain('"id": 3');
        expect(result).not.toContain('"id": 4');
      });

      it('should show all when exactly 3 results', () => {
        const output = JSON.stringify({
          console_output: 'Query executed. 3 rows.',
          result_data: [{ id: 1 }, { id: 2 }, { id: 3 }]
        });
        const result = slackService.formatExecutionOutput(output);
        
        expect(result).toContain('3 results');
        expect(result).not.toContain('Showing');
      });

      it('should use plural for 2 results', () => {
        const output = JSON.stringify({
          console_output: 'Query executed.',
          result_data: [{ id: 1 }, { id: 2 }]
        });
        const result = slackService.formatExecutionOutput(output);
        
        expect(result).toContain('2 results');
      });

      it('should use singular for 1 result', () => {
        const output = JSON.stringify({
          console_output: 'Query executed.',
          result_data: [{ id: 1 }]
        });
        const result = slackService.formatExecutionOutput(output);
        
        expect(result).toContain('1 result');
        expect(result).not.toContain('1 results');
      });

      it('should handle empty result_data array', () => {
        const output = JSON.stringify({
          console_output: 'No rows returned.',
          result_data: []
        });
        expect(slackService.formatExecutionOutput(output)).toBe('No rows returned.');
      });

      it('should handle empty console_output with empty result_data', () => {
        const output = JSON.stringify({
          console_output: '',
          result_data: []
        });
        expect(slackService.formatExecutionOutput(output)).toBe('Query executed successfully. No rows returned.');
      });

      it('should handle null console_output with empty result_data', () => {
        const output = JSON.stringify({
          console_output: null,
          result_data: []
        });
        expect(slackService.formatExecutionOutput(output)).toBe('Query executed successfully. No rows returned.');
      });

      it('should handle empty console_output with results', () => {
        const output = JSON.stringify({
          console_output: '',
          result_data: [{ id: 1 }, { id: 2 }]
        });
        const result = slackService.formatExecutionOutput(output);
        
        expect(result).toContain('2 results');
        expect(result).toContain('"id": 1');
      });

      it('should handle null result_data', () => {
        const output = JSON.stringify({
          console_output: 'Query executed.',
          result_data: null
        });
        expect(slackService.formatExecutionOutput(output)).toBe('Query executed.');
      });

      it('should handle non-array result_data', () => {
        const output = JSON.stringify({
          console_output: 'Query executed.',
          result_data: { count: 5 }
        });
        expect(slackService.formatExecutionOutput(output)).toBe('Query executed.');
      });
    });

    describe('script format (console_output only)', () => {
      it('should return console_output for script', () => {
        const output = JSON.stringify({
          console_output: 'Script completed successfully'
        });
        expect(slackService.formatExecutionOutput(output)).toBe('Script completed successfully');
      });

      it('should handle multiline console_output', () => {
        const output = JSON.stringify({
          console_output: 'Line 1\nLine 2\nLine 3'
        });
        expect(slackService.formatExecutionOutput(output)).toBe('Line 1\nLine 2\nLine 3');
      });

      it('should handle empty console_output', () => {
        const output = JSON.stringify({
          console_output: ''
        });
        const result = slackService.formatExecutionOutput(output);
        expect(result).toBe('{\n  "console_output": ""\n}');
      });

      it('should handle null console_output', () => {
        const output = JSON.stringify({
          console_output: null
        });
        const result = slackService.formatExecutionOutput(output);
        expect(result).toBe('{\n  "console_output": null\n}');
      });

      it('should handle undefined console_output', () => {
        const output = JSON.stringify({
          console_output: undefined
        });
        const result = slackService.formatExecutionOutput(output);
        expect(result).toBe('{}');
      });

      it('should handle false console_output', () => {
        const output = JSON.stringify({
          console_output: false
        });
        const result = slackService.formatExecutionOutput(output);
        expect(result).toBe('{\n  "console_output": false\n}');
      });

      it('should handle 0 console_output', () => {
        const output = JSON.stringify({
          console_output: 0
        });
        const result = slackService.formatExecutionOutput(output);
        expect(result).toBe('{\n  "console_output": 0\n}');
      });
    });

    describe('generic JSON', () => {
      it('should stringify generic JSON object', () => {
        const output = JSON.stringify({ status: 'success', count: 5 });
        const result = slackService.formatExecutionOutput(output);
        
        expect(result).toContain('"status": "success"');
        expect(result).toContain('"count": 5');
      });

      it('should handle complex nested objects', () => {
        const output = JSON.stringify({ 
          data: { users: [{ name: 'John' }] },
          meta: { total: 1 }
        });
        const result = slackService.formatExecutionOutput(output);
        
        expect(result).toContain('"users"');
        expect(result).toContain('"John"');
        expect(result).toContain('"total": 1');
      });
    });

    describe('non-JSON output', () => {
      it('should return plain text as-is', () => {
        expect(slackService.formatExecutionOutput('Plain text')).toBe('Plain text');
      });

      it('should handle malformed JSON', () => {
        expect(slackService.formatExecutionOutput('{ invalid }')).toBe('{ invalid }');
      });

      it('should handle partial JSON', () => {
        expect(slackService.formatExecutionOutput('{"incomplete":')).toBe('{"incomplete":');
      });

      it('should handle numbers as strings', () => {
        expect(slackService.formatExecutionOutput('12345')).toBe('12345');
      });

      it('should handle boolean strings', () => {
        expect(slackService.formatExecutionOutput('true')).toBe('true');
        expect(slackService.formatExecutionOutput('false')).toBe('false');
      });
    });
  });

  describe('getUserIdByEmail', () => {
    it('should return null when disabled', async () => {
      slackService = createService(false);
      const result = await slackService.getUserIdByEmail('test@test.com');
      expect(result).toBeNull();
    });

    it('should return user ID when found', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.users.lookupByEmail.mockResolvedValue({ user: { id: 'U12345' } });
      
      const result = await slackService.getUserIdByEmail('test@test.com');
      
      expect(result).toBe('U12345');
      expect(mockClient.users.lookupByEmail).toHaveBeenCalledWith({ email: 'test@test.com' });
    });

    it('should return null when user not found', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.users.lookupByEmail.mockResolvedValue({ user: null });
      
      const result = await slackService.getUserIdByEmail('notfound@test.com');
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.users.lookupByEmail.mockRejectedValue(new Error('API error'));
      
      const result = await slackService.getUserIdByEmail('error@test.com');
      expect(result).toBeNull();
    });

    it('should return null when user object is missing id', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.users.lookupByEmail.mockResolvedValue({ user: {} });
      
      const result = await slackService.getUserIdByEmail('test@test.com');
      expect(result).toBeNull();
    });
  });

  describe('testConnection', () => {
    it('should return disabled message when not enabled', async () => {
      slackService = createService(false);
      
      const result = await slackService.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Slack integration is disabled');
    });

    it('should return success on successful connection', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.auth.test.mockResolvedValue({ user: 'bot-name', team: 'Team Name' });
      
      const result = await slackService.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Slack connection successful');
      expect(result.botName).toBe('bot-name');
      expect(result.teamName).toBe('Team Name');
    });

    it('should return failure on connection error', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.auth.test.mockRejectedValue(new Error('Connection failed'));
      
      const result = await slackService.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Slack connection failed: Connection failed');
    });
  });

  describe('notifyNewSubmission', () => {
    const mockRequestData = {
      req_id: 123,
      requester_name: 'John Doe',
      requester_email: 'john@test.com',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'local-postgres',
      query: 'SELECT * FROM users',
      script: null,
      pod_name: 'db-pod'
    };

    it('should not send when disabled', async () => {
      slackService = createService(false);
      
      await slackService.notifyNewSubmission(mockRequestData);
      
      expect(slackService.isEnabled()).toBe(false);
    });

    it('should return early when disabled', async () => {
      slackService = createService(false);
      
      // Should not throw and should return early
      await expect(slackService.notifyNewSubmission(mockRequestData)).resolves.not.toThrow();
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should send notification when enabled with query', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      
      // Should not throw
      await expect(slackService.notifyNewSubmission(mockRequestData)).resolves.not.toThrow();
    });

    it('should send notification when enabled with script', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      
      const scriptData = { ...mockRequestData, query: null, script: 'console.log("test")' };
      
      // Should not throw
      await expect(slackService.notifyNewSubmission(scriptData)).resolves.not.toThrow();
    });

    it('should handle missing requester name', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      
      const dataWithoutName = { ...mockRequestData, requester_name: null };
      
      // Should not throw
      await expect(slackService.notifyNewSubmission(dataWithoutName)).resolves.not.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.chat.postMessage.mockRejectedValue(new Error('API Error'));
      
      // Should not throw
      await expect(slackService.notifyNewSubmission(mockRequestData)).resolves.not.toThrow();
    });
  });

  describe('notifyApprovalSuccess', () => {
    const mockRequestData = {
      req_id: 123,
      requester_name: 'John Doe',
      requester_email: 'john@test.com',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      query: 'SELECT * FROM users',
      script: null
    };

    const mockExecutionResult = {
      output: JSON.stringify({ console_output: 'Success', result_data: [{ id: 1 }] }),
      executionTime: 50
    };

    it('should not send when disabled', async () => {
      slackService = createService(false);
      
      await slackService.notifyApprovalSuccess(mockRequestData, mockExecutionResult);
      
      expect(slackService.isEnabled()).toBe(false);
    });

    it('should return early when disabled', async () => {
      slackService = createService(false);
      
      await expect(slackService.notifyApprovalSuccess(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should send notification to channel when enabled', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      // Should not throw
      await expect(slackService.notifyApprovalSuccess(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
    });

    it('should send notification without admin DM when admin not found', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue(null);
      
      // Should not throw
      await expect(slackService.notifyApprovalSuccess(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
    });

    it('should handle script execution results', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      const scriptData = { ...mockRequestData, query: null, script: 'console.log("test")' };
      const scriptResult = { output: 'Script completed', executionTime: 100 };
      
      // Should not throw
      await expect(slackService.notifyApprovalSuccess(scriptData, scriptResult)).resolves.not.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.chat.postMessage.mockRejectedValue(new Error('API Error'));
      
      await expect(slackService.notifyApprovalSuccess(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
    });
  });

  describe('notifyApprovalFailure', () => {
    const mockRequestData = {
      req_id: 123,
      requester_name: 'John Doe',
      requester_email: 'john@test.com',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      query: 'SELECT * FROM users',
      script: null
    };

    const mockExecutionResult = { error: 'Connection timeout' };

    it('should not send when disabled', async () => {
      slackService = createService(false);
      
      await slackService.notifyApprovalFailure(mockRequestData, mockExecutionResult);
      
      expect(slackService.isEnabled()).toBe(false);
    });

    it('should return early when disabled', async () => {
      slackService = createService(false);
      
      await expect(slackService.notifyApprovalFailure(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should send notification to channel when enabled', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      // Should not throw
      await expect(slackService.notifyApprovalFailure(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
    });

    it('should send notification without admin DM when admin not found', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue(null);
      
      // Should not throw
      await expect(slackService.notifyApprovalFailure(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
    });

    it('should handle missing error message', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      const resultWithoutError = {};
      
      // Should not throw
      await expect(slackService.notifyApprovalFailure(mockRequestData, resultWithoutError)).resolves.not.toThrow();
    });

    it('should handle script failure', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      const scriptData = { ...mockRequestData, query: null, script: 'console.log("test")' };
      
      // Should not throw
      await expect(slackService.notifyApprovalFailure(scriptData, mockExecutionResult)).resolves.not.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      mockClient.chat.postMessage.mockRejectedValue(new Error('API Error'));
      
      await expect(slackService.notifyApprovalFailure(mockRequestData, mockExecutionResult)).resolves.not.toThrow();
    });
  });

  describe('notifyRejection', () => {
    const mockRequestData = {
      req_id: 123,
      requester_name: 'John Doe',
      requester_email: 'john@test.com',
      database_type: 'POSTGRES',
      database_name: 'test_db',
      instance_name: 'local-postgres',
      query: 'DROP TABLE users',
      script: null,
      pod_name: 'db-pod'
    };

    const rejectionReason = 'Dangerous operation not allowed';

    it('should not send when disabled', async () => {
      slackService = createService(false);
      
      await slackService.notifyRejection(mockRequestData, rejectionReason);
      
      expect(slackService.isEnabled()).toBe(false);
    });

    it('should return early when disabled', async () => {
      slackService = createService(false);
      
      await expect(slackService.notifyRejection(mockRequestData, rejectionReason)).resolves.not.toThrow();
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should not send when admin not found', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue(null);
      
      await slackService.notifyRejection(mockRequestData, rejectionReason);
      
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should send DM to admin when enabled and admin found', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      // Should not throw
      await expect(slackService.notifyRejection(mockRequestData, rejectionReason)).resolves.not.toThrow();
    });

    it('should handle script rejection', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      const scriptData = { ...mockRequestData, query: null, script: 'dangerous.script()' };
      
      // Should not throw
      await expect(slackService.notifyRejection(scriptData, rejectionReason)).resolves.not.toThrow();
    });

    it('should handle missing requester name', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      
      const dataWithoutName = { ...mockRequestData, requester_name: null };
      
      // Should not throw
      await expect(slackService.notifyRejection(dataWithoutName, rejectionReason)).resolves.not.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      slackService = createService(true);
      slackService.client = mockClient;
      slackService.getUserIdByEmail = jest.fn().mockResolvedValue('U12345');
      mockClient.chat.postMessage.mockRejectedValue(new Error('API Error'));
      
      await expect(slackService.notifyRejection(mockRequestData, rejectionReason)).resolves.not.toThrow();
    });
  });
});
