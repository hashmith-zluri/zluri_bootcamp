const express = require('express');
const router = express.Router();
const slackService = require('../services/slack.service');
const auth = require('../middlewares/auth.middleware');

router.get('/test', auth, async (req, res) => {
  try {
    const result = await slackService.testConnection();
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Slack test failed: ${error.message}`
    });
  }
});


router.get('/status', auth, (req, res) => {
  return res.json({
    success: true,
    enabled: slackService.isEnabled(),
    channel: process.env.SLACK_APPROVAL_CHANNEL || 'Not configured'
  });
});

module.exports = router;
