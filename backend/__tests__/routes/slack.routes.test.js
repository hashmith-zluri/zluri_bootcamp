const request = require('supertest');
const express = require('express');
const slackRoutes = require('../../src/routes/slack.routes');
const slackService = require('../../src/services/slack.service');
const auth = require('../../src/middlewares/auth.middleware');

jest.mock('../../src/services/slack.service');
jest.mock('../../src/middlewares/auth.middleware');

describe('Slack Routes', () => {
  let app;

  beforeAll(() => {
    // Mock auth middleware to pass through
    auth.mockImplementation((req, res, next) => next());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/slack', slackRoutes);
  });

  describe('GET /slack/test', () => {
    it('should return 200 on successful connection test', async () => {
      slackService.testConnection.mockResolvedValue({
        success: true,
        message: 'Slack connection successful',
        botName: 'test-bot',
        teamName: 'Test Team'
      });

      const response = await request(app).get('/slack/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Slack connection successful');
    });

    it('should return 500 on failed connection test', async () => {
      slackService.testConnection.mockResolvedValue({
        success: false,
        message: 'Slack connection failed: Invalid token'
      });

      const response = await request(app).get('/slack/test');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on exception', async () => {
      slackService.testConnection.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app).get('/slack/test');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Slack test failed');
    });
  });

  describe('GET /slack/status', () => {
    it('should return enabled status when Slack is enabled', async () => {
      slackService.isEnabled.mockReturnValue(true);
      process.env.SLACK_APPROVAL_CHANNEL = 'test-channel';

      const response = await request(app).get('/slack/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(true);
      expect(response.body.channel).toBe('test-channel');
    });

    it('should return disabled status when Slack is disabled', async () => {
      slackService.isEnabled.mockReturnValue(false);
      delete process.env.SLACK_APPROVAL_CHANNEL;

      const response = await request(app).get('/slack/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(false);
      expect(response.body.channel).toBe('Not configured');
    });
  });
});
