const fs = require('fs').promises;
const path = require('path');
const QueryRequestRepository = require('../repositories/queryRequest.repository');
const ExecutionLogRepository = require('../repositories/executionLog.repository');
const DbInstanceRepository = require('../repositories/dbInstance.repository');
const slackService = require('./slack.service');

class PostgresScriptExecutionService {
  async executePostgresScript(requestId) {
    let executionResult = null;
    
    try {
      const request = await QueryRequestRepository.findWithInstance(requestId);

      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }
      
      if (request.status !== 'APPROVED') {
        throw new Error(`Request ${requestId} is not approved. Current status: ${request.status}`);
      }

      if (request.engine !== 'POSTGRES') {
        throw new Error(`Unsupported database engine: ${request.engine}`);
      }

      if (!request.script_path) {
        throw new Error('No script content found in request');
      }

      console.log(`Executing PostgreSQL script for request ${requestId}:`);
      console.log(`Instance: ${request.instance_name}`);
      console.log(`Database: ${request.database_name}`);
      console.log(`Script length: ${request.script_path.length} characters`);

      await this.updateRequestStatus(requestId, 'EXECUTING');

      this.validateScriptContent(request.script_path);

      executionResult = await this.executeScript(
        request.db_instance_id,
        request.database_name,
        request.script_path
      );

      const finalStatus = executionResult.success ? 'EXECUTED' : 'FAILED';
      
      await this.updateRequestStatus(requestId, finalStatus);
      await this.logExecution(requestId, executionResult);
      await this.sendExecutionNotification(requestId, executionResult);

      return {
        requestId,
        success: executionResult.success,
        status: finalStatus,
        executionTime: executionResult.executionTime,
        output: this.formatScriptOutput(executionResult),
        error: executionResult.error || null
      };

    } catch (error) {
      console.error(`PostgreSQL script execution failed for request ${requestId}:`, error.message);
      
      await this.updateRequestStatus(requestId, 'FAILED');
      
      const failureResult = {
        success: false,
        error: error.message,
        executionTime: 0
      };
      await this.logExecution(requestId, failureResult);
      await this.sendExecutionNotification(requestId, failureResult);

      return {
        requestId,
        success: false,
        status: 'FAILED',
        executionTime: 0,
        output: null,
        error: error.message
      };
    }
  }

  async sendExecutionNotification(requestId, executionResult) {
    if (!slackService.isEnabled()) return;

    try {
      const requestData = await QueryRequestRepository.findForNotification(requestId);

      if (!requestData) {
        console.warn(`Could not find request ${requestId} for Slack notification`);
        return;
      }

      const slackRequestData = {
        req_id: requestData.id,
        requester_name: requestData.requester_name,
        requester_email: requestData.requester_email,
        database_type: requestData.database_type,
        database_name: requestData.database_name,
        instance_name: requestData.instance_name,
        query: requestData.query_text,
        script: requestData.script_path
      };

      if (executionResult.success) {
        await slackService.notifyApprovalSuccess(slackRequestData, executionResult);
      } else {
        await slackService.notifyApprovalFailure(slackRequestData, executionResult);
      }
    } catch (error) {
      console.error(`Failed to send Slack notification for request ${requestId}:`, error.message);
    }
  }

  validateScriptContent(scriptContent) {
    const content = scriptContent.trim();
    
    if (!content) {
      throw new Error('Script content is empty');
    }

    if (!content.includes('console.log(')) {
      throw new Error('Script must include "console.log()" to capture execution results');
    }

    return true;
  }

  async executeScript(instanceId, databaseName, scriptContent) {
    const startTime = Date.now();
    
    try {
      const instance = await DbInstanceRepository.findById(instanceId);
      
      return await this.executeJSScript(instance, databaseName, scriptContent, startTime);
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        output: null
      };
    }
  }

  async executeJSScript(instance, databaseName, scriptContent, startTime) {
    return new Promise((resolve) => {
      const { Worker } = require('worker_threads');
      
      const workerScript = `
        const { parentPort, workerData } = require('worker_threads');
        const { Client } = require('pg');
        
        async function executeScript() {
          let client = null;
          let userOutput = '';
          let queryDetails = [];
          let queryCount = 0;
          
          try {
            console.log = (...args) => {
              const logMessage = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              userOutput += logMessage + '\\n';
            };
            
            console.error = (...args) => {
              const logMessage = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              userOutput += '[ERROR] ' + logMessage + '\\n';
            };
            
            client = new Client(workerData.dbConfig);
            await client.connect();
            
            global.query = async (sql, params = []) => {
              try {
                queryCount++;
                const queryStart = Date.now();
                const result = await client.query(sql, params);
                const queryTime = Date.now() - queryStart;
                
                queryDetails.push({
                  query_number: queryCount,
                  sql: sql.trim(),
                  params: params.length > 0 ? params : undefined,
                  execution_time_ms: queryTime,
                  rows_returned: result.rows.length
                });
                
                return result;
                
              } catch (error) {
                queryDetails.push({
                  query_number: queryCount,
                  sql: sql.trim(),
                  params: params.length > 0 ? params : undefined,
                  error: error.message
                });
                
                // Mark that we had a database error - this should fail the execution
                global.__hasDbError = true;
                global.__dbErrorMessage = error.message;
                
                throw error;
              }
            };
            
            global.process = { env: workerData.env };
            global.JSON = JSON;
            global.Date = Date;
            global.Math = Math;
            global.parseInt = parseInt;
            global.parseFloat = parseFloat;
            global.isNaN = isNaN;
            global.isFinite = isFinite;
            global.Promise = Promise;
            global.setTimeout = setTimeout;
            global.clearTimeout = clearTimeout;
            
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const userFunction = new AsyncFunction(workerData.scriptContent);
            await userFunction();
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if any database errors occurred during execution
            if (global.__hasDbError) {
              parentPort.postMessage({
                success: false,
                error: global.__dbErrorMessage,
                output: userOutput.trim(),
                metadata: {
                  database: workerData.dbConfig.database,
                  host: workerData.dbConfig.host,
                  port: workerData.dbConfig.port,
                  queries_executed: queryCount,
                  executed_at: new Date().toISOString()
                },
                queries: queryDetails
              });
            } else {
              // Check if the output contains error messages indicating failure
              const outputLower = userOutput.toLowerCase();
              const hasErrorInOutput = outputLower.includes('failed to') || 
                                     outputLower.includes('error:') || 
                                     outputLower.includes('is not defined') ||
                                     outputLower.includes('cannot read') ||
                                     outputLower.includes('undefined');
              
              if (hasErrorInOutput) {
                // Extract error message from output
                const lines = userOutput.split('\\n');
                const errorLine = lines.find(line => 
                  line.toLowerCase().includes('failed to') || 
                  line.toLowerCase().includes('is not defined') ||
                  line.toLowerCase().includes('cannot read') ||
                  line.toLowerCase().includes('undefined')
                );
                
                parentPort.postMessage({
                  success: false,
                  error: errorLine || 'Script execution failed',
                  output: userOutput.trim(),
                  metadata: {
                    database: workerData.dbConfig.database,
                    host: workerData.dbConfig.host,
                    port: workerData.dbConfig.port,
                    queries_executed: queryCount,
                    executed_at: new Date().toISOString()
                  },
                  queries: queryDetails
                });
              } else {
                parentPort.postMessage({
                  success: true,
                  output: userOutput.trim(),
                  metadata: {
                    database: workerData.dbConfig.database,
                    host: workerData.dbConfig.host,
                    port: workerData.dbConfig.port,
                    queries_executed: queryCount,
                    executed_at: new Date().toISOString()
                  },
                  queries: queryDetails
                });
              }
            }
            
          } catch (error) {
            parentPort.postMessage({
              success: false,
              error: error.message,
              output: userOutput.trim(),
              metadata: {
                database: workerData.dbConfig.database,
                host: workerData.dbConfig.host,
                port: workerData.dbConfig.port,
                queries_executed: queryCount,
                executed_at: new Date().toISOString()
              },
              queries: queryDetails
            });
          } finally {
            if (client) {
              try { await client.end(); } catch (e) {}
            }
          }
        }
        
        process.on('uncaughtException', (error) => {
          parentPort.postMessage({
            success: false,
            error: 'Uncaught exception: ' + error.message,
            output: ''
          });
        });
        
        process.on('unhandledRejection', (reason) => {
          parentPort.postMessage({
            success: false,
            error: 'Unhandled rejection: ' + (reason?.message || reason),
            output: ''
          });
        });
        
        executeScript().catch(error => {
          parentPort.postMessage({
            success: false,
            error: 'Script execution failed: ' + error.message,
            output: ''
          });
        });
      `;
      
      const tempWorkerFile = path.join(__dirname, '..', '..', 'temp', `worker_${Date.now()}.js`);
      
      fs.mkdir(path.dirname(tempWorkerFile), { recursive: true })
        .then(() => fs.writeFile(tempWorkerFile, workerScript))
        .then(() => {
          const worker = new Worker(tempWorkerFile, {
            workerData: {
              dbConfig: {
                host: instance.host,
                port: instance.port,
                database: databaseName,
                user: instance.username || process.env.DB_USER,
                password: instance.password || process.env.DB_PASSWORD,
                connectionTimeoutMillis: 30000,
                query_timeout: 30000,
                // Add SSL configuration for Neon databases
                ...(instance.host && instance.host.includes('.neon.tech') ? {
                  ssl: { rejectUnauthorized: false }
                } : {})
              },
              env: {
                DB_CONFIG_FILE: JSON.stringify({
                  host: instance.host,
                  port: instance.port,
                  database: databaseName,
                  user: instance.username || process.env.DB_USER,
                  password: instance.password || process.env.DB_PASSWORD
                }),
                MONGODB_URI: `mongodb://${instance.host}:${instance.port || 27017}/${databaseName}`,
                MONGODB_DATABASE: databaseName
              },
              scriptContent: scriptContent
            }
          });
          
          const timeout = setTimeout(() => {
            worker.terminate();
            resolve({
              success: false,
              error: 'Script execution timeout (5 minutes)',
              executionTime: Date.now() - startTime,
              output: 'Script execution timed out after 5 minutes'
            });
          }, 300000);
          
          worker.on('message', (result) => {
            clearTimeout(timeout);
            const executionTime = Date.now() - startTime;
            
            fs.unlink(tempWorkerFile).catch(err => {
              if (err.code !== 'ENOENT') {
                console.error('Failed to cleanup temp worker file:', err);
              }
            });
            
            resolve({ ...result, executionTime });
          });
          
          worker.on('error', (error) => {
            clearTimeout(timeout);
            const executionTime = Date.now() - startTime;
            
            fs.unlink(tempWorkerFile).catch(err => {
              if (err.code !== 'ENOENT') {
                console.error('Failed to cleanup temp worker file:', err);
              }
            });
            
            resolve({
              success: false,
              error: `Worker error: ${error.message}`,
              executionTime,
              output: `Worker thread error: ${error.message}`
            });
          });
          
          worker.on('exit', (code) => {
            clearTimeout(timeout);
            
            if (code !== 0) {
              const executionTime = Date.now() - startTime;
              
              fs.unlink(tempWorkerFile).catch(err => {
                if (err.code !== 'ENOENT') {
                  console.error('Failed to cleanup temp worker file:', err);
                }
              });
              
              resolve({
                success: false,
                error: `Worker stopped with exit code ${code}`,
                executionTime,
                output: `Worker process exited with code ${code}`
              });
            }
          });
        })
        .catch((error) => {
          resolve({
            success: false,
            error: `Failed to create worker: ${error.message}`,
            executionTime: Date.now() - startTime,
            output: `Failed to create worker thread: ${error.message}`
          });
        });
    });
  }

  async updateRequestStatus(requestId, status) {
    try {
      await QueryRequestRepository.updateStatus(requestId, status);
      console.log(`Updated request ${requestId} status to ${status}`);
    } catch (error) {
      console.error(`Failed to update request ${requestId} status:`, error.message);
      throw error;
    }
  }

  async logExecution(requestId, executionResult) {
    try {
      const logResult = await ExecutionLogRepository.create({
        requestId,
        success: executionResult.success,
        output: this.formatScriptOutput(executionResult),
        error: executionResult.error || null,
        executionTimeMs: executionResult.executionTime || 0
      });
      console.log(`Logged script execution result for request ${requestId}, log ID: ${logResult.id}`);
    } catch (error) {
      console.error(`Failed to log script execution for request ${requestId}:`, error.message);
    }
  }

  formatScriptOutput(executionResult) {
    if (!executionResult.success) {
      return null;
    }

    const result = {
      console_output: executionResult.output || null
    };

    return JSON.stringify(result, null, 2);
  }

  async getScriptExecutionResult(requestId) {
    try {
      const log = await ExecutionLogRepository.findLatestScriptExecution(requestId);

      if (!log) {
        return {
          status: 'pending',
          message: 'Script not yet executed'
        };
      }

      return {
        status: log.success ? 'success' : 'failure',
        output: log.output,
        error: log.error,
        executionTime: log.execution_time_ms,
        executedAt: log.executed_at,
        scriptPath: log.script_path
      };
    } catch (error) {
      console.error(`Failed to get script execution result for request ${requestId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new PostgresScriptExecutionService();
