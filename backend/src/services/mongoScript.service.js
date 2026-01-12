const fs = require('fs').promises;
const path = require('path');
const { query } = require('../config/db');

class MongoScriptExecutionService {
  async executeMongoScript(requestId) {
    let executionResult = null;
    
    try {
      const requestResult = await query(
        `SELECT qr.*, di.name as instance_name, di.host, di.port, di.engine
         FROM query_requests qr 
         JOIN db_instances di ON qr.db_instance_id = di.id 
         WHERE qr.id = $1`,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      const request = requestResult.rows[0];

      // Validate request status
      if (request.status !== 'APPROVED') {
        throw new Error(`Request ${requestId} is not approved. Current status: ${request.status}`);
      }

      // Validate database engine
      if (request.engine !== 'MONGO') {
        throw new Error(`Expected MongoDB instance, got: ${request.engine}`);
      }

      // Validate script exists
      if (!request.script_path) {
        throw new Error('No script content found in request');
      }

      console.log(`Executing MongoDB script for request ${requestId}:`);
      console.log(`Instance: ${request.instance_name}`);
      console.log(`Database: ${request.database_name}`);
      console.log(`Script length: ${request.script_path.length} characters`);

      // Update status to EXECUTING
      await this.updateRequestStatus(requestId, 'EXECUTING');

      // Validate script content
      this.validateScriptContent(request.script_path);

      // Execute the script
      executionResult = await this.executeScript(
        request,
        request.database_name,
        request.script_path
      );

      // Determine final status
      const finalStatus = executionResult.success ? 'EXECUTED' : 'FAILED';
      
      // Update request status
      await this.updateRequestStatus(requestId, finalStatus);

      // Log execution result
      await this.logExecution(requestId, executionResult);

      return {
        requestId,
        success: executionResult.success,
        status: finalStatus,
        executionTime: executionResult.executionTime,
        output: this.formatScriptOutput(executionResult),
        error: executionResult.error || null
      };

    } catch (error) {
      console.error(`MongoDB script execution failed for request ${requestId}:`, error.message);
      
      // Update status to FAILED
      await this.updateRequestStatus(requestId, 'FAILED');
      
      // Log the failure
      await this.logExecution(requestId, {
        success: false,
        error: error.message,
        executionTime: 0
      });

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


  validateScriptContent(scriptContent) {
    const content = scriptContent.trim();
    
    if (!content) {
      throw new Error('Script content is empty');
    }

    // Check for console.log() to capture results
    if (!content.includes('console.log(')) {
      throw new Error('Script must include "console.log()" to capture execution results');
    }

    return true;
  }

  async executeScript(instance, databaseName, scriptContent) {
    const startTime = Date.now();
    
    try {
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


  /* istanbul ignore next */
  async executeJSScript(instance, databaseName, scriptContent, startTime) {
    return new Promise((resolve) => {
      const { Worker } = require('worker_threads');
      
      // Build MongoDB connection string (no auth since db_instances doesn't store credentials)
      const connectionString = `mongodb://${instance.host || 'localhost'}:${instance.port || 27017}/${databaseName}`;
      
      // Create worker script content
      const workerScript = `
        const { parentPort, workerData } = require('worker_threads');
        const { MongoClient, ObjectId } = require('mongodb');
        
        async function executeScript() {
          let client = null;
          let userOutput = '';
          let operationDetails = [];
          let operationCount = 0;
          
          try {
            // Set up console capture - only captures user's console.log
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
            
            // Create MongoDB client
            client = new MongoClient(workerData.connectionString, {
              maxPoolSize: 5,
              serverSelectionTimeoutMS: 10000,
              socketTimeoutMS: 30000
            });
            
            await client.connect();
            
            // Get database reference
            const db = client.db(workerData.databaseName);
            
            // Set up global db object for script access
            global.db = db;
            global.client = client;
            global.collection = (name) => db.collection(name);
            
            // Set up safe globals
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
            global.ObjectId = ObjectId;
            
            // Execute user script
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const userFunction = new AsyncFunction(workerData.scriptContent);
            await userFunction();
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Send structured result
            parentPort.postMessage({
              success: true,
              output: userOutput.trim(),
              metadata: {
                database: workerData.databaseName,
                host: workerData.host,
                port: workerData.port,
                executed_at: new Date().toISOString()
              }
            });
            
          } catch (error) {
            parentPort.postMessage({
              success: false,
              error: error.message,
              output: userOutput.trim(),
              metadata: {
                database: workerData.databaseName,
                host: workerData.host,
                port: workerData.port,
                executed_at: new Date().toISOString()
              }
            });
          } finally {
            if (client) {
              try { await client.close(); } catch (e) {}
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
      
      // Write worker script to temp file (outside src to avoid nodemon restart)
      const tempWorkerFile = path.join(__dirname, '..', '..', 'temp', `mongo_worker_${Date.now()}.js`);
      
      fs.mkdir(path.dirname(tempWorkerFile), { recursive: true })
        .then(() => fs.writeFile(tempWorkerFile, workerScript))
        .then(() => {
          const worker = new Worker(tempWorkerFile, {
            workerData: {
              connectionString,
              databaseName,
              host: instance.host || 'localhost',
              port: instance.port || 27017,
              scriptContent
            }
          });
          
          // 5 minute timeout
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
            fs.unlink(tempWorkerFile).catch(/* istanbul ignore next */ () => {});
            resolve({ ...result, executionTime: Date.now() - startTime });
          });
          
          worker.on('error', (error) => {
            clearTimeout(timeout);
            fs.unlink(tempWorkerFile).catch(/* istanbul ignore next */ () => {});
            resolve({
              success: false,
              error: `Worker error: ${error.message}`,
              executionTime: Date.now() - startTime,
              output: `Worker thread error: ${error.message}`
            });
          });
          
          worker.on('exit', (code) => {
            clearTimeout(timeout);
            if (code !== 0) {
              fs.unlink(tempWorkerFile).catch(/* istanbul ignore next */ () => {});
              resolve({
                success: false,
                error: `Worker stopped with exit code ${code}`,
                executionTime: Date.now() - startTime,
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
      await query(
        'UPDATE query_requests SET status = $1 WHERE id = $2',
        [status, requestId]
      );
      console.log(`Updated request ${requestId} status to ${status}`);
    } catch (error) {
      console.error(`Failed to update request ${requestId} status:`, error.message);
      throw error;
    }
  }

  async logExecution(requestId, executionResult) {
    try {
      const logResult = await query(
        `INSERT INTO execution_logs 
         (request_id, success, output, error, execution_time_ms) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        [
          requestId,
          executionResult.success,
          this.formatScriptOutput(executionResult),
          executionResult.error || null,
          executionResult.executionTime || 0
        ]
      );
      
      console.log(`Logged MongoDB script execution for request ${requestId}, log ID: ${logResult.rows[0].id}`);
    } catch (error) {
      console.error(`Failed to log script execution for request ${requestId}:`, error.message);
    }
  }

  formatScriptOutput(executionResult) {
    if (!executionResult.success) {
      return null;
    }

    // Return structured output as JSON
    const result = {
      console_output: executionResult.output || null,
      metadata: executionResult.metadata || null
    };

    return JSON.stringify(result, null, 2);
  }

  async getScriptExecutionResult(requestId) {
    try {
      const result = await query(
        `SELECT el.*, qr.status, qr.script_path 
         FROM execution_logs el 
         JOIN query_requests qr ON el.request_id = qr.id 
         WHERE el.request_id = $1 AND qr.script_path IS NOT NULL
         ORDER BY el.executed_at DESC 
         LIMIT 1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        return {
          status: 'pending',
          message: 'Script not yet executed'
        };
      }

      const log = result.rows[0];
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

module.exports = new MongoScriptExecutionService();
