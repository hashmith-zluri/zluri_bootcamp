const fs = require('fs').promises;
const path = require('path');
const QueryRequestRepository = require('../repositories/queryRequest.repository');
const ExecutionLogRepository = require('../repositories/executionLog.repository');
const slackService = require('./slack.service');

class MongoScriptExecutionService {
  async executeMongoScript(requestId) {
    let executionResult = null;
    
    try {
      const request = await QueryRequestRepository.findWithInstance(requestId);

      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      if (request.status !== 'APPROVED') {
        throw new Error(`Request ${requestId} is not approved. Current status: ${request.status}`);
      }

      if (request.engine !== 'MONGO') {
        throw new Error(`Expected MongoDB instance, got: ${request.engine}`);
      }

      if (!request.script_path) {
        throw new Error('No script content found in request');
      }

      console.log(`Executing MongoDB script for request ${requestId}:`);
      console.log(`Instance: ${request.instance_name}`);
      console.log(`Database: ${request.database_name}`);
      console.log(`Script length: ${request.script_path.length} characters`);

      await this.updateRequestStatus(requestId, 'EXECUTING');

      this.validateScriptContent(request.script_path);

      executionResult = await this.executeScript(
        request,
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
      console.error(`MongoDB script execution failed for request ${requestId}:`, error.message);
      
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
      
      // Create proper connection string for Atlas or local MongoDB
      let connectionString;
      
      if (instance.host && instance.host.includes('mongodb.net')) {
        // Atlas connection string format - encode password for URL safety
        const encodedPassword = encodeURIComponent(instance.password);
        connectionString = `mongodb+srv://${instance.username}:${encodedPassword}@${instance.host}/${databaseName}?retryWrites=true&w=majority&appName=mongo-1`;
      } else {
        // Local MongoDB connection string format
        connectionString = `mongodb://${instance.host || 'localhost'}:${instance.port || 27017}/${databaseName}`;
      }
      
      console.log(`MongoDB connection string created for: ${instance.host}`);
      
      const workerScript = `
        const { parentPort, workerData } = require('worker_threads');
        const { MongoClient, ObjectId } = require('mongodb');
        
        async function executeScript() {
          let client = null;
          let userOutput = '';
          
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
            
            // Create MongoDB client with appropriate options for Atlas or local
            const clientOptions = {
              maxPoolSize: 5,
              serverSelectionTimeoutMS: 10000,
              socketTimeoutMS: 30000
            };
            
            // Enhanced TLS options for Atlas connections in production
            if (workerData.connectionString.includes('mongodb+srv://')) {
              clientOptions.tls = true;
              clientOptions.tlsAllowInvalidCertificates = true;
              clientOptions.tlsAllowInvalidHostnames = true;
              // Additional SSL options for Railway/production environments
              clientOptions.ssl = true;
              clientOptions.sslValidate = false;
              // Use stable API version for Atlas
              clientOptions.serverApi = {
                version: '1',
                strict: false,
                deprecationErrors: false
              };
            }
            
            client = new MongoClient(workerData.connectionString, clientOptions);
            
            await client.connect();
            
            const db = client.db(workerData.databaseName);
            
            // Wrap database operations to detect errors
            const originalCollection = db.collection.bind(db);
            db.collection = (name) => {
              const collection = originalCollection(name);
              
              // Wrap collection methods to detect errors
              const wrapMethod = (methodName) => {
                const originalMethod = collection[methodName].bind(collection);
                return (...args) => {
                  try {
                    const result = originalMethod(...args);
                    
                    // If this is a find operation, wrap the cursor methods too
                    if (methodName === 'find' && result && typeof result.toArray === 'function') {
                      const originalToArray = result.toArray.bind(result);
                      const originalForEach = result.forEach ? result.forEach.bind(result) : null;
                      const originalMap = result.map ? result.map.bind(result) : null;
                      const originalLimit = result.limit ? result.limit.bind(result) : null;
                      const originalSkip = result.skip ? result.skip.bind(result) : null;
                      const originalSort = result.sort ? result.sort.bind(result) : null;
                      
                      result.toArray = async () => {
                        try {
                          return await originalToArray();
                        } catch (error) {
                          global.__hasDbError = true;
                          global.__dbErrorMessage = error.message;
                          throw error;
                        }
                      };
                      
                      if (originalForEach) {
                        result.forEach = async (callback) => {
                          try {
                            return await originalForEach(callback);
                          } catch (error) {
                            global.__hasDbError = true;
                            global.__dbErrorMessage = error.message;
                            throw error;
                          }
                        };
                      }
                      
                      if (originalMap) {
                        result.map = (callback) => {
                          try {
                            const mappedCursor = originalMap(callback);
                            // Recursively wrap the mapped cursor
                            if (mappedCursor && typeof mappedCursor.toArray === 'function') {
                              const origToArray = mappedCursor.toArray.bind(mappedCursor);
                              mappedCursor.toArray = async () => {
                                try {
                                  return await origToArray();
                                } catch (error) {
                                  global.__hasDbError = true;
                                  global.__dbErrorMessage = error.message;
                                  throw error;
                                }
                              };
                            }
                            return mappedCursor;
                          } catch (error) {
                            global.__hasDbError = true;
                            global.__dbErrorMessage = error.message;
                            throw error;
                          }
                        };
                      }
                      
                      // Wrap chaining methods that return cursors
                      if (originalLimit) {
                        result.limit = (num) => {
                          const limitedCursor = originalLimit(num);
                          return wrapCursor(limitedCursor);
                        };
                      }
                      
                      if (originalSkip) {
                        result.skip = (num) => {
                          const skippedCursor = originalSkip(num);
                          return wrapCursor(skippedCursor);
                        };
                      }
                      
                      if (originalSort) {
                        result.sort = (sortSpec) => {
                          const sortedCursor = originalSort(sortSpec);
                          return wrapCursor(sortedCursor);
                        };
                      }
                    }
                    
                    return result;
                  } catch (error) {
                    global.__hasDbError = true;
                    global.__dbErrorMessage = error.message;
                    throw error;
                  }
                };
              };
              
              // Helper function to wrap cursor methods
              const wrapCursor = (cursor) => {
                if (!cursor || typeof cursor.toArray !== 'function') return cursor;
                
                const originalToArray = cursor.toArray.bind(cursor);
                cursor.toArray = async () => {
                  try {
                    return await originalToArray();
                  } catch (error) {
                    global.__hasDbError = true;
                    global.__dbErrorMessage = error.message;
                    throw error;
                  }
                };
                
                return cursor;
              };
              
              // Wrap common MongoDB operations
              ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'updateMany', 
               'deleteOne', 'deleteMany', 'aggregate', 'countDocuments', 'distinct'].forEach(method => {
                if (typeof collection[method] === 'function') {
                  collection[method] = wrapMethod(method);
                }
              });
              
              return collection;
            };
            
            global.db = db;
            global.client = client;
            global.collection = (name) => db.collection(name);
            
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
                  database: workerData.databaseName,
                  host: workerData.host,
                  port: workerData.port,
                  executed_at: new Date().toISOString()
                }
              });
            } else {
              // Check if the output contains error messages indicating failure
              const outputLower = userOutput.toLowerCase();
              const hasErrorInOutput = outputLower.includes('failed to') || 
                                     outputLower.includes('error:') || 
                                     outputLower.includes('is not defined') ||
                                     outputLower.includes('cannot read') ||
                                     outputLower.includes('undefined') ||
                                     outputLower.includes('query is not defined');
              
              if (hasErrorInOutput) {
                // Extract error message from output
                const lines = userOutput.split('\\n');
                const errorLine = lines.find(line => 
                  line.toLowerCase().includes('failed to') || 
                  line.toLowerCase().includes('is not defined') ||
                  line.toLowerCase().includes('cannot read') ||
                  line.toLowerCase().includes('undefined') ||
                  line.toLowerCase().includes('query is not defined')
                );
                
                parentPort.postMessage({
                  success: false,
                  error: errorLine || 'Script execution failed',
                  output: userOutput.trim(),
                  metadata: {
                    database: workerData.databaseName,
                    host: workerData.host,
                    port: workerData.port,
                    executed_at: new Date().toISOString()
                  }
                });
              } else {
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
              }
            }
            
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
            fs.unlink(tempWorkerFile).catch(() => {});
            resolve({ ...result, executionTime: Date.now() - startTime });
          });
          
          worker.on('error', (error) => {
            clearTimeout(timeout);
            fs.unlink(tempWorkerFile).catch(() => {});
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
              fs.unlink(tempWorkerFile).catch(() => {});
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
      console.log(`Logged MongoDB script execution for request ${requestId}, log ID: ${logResult.id}`);
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

module.exports = new MongoScriptExecutionService();
