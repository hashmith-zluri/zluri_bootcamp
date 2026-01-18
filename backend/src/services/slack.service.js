const { WebClient } = require('@slack/web-api');
const { Message, Blocks, Elements } = require('slack-block-builder');

class SlackService {
  constructor() {
    this.enabled = process.env.SLACK_ENABLED === 'true';
    this.approvalChannel = process.env.SLACK_APPROVAL_CHANNEL;
    this.adminEmail = process.env.SLACK_ADMIN_EMAIL || 'hashmith.b@zluri.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://zluri-bootcamp-fvcnlebh3-hashmiths-projects.vercel.app';
    
    if (this.enabled) {
      this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
      console.log('Slack integration enabled');
    } else {
      console.log('Slack integration disabled');
    }
  }

  /**
   * Check if Slack is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get user's Slack ID by email
   */
  async getUserIdByEmail(email) {
    if (!this.enabled) return null;
    
    try {
      const result = await this.client.users.lookupByEmail({ email });
      return result.user?.id || null;
    } catch (error) {
      console.error(`Failed to lookup Slack user by email ${email}:`, error.message);
      return null;
    }
  }

  /**
   * Truncate text to specified length
   */
  truncateText(text, maxLength = 500) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Format query/script preview
   */
  formatQueryPreview(query, script) {
    const content = query || script || 'N/A';
    return this.truncateText(content, 200);
  }

  /**
   * 1. New Submission Notification
   * Sent to: Common approval channel
   */
  async notifyNewSubmission(requestData) {
    if (!this.enabled) return;

    try {
      const { req_id, requester_name, requester_email, database_type, database_name, 
              instance_name, query, script, pod_name } = requestData;

      const queryPreview = this.formatQueryPreview(query, script);
      const requestType = query ? 'Query' : 'Script';
      const requesterDisplay = requester_name ? `${requester_name} (${requester_email})` : requester_email;

      const message = Message()
        .blocks(
          Blocks.Header({ text: '🆕 New Database Request Submitted' }),
          Blocks.Section({ text: `*Request ID:* #${req_id}` }),
          Blocks.Divider(),
          Blocks.Section()
            .fields(
              `*Requester:*\n${requesterDisplay}`,
              `*Database:*\n${database_type} - ${database_name}`,
              `*Instance:*\n${instance_name}`,
              `*POD:*\n${pod_name}`,
              `*Type:*\n${requestType}`,
              `*Status:*\n⏳ Pending Approval`
            ),
          Blocks.Section({ text: `*${requestType} Preview:*\n\`\`\`${queryPreview}\`\`\`` }),
          Blocks.Context().elements(
            `Submitted at ${new Date().toLocaleString()}`
          )
        )
        .buildToObject();

      await this.client.chat.postMessage({
        channel: this.approvalChannel,
        ...message
      });

      console.log(`Slack notification sent for new submission: Request #${req_id}`);
    } catch (error) {
      console.error('Failed to send Slack notification for new submission:', error.message);
    }
  }

  /**
   * Format execution output for display
   */
  formatExecutionOutput(output) {
    if (!output) return 'No output';
    
    try {
      // Try to parse as JSON (both script and query outputs are JSON formatted)
      const parsed = JSON.parse(output);
      
      // Check if it has both console_output and result_data (query format)
      if (parsed.console_output !== undefined && parsed.result_data !== undefined) {
        const resultData = parsed.result_data;
        if (Array.isArray(resultData) && resultData.length > 0) {
          const sampleSize = Math.min(3, resultData.length);
          const sample = resultData.slice(0, sampleSize);
          const showingText = resultData.length > sampleSize 
            ? `Showing ${sampleSize} of ${resultData.length} results` 
            : `${resultData.length} result${resultData.length > 1 ? 's' : ''}`;
          return `${parsed.console_output}\n\n${showingText}:\n${JSON.stringify(sample, null, 2)}`;
        }
        // If no results, still show the console output
        return parsed.console_output || 'Query executed successfully. No rows returned.';
      } else if (parsed.console_output) {
        // Script output format - just console output
        return parsed.console_output || 'Script executed successfully';
      }
      
      // If it's just a JSON object, stringify it nicely
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Not JSON, return as-is
      return output;
    }
  }

  /**
   * 2. Approval + Success Notification
   * Sent to: Common channel + Admin DM
   */
  async notifyApprovalSuccess(requestData, executionResult) {
    if (!this.enabled) return;

    try {
      const { req_id, requester_name, requester_email, database_type, database_name,
              query, script } = requestData;
      
      const requestType = query ? 'Query' : 'Script';
      const formattedOutput = this.formatExecutionOutput(executionResult.output);
      const outputPreview = this.truncateText(formattedOutput, 500);
      const requesterDisplay = requester_name ? `${requester_name} (${requester_email})` : requester_email;

      const message = Message()
        .blocks(
          Blocks.Header({ text: '✅ Request Approved & Executed Successfully' }),
          Blocks.Section({ text: `*Request ID:* #${req_id}` }),
          Blocks.Divider(),
          Blocks.Section()
            .fields(
              `*Requester:*\n${requesterDisplay}`,
              `*Database:*\n${database_type} - ${database_name}`,
              `*Type:*\n${requestType}`,
              `*Execution Time:*\n${executionResult.executionTime || 0}ms`
            ),
          Blocks.Section({ 
            text: `*Execution Results:*\n\`\`\`${outputPreview}\`\`\`` 
          }),
          Blocks.Section({
            text: `*🔗 Full Preview URL:*\n${this.frontendUrl}/my-submissions`
          }),
          Blocks.Context().elements(
            `✓ Executed successfully at ${new Date().toLocaleString()}`
          )
        )
        .buildToObject();

      // Send to approval channel
      await this.client.chat.postMessage({
        channel: this.approvalChannel,
        ...message
      });

      // Send DM to admin (not requester)
      const adminUserId = await this.getUserIdByEmail(this.adminEmail);
      if (adminUserId) {
        await this.client.chat.postMessage({
          channel: adminUserId,
          ...message
        });
        console.log(`Slack DM sent to admin (${this.adminEmail}) for successful execution: Request #${req_id}`);
      } else {
        console.warn(`Could not find Slack user for admin email: ${this.adminEmail}`);
      }

      console.log(`Slack notification sent for successful execution: Request #${req_id}`);
    } catch (error) {
      console.error('Failed to send Slack notification for approval success:', error.message);
    }
  }

  /**
   * 3. Approval + Failure Notification
   * Sent to: Common channel + Admin DM
   */
  /*Istanbul ignore next*/
  async notifyApprovalFailure(requestData, executionResult) {
    if (!this.enabled) return;

    try {
      const { req_id, requester_name, requester_email, database_type, database_name,
              query, script } = requestData;
      
      const requestType = query ? 'Query' : 'Script';
      const errorMessage = executionResult.error || 'Unknown error';
      const errorPreview = this.truncateText(errorMessage, 500);
      const requesterDisplay = requester_name ? `${requester_name} (${requester_email})` : requester_email;

      const message = Message()
        .blocks(
          Blocks.Header({ text: '❌ Request Execution Failed' }),
          Blocks.Section({ text: `*Request ID:* #${req_id}` }),
          Blocks.Divider(),
          Blocks.Section()
            .fields(
              `*Requester:*\n${requesterDisplay}`,
              `*Database:*\n${database_type} - ${database_name}`,
              `*Type:*\n${requestType}`,
              `*Status:*\n❌ Failed`
            ),
          Blocks.Section({ 
            text: `*Error Message:*\n\`\`\`${errorPreview}\`\`\`` 
          }),
          Blocks.Section({
            text: `*🔗 Full Preview URL:*\n${this.frontendUrl}/my-submissions`
          }),
          Blocks.Context().elements(
            `Failed at ${new Date().toLocaleString()}`
          )
        )
        .buildToObject();

      // Send to approval channel
      await this.client.chat.postMessage({
        channel: this.approvalChannel,
        ...message
      });

      // Send DM to admin (not requester)
      const adminUserId = await this.getUserIdByEmail(this.adminEmail);
      if (adminUserId) {
        await this.client.chat.postMessage({
          channel: adminUserId,
          ...message
        });
        console.log(`Slack DM sent to admin (${this.adminEmail}) for failed execution: Request #${req_id}`);
      } else {
        console.warn(`Could not find Slack user for admin email: ${this.adminEmail}`);
      }

      console.log(`Slack notification sent for failed execution: Request #${req_id}`);
    } catch (error) {
      console.error('Failed to send Slack notification for approval failure:', error.message);
    }
  }

  /**
   * 4. Rejection Notification
   * Sent to: Admin DM only (no channel)
   */
  async notifyRejection(requestData, rejectionReason) {
    if (!this.enabled) return;

    try {
      const { req_id, requester_name, requester_email, database_type, database_name,
              instance_name, query, script, pod_name } = requestData;
      
      const requestType = query ? 'Query' : 'Script';
      const queryPreview = this.formatQueryPreview(query, script);
      const requesterDisplay = requester_name ? `${requester_name} (${requester_email})` : requester_email;

      const message = Message()
        .blocks(
          Blocks.Header({ text: '🚫 Request Rejected' }),
          Blocks.Section({ text: `*Request ID:* #${req_id}` }),
          Blocks.Divider(),
          Blocks.Section()
            .fields(
              `*Requester:*\n${requesterDisplay}`,
              `*Database:*\n${database_type} - ${database_name}`,
              `*Instance:*\n${instance_name}`,
              `*POD:*\n${pod_name}`,
              `*Type:*\n${requestType}`
            ),
          Blocks.Section({ 
            text: `*${requestType} Details:*\n\`\`\`${queryPreview}\`\`\`` 
          }),
          Blocks.Section({ 
            text: `*Rejection Reason:*\n${rejectionReason}` 
          }),
          Blocks.Context().elements(
            `Rejected at ${new Date().toLocaleString()}`
          )
        )
        .buildToObject();

      // Send DM to admin only (not to channel, not to requester)
      const adminUserId = await this.getUserIdByEmail(this.adminEmail);
      if (adminUserId) {
        await this.client.chat.postMessage({
          channel: adminUserId,
          ...message
        });
        console.log(`Slack DM sent to admin (${this.adminEmail}) for rejection: Request #${req_id}`);
      } else {
        console.warn(`Could not find Slack user for admin email: ${this.adminEmail}`);
      }
    } catch (error) {
      console.error('Failed to send Slack notification for rejection:', error.message);
    }
  }

  /**
   * Test Slack connection
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, message: 'Slack integration is disabled' };
    }

    try {
      const result = await this.client.auth.test();
      return {
        success: true,
        message: 'Slack connection successful',
        botName: result.user,
        teamName: result.team
      };
    } catch (error) {
      return {
        success: false,
        message: `Slack connection failed: ${error.message}`
      };
    }
  }
}

module.exports = new SlackService();
