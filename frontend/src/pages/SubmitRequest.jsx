import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { querySubmissionSchema } from '../utils/validation';
import { dbAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { PODS, DB_TYPES, REQUEST_TYPES, API_BASE_URL } from '../utils/constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CodeEditor from '../components/common/CodeEditor';

export default function SubmitRequest() {
  const [instances, setInstances] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [scriptContent, setScriptContent] = useState(''); // Store script content for cloned requests
  const toast = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(querySubmissionSchema),
    defaultValues: {
      dbType: '',
      instanceId: '',
      databaseName: '',
      requestType: 'query',
      query: '',
      script: '',
      comments: '',
      podId: '',
    },
  });

  const dbType = watch('dbType');
  const instanceId = watch('instanceId');
  const requestType = watch('requestType');
  const queryValue = watch('query');
  const commentsValue = watch('comments');

  // Cloned request handlers - extracted to reduce complexity
  const clonedRequestHandlers = {
    setDatabaseType: (data, setValue) => {
      if (data.database_type) {
        setValue('dbType', data.database_type);
      }
    },
    
    setRequestTypeAndContent: (data, setValue, setScriptContent, setSelectedFile, toast) => {
      if (data.query) {
        setValue('requestType', 'query');
        setValue('query', data.query);
      } else if (data.script) {
        setValue('requestType', 'script');
        setScriptContent(data.script);
        // Auto-create file from script content
        const blob = new Blob([data.script], { type: 'text/javascript' });
        const file = new File([blob], 'cloned_script.js', { type: 'text/javascript' });
        setSelectedFile(file);
        toast.success('Script file auto-created from cloned request');
      }
    },
    
    setFormFields: (data, setValue) => {
      setValue('comments', data.comments || '');
      setValue('podId', data.pod_id || '');
    },
    
    storeSessionData: (data) => {
      if (data.instance_name) {
        sessionStorage.setItem('clonedInstanceName', data.instance_name);
      }
      if (data.database_name) {
        sessionStorage.setItem('clonedDatabaseName', data.database_name);
      }
    }
  };

  // Check for cloned request data on mount
  useEffect(() => {
    const clonedData = localStorage.getItem('cloneRequest');
    if (!clonedData) return;

    try {
      const data = JSON.parse(clonedData);
      
      // Apply all handlers
      clonedRequestHandlers.setDatabaseType(data, setValue);
      clonedRequestHandlers.setRequestTypeAndContent(data, setValue, setScriptContent, setSelectedFile, toast);
      clonedRequestHandlers.setFormFields(data, setValue);
      clonedRequestHandlers.storeSessionData(data);
      
      // Clear the cloned data
      localStorage.removeItem('cloneRequest');
      toast.success('Request data loaded successfully!');
    } catch (error) {
      console.error('Failed to parse cloned request:', error);
      localStorage.removeItem('cloneRequest');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select instance after instances load
  useEffect(() => {
    const clonedInstanceName = sessionStorage.getItem('clonedInstanceName');
    if (clonedInstanceName && instances.length > 0) {
      const matchingInstance = instances.find(inst => inst.name === clonedInstanceName);
      if (matchingInstance) {
        setValue('instanceId', matchingInstance.id.toString());
        sessionStorage.removeItem('clonedInstanceName');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances]);

  // Auto-select database after databases load
  useEffect(() => {
    const clonedDbName = sessionStorage.getItem('clonedDatabaseName');
    if (clonedDbName && databases.length > 0 && databases.includes(clonedDbName)) {
      setValue('databaseName', clonedDbName);
      sessionStorage.removeItem('clonedDatabaseName');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databases]);

  // Fetch instances when dbType changes
  useEffect(() => {
    if (!dbType) {
      setInstances([]);
      setDatabases([]);
      return;
    }

    // Prevent duplicate calls
    if (loadingInstances) return;

    setLoadingInstances(true);
    setInstances([]);
    setDatabases([]);
    setValue('instanceId', '');
    setValue('databaseName', '');
    
    dbAPI.getInstances(dbType)
      .then(data => {
        if (data.success) {
          setInstances(data.instances || []);
        } else {
          toast.error(data.message || 'Failed to load instances');
        }
      })
      .catch(err => {
        toast.error(err.message || 'Failed to load instances');
        setInstances([]);
      })
      .finally(() => {
        setLoadingInstances(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbType]);

  // Fetch databases when instanceId changes
  useEffect(() => {
    if (!instanceId) {
      setDatabases([]);
      return;
    }

    // Prevent duplicate calls
    if (loadingDatabases) return;

    setLoadingDatabases(true);
    setDatabases([]);
    setValue('databaseName', '');
    
    dbAPI.getDatabases(instanceId)
      .then(data => {
        if (data.success) {
          setDatabases(data.databases || []);
        } else {
          toast.error(data.message || 'Failed to load databases');
        }
      })
      .catch(err => {
        toast.error(err.message || 'Failed to load databases');
        setDatabases([]);
      })
      .finally(() => {
        setLoadingDatabases(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.js')) {
        toast.error('Only JavaScript (.js) files are allowed');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        e.target.value = '';
        return;
      }
      if (file.size === 0) {
        toast.error('Cannot upload empty file. Please add content to your script.');
        e.target.value = '';
        return;
      }
      
      // Read file content to check if it's actually empty (only whitespace)
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        if (!content || content.trim().length === 0) {
          toast.error('Cannot upload empty file. Please add content to your script.');
          e.target.value = '';
          setSelectedFile(null);
          return;
        }
        // File is valid, set it
        setSelectedFile(file);
      };
      reader.onerror = () => {
        toast.error('Error reading file. Please try again.');
        e.target.value = '';
      };
      reader.readAsText(file);
    }
  };

  const onSubmit = async (data) => {
    try {
      // Client-side validation for multiple queries
      if (data.requestType === 'query' && data.query) {
        const queryValidationResult = validateSingleQuery(data.query);
        if (!queryValidationResult.isValid) {
          toast.error(queryValidationResult.error);
          return;
        }
      }

      const formData = new FormData();
      formData.append('instance_id', parseInt(data.instanceId)); // Convert to number
      formData.append('db_name', data.databaseName);
      formData.append('comments', data.comments);
      formData.append('pod_id', data.podId);

      if (data.requestType === 'query') {
        formData.append('query', data.query);
      } else {
        if (!selectedFile) {
          toast.error('Please select a script file');
          return;
        }
        
        // Additional check for empty file during submission
        if (selectedFile.size === 0) {
          toast.error('Cannot submit empty script file. Please add content to your script.');
          return;
        }
        
        formData.append('script', selectedFile);
      }

      // Use fetch directly for FormData
      const response = await fetch(`${API_BASE_URL}/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Handle validation errors from backend
        if (result.errors && Array.isArray(result.errors)) {
          const errorMessages = result.errors.map(err => err.message).join(', ');
          toast.error(errorMessages);
        } else {
          toast.error(result.message || 'Failed to submit request');
        }
        return;
      }
      
      if (result.success) {
        toast.success('Request submitted successfully!');
        reset();
        setSelectedFile(null);
      } else {
        toast.error(result.message || 'Failed to submit request');
      }
    } catch (err) {
      toast.error(err.message || 'Network error occurred');
    }
  };

  // Client-side validation function for single queries
  const validateSingleQuery = (query) => {
    if (!query || typeof query !== 'string') {
      return { isValid: true }; // Let other validations handle this
    }
    
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return { isValid: true };
    }
    
    // Remove comments and normalize whitespace
    let cleanQuery = trimmedQuery
      // Remove single-line comments (-- comment)
      .replace(/--.*$/gm, '')
      // Remove multi-line comments (/* comment */)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove string literals to avoid false positives with semicolons inside strings
    // Handle single quotes, double quotes, and backticks
    cleanQuery = cleanQuery
      .replace(/'(?:[^'\\]|\\.)*'/g, "'STRING'")  // Single quoted strings
      .replace(/"(?:[^"\\]|\\.)*"/g, '"STRING"')  // Double quoted strings
      .replace(/`(?:[^`\\]|\\.)*`/g, '`STRING`'); // Backtick quoted strings
    
    // Check for multiple statements by looking for semicolons
    // Split by semicolon and filter out empty parts
    const statements = cleanQuery
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    // Should have exactly one non-empty statement
    if (statements.length > 1) {
      return {
        isValid: false,
        error: 'Multiple SQL statements are not allowed. Please submit only one query at a time for security reasons.'
      };
    }
    
    // Additional security checks - look for patterns in the original query
    const suspiciousPatterns = [
      { pattern: /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)/i, message: 'Multiple SQL statements detected' },
      { pattern: /UNION\s+(?:ALL\s+)?SELECT/i, message: 'UNION queries with multiple SELECT statements are not allowed' },
      { pattern: /;\s*--/, message: 'Semicolon followed by comments is suspicious' },
      { pattern: /;\s*\/\*/, message: 'Semicolon followed by block comments is suspicious' }
    ];
    
    for (const { pattern, message } of suspiciousPatterns) {
      if (pattern.test(query)) {
        return {
          isValid: false,
          error: `${message}. Please submit only single SQL statements.`
        };
      }
    }
    
    return { isValid: true };
  };

  const PostgresExample = () => (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-2">PostgreSQL Example:</div>
      <CodeEditor
        code={`async function yourFunction() {
  try {
    // Your database operations using query() function
    const data = await query('SELECT * FROM table');
    const result = {
      // Your result data
    };
    
    // REQUIRED: Must end with this
    console.log(result);
  } catch (error) {
    console.log({ error: error.message });
  }
}

await yourFunction();`}
        language="javascript"
        readOnly={true}
        showLineNumbers={false}
        maxHeight="300px"
        minHeight="200px"
      />
    </div>
  );

  const MongoExample = () => (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-2">MongoDB Example:</div>
      <CodeEditor
        code={`async function yourFunction() {
  try {
    // Your database operations using db object
    const result = await db.collection('users')
      .find({}).toArray();
    
    // REQUIRED: Must end with this
    console.log(result);
  } catch (error) {
    console.log({ error: error.message });
  }
}

await yourFunction();`}
        language="javascript"
        readOnly={true}
        showLineNumbers={false}
        maxHeight="300px"
        minHeight="200px"
      />
    </div>
  );

  return (
    <div className="flex gap-6 max-w-7xl mx-auto">
      {/* Main Form */}
      <div className="flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Submit Database Request</h1>
          <p className="text-gray-600 mt-1">Create a new query or script request for approval</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Database Type & Instance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database Type <span className="text-red-500">*</span>
              </label>
              <select
                {...register('dbType')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.dbType ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select type</option>
                {DB_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.dbType && (
                <p className="mt-1 text-sm text-red-600">{errors.dbType.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instance <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  {...register('instanceId')}
                  disabled={!dbType || loadingInstances}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${
                    errors.instanceId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select instance</option>
                  {instances.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
                {loadingInstances && (
                  <div className="absolute right-3 top-2.5">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
              {errors.instanceId && (
                <p className="mt-1 text-sm text-red-600">{errors.instanceId.message}</p>
              )}
            </div>
          </div>

          {/* Database & Pod */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  {...register('databaseName')}
                  disabled={!instanceId || loadingDatabases}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${
                    errors.databaseName ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select database</option>
                  {databases.map(db => (
                    <option key={db} value={db}>{db}</option>
                  ))}
                </select>
                {loadingDatabases && (
                  <div className="absolute right-3 top-2.5">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
              {errors.databaseName && (
                <p className="mt-1 text-sm text-red-600">{errors.databaseName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pod <span className="text-red-500">*</span>
              </label>
              <select
                {...register('podId')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.podId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select pod</option>
                {PODS.map(pod => (
                  <option key={pod.id} value={pod.id}>{pod.name}</option>
                ))}
              </select>
              {errors.podId && (
                <p className="mt-1 text-sm text-red-600">{errors.podId.message}</p>
              )}
            </div>
          </div>

          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              {REQUEST_TYPES.map(type => (
                <label key={type.value} className="flex items-center">
                  <input
                    type="radio"
                    {...register('requestType')}
                    value={type.value}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Query Input (conditional) */}
          {requestType === 'query' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Query <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {queryValue && (() => {
                    const validation = validateSingleQuery(queryValue);
                    return !validation.isValid ? (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Multiple queries detected
                      </span>
                    ) : null;
                  })()}
                  <span className={`text-xs ${
                    (queryValue?.length || 0) > 10000 ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {queryValue?.length || 0}/10,000 characters
                  </span>
                </div>
              </div>
              <CodeEditor
                code={queryValue || ''}
                language={dbType === 'MONGO' ? 'javascript' : 'sql'}
                onChange={(value) => setValue('query', value)}
                placeholder={dbType === 'MONGO' ? 'db.collection.find({})' : 'SELECT * FROM table_name;'}
                className={errors.query ? 'border-red-500' : ''}
                maxHeight="400px"
                minHeight="200px"
                showLineNumbers={false}
              />
              {queryValue && (() => {
                const validation = validateSingleQuery(queryValue);
                return !validation.isValid && (
                  <p className="mt-1 text-sm text-red-600 flex items-start gap-1">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {validation.error}
                  </p>
                );
              })()}
              {errors.query && (
                <p className="mt-1 text-sm text-red-600">{errors.query.message}</p>
              )}
              
              {/* Help text for single query requirement */}
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Security Notice:</p>
                    <p>Only single SQL statements are allowed. Multiple queries separated by semicolons are blocked for security reasons.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Script File Upload (conditional) */}
          {requestType === 'script' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Script File <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept=".js"
                  onChange={handleFileChange}
                  className="hidden"
                  id="script-upload"
                />
                <label htmlFor="script-upload" className="cursor-pointer">
                  <div className="text-gray-600">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-2 text-sm">
                      <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">JavaScript files only (.js)</p>
                  </div>
                </label>
                {selectedFile && (
                  <div className="mt-2 text-sm text-green-600">
                    ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
              
              {/* Show script content preview if available */}
              {scriptContent && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Script Preview (from cloned request)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([scriptContent], { type: 'text/javascript' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'cloned_script.js';
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Script downloaded');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Download Script
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <CodeEditor
                      code={scriptContent}
                      language="javascript"
                      readOnly={true}
                      showLineNumbers={false}
                      maxHeight="240px"
                      minHeight="120px"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Comments <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs ${
                (commentsValue?.length || 0) > 1000 ? 'text-red-500' : 'text-gray-500'
              }`}>
                {commentsValue?.length || 0}/1,000 characters
              </span>
            </div>
            <textarea
              {...register('comments')}
              rows={3}
              placeholder="Explain why you need to run this query/script..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.comments ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.comments && (
              <p className="mt-1 text-sm text-red-600">{errors.comments.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                reset();
                setSelectedFile(null);
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Submitting...
                </span>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Documentation Sidebar - Only show for script requests */}
      {requestType === 'script' && (
        <div className="w-96 bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Documentation</h3>
          </div>
          
          <div className="space-y-4 text-sm text-gray-600">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-medium text-blue-900">Database connections are auto-injected. No hardcoded credentials needed!</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Node.js Scripts (.js)</h4>
              <p className="mb-2">Upload JavaScript files that will be executed in a secure environment.</p>
              
              <div className="bg-yellow-50 p-3 rounded-lg mb-3">
                <h5 className="font-medium text-yellow-800 mb-1">Required Elements:</h5>
                <ul className="list-disc list-inside space-y-1 text-yellow-700 text-xs">
                  <li>Must include <code className="bg-yellow-200 px-1 rounded">console.log()</code> for results</li>
                  <li>Use <code className="bg-yellow-200 px-1 rounded">async/await</code> for database operations</li>
                  <li>Wrap code in try-catch blocks for error handling</li>
                  <li>Call your main function at the end of the script</li>
                </ul>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Available Functions & Variables:</h4>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div><strong>PostgreSQL:</strong> <code className="bg-gray-200 px-1 rounded">query(sql, params)</code> -SQL queries</div>
                  <div><strong>MongoDB:</strong> <code className="bg-gray-200 px-1 rounded">db</code> - Database object for collections</div>
                </div>
              </div>
            </div>

            {dbType === 'POSTGRES' && <PostgresExample />}
            {dbType === 'MONGO' && <MongoExample />}
            
            {!dbType && (
              <div className="text-center text-gray-500 py-8">
                Select a database type to see examples
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
