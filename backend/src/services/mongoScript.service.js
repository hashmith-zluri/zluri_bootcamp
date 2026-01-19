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

      // Functional validation chain - throws on first failure
      const validateMongoScript = (req, id) => {
        const validationError = [
          () => req ? null : `Request ${id} not found`,
          () => (req?.status === 'APPROVED') ? null : `Request ${id} is not approved. Current status: ${req?.status}`,
          () => (req?.engine === 'MONGO') ? null : `Expected MongoDB instance, got: ${req?.engine}`,
          () => req?.script_path ? null : 'No script content found in request'
        ].map(validator => validator()).find(error => error !== null);
        
        return validationError ? (() => { throw new Error(validationError); })() : req;
      };

      validateMongoScript(request, requestId);

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
    // Functional validation with early returns
    const validations = [
      (content) => content.trim() ? null : 'Script content is empty',
      (content) => content.includes('console.log(') ? null : 'Script must include "console.log()" to capture execution results'
    ];
    
    const content = scriptContent.trim();
    const error = validations.map(validator => validator(content)).find(result => result !== null);
    
    return error ? (() => { throw new Error(error); })() : true;
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
        
        // Utility functions for cleaner code
        const createLogger = () => {
          let userOutput = '';
          const logFormatter = (args) => args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          
          return {
            log: (...args) => { userOutput += logFormatter(args) + '\\n'; },
            error: (...args) => { userOutput += '[ERROR] ' + logFormatter(args) + '\\n'; },
            getOutput: () => userOutput.trim()
          };
        };
        
        const createClientOptions = (connectionString) => ({
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 30000,
          ...(connectionString.includes('mongodb+srv://') && {
            tls: true,
            tlsAllowInvalidCertificates: true,
            tlsAllowInvalidHostnames: true
          })
        });
        
        const createErrorHandler = () => ({
          setError: (message) => {
            global.__hasDbError = true;
            global.__dbErrorMessage = message;
          },
          hasError: () => global.__hasDbError,
          getMessage: () => global.__dbErrorMessage
        });
        
        const wrapAsyncMethod = (method, errorHandler) => async (...args) => {
          try {
            return await method(...args);
          } catch (error) {
            errorHandler.setError(error.message);
            throw error;
          }
        };
        
        const wrapCursorMethods = (cursor, errorHandler) => {
          if (!cursor || typeof cursor.toArray !== 'function') return cursor;
          
          const methodsToWrap = ['toArray', 'forEach'];
          methodsToWrap.forEach(methodName => {
            if (cursor[methodName]) {
              const original = cursor[methodName].bind(cursor);
              cursor[methodName] = wrapAsyncMethod(original, errorHandler);
            }
          });
          
          // Handle chaining methods
          const chainingMethods = ['limit', 'skip', 'sort'];
          chainingMethods.forEach(methodName => {
            if (cursor[methodName]) {
              const original = cursor[methodName].bind(cursor);
              cursor[methodName] = (...args) => wrapCursorMethods(original(...args), errorHandler);
            }
          });
          
          return cursor;
        };
        
        const wrapCollectionMethods = (collection, errorHandler) => {
          const methodsToWrap = [
            'find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'updateMany',
            'deleteOne', 'deleteMany', 'aggregate', 'countDocuments', 'distinct'
          ];
          
          methodsToWrap.forEach(methodName => {
            if (typeof collection[methodName] === 'function') {
              const originalMethod = collection[methodName].bind(collection);
              collection[methodName] = (...args) => {
                try {
                  const result = originalMethod(...args);
                  return methodName === 'find' && result?.toArray 
                    ? wrapCursorMethods(result, errorHandler) 
                    : result;
                } catch (error) {
                  errorHandler.setError(error.message);
                  throw error;
                }
              };
            }
          });
          
          return collection;
        };
        
        const setupGlobals = (db, client) => {
          const globals = {
            db, client, ObjectId, JSON, Date, Math, parseInt, parseFloat,
            isNaN, isFinite, Promise, setTimeout, clearTimeout,
            collection: (name) => db.collection(name)
          };
          
          Object.assign(global, globals);
        };
        
        const createResultMessage = (success, output, error = null) => ({
          success,
          ...(error && { error }),
          output,
          metadata: {
            database: workerData.databaseName,
            host: workerData.host,
            port: workerData.port,
            executed_at: new Date().toISOString()
          }
        });
        
        const detectOutputErrors = (output) => {
          const errorPatterns = [
            'failed to', 'error:', 'is not defined', 'cannot read', 'undefined', 'query is not defined'
          ];
          
          const outputLower = output.toLowerCase();
          const hasError = errorPatterns.some(pattern => outputLower.includes(pattern));
          
          if (hasError) {
            const lines = output.split('\\n');
            const errorLine = lines.find(line => 
              errorPatterns.some(pattern => line.toLowerCase().includes(pattern))
            );
            return errorLine || 'Script execution failed';
          }
          
          return null;
        };
        
        async function executeScript() {
          let client = null;
          const logger = createLogger();
          const errorHandler = createErrorHandler();
          
          // Override console methods
          console.log = logger.log;
          console.error = logger.error;
          
          try {
            const clientOptions = createClientOptions(workerData.connectionString);
            client = new MongoClient(workerData.connectionString, clientOptions);
            
            await client.connect();
            const db = client.db(workerData.databaseName);
            
            // Wrap database operations
            const originalCollection = db.collection.bind(db);
            db.collection = (name) => wrapCollectionMethods(originalCollection(name), errorHandler);
            
            setupGlobals(db, client);
            
            // Execute user script
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const userFunction = new AsyncFunction(workerData.scriptContent);
            await userFunction();
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const output = logger.getOutput();
            
            // Check for errors
            if (errorHandler.hasError()) {
              parentPort.postMessage(createResultMessage(false, output, errorHandler.getMessage()));
            } else {
              const outputError = detectOutputErrors(output);
              if (outputError) {
                parentPort.postMessage(createResultMessage(false, output, outputError));
              } else {
                parentPort.postMessage(createResultMessage(true, output));
              }
            }
            
          } catch (error) {
            parentPort.postMessage(createResultMessage(false, logger.getOutput(), error.message));
          } finally {
            if (client) {
              try { await client.close(); } catch (e) {}
            }
          }
        }
        
        // Error handlers
        const handleError = (type, error) => {
          parentPort.postMessage({
            success: false,
            error: \`\${type}: \${error?.message || error}\`,
            output: ''
          });
        };
        
        process.on('uncaughtException', (error) => handleError('Uncaught exception', error));
        process.on('unhandledRejection', (reason) => handleError('Unhandled rejection', reason));
        
        executeScript().catch(error => handleError('Script execution failed', error));
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

      // Functional result mapping with default fallback
      const resultMapper = (logData) => logData 
        ? {
            status: logData.success ? 'success' : 'failure',
            output: logData.output,
            error: logData.error,
            executionTime: logData.execution_time_ms,
            executedAt: logData.executed_at
          }
        : {
            status: 'pending',
            message: 'Script not yet executed'
          };

      return resultMapper(log);
    } catch (error) {
      console.error(`Failed to get script execution result for request ${requestId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new MongoScriptExecutionService();
