/**
 * Remove SQL comments from content
 * @param {string} content - Content to clean
 * @returns {string} - Content without SQL comments
 */
const removeSqlComments = (content) => {
  if (!content) return '';
  
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inBlockComment = false;
  
  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    // Handle string literals (preserve content inside strings)
    if (!inBlockComment && (char === '"' || char === "'" || char === '`')) {
      if (!inString) {
        inString = true;
        stringChar = char;
        result += char;
      } else if (char === stringChar && content[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
        result += char;
      } else {
        result += char;
      }
      i++;
      continue;
    }
    
    // Skip processing if we're inside a string
    if (inString) {
      result += char;
      i++;
      continue;
    }
    
    // Handle block comments /* */
    if (!inBlockComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i += 2;
      continue;
    }
    
    if (inBlockComment) {
      i++;
      continue;
    }
    
    // Handle line comments --
    if (char === '-' && nextChar === '-') {
      // Skip to end of line
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      // Keep the newline
      if (i < content.length) {
        result += content[i];
        i++;
      }
      continue;
    }
    
    result += char;
    i++;
  }
  
  return result;
};

/**
 * Remove JavaScript comments from content
 * @param {string} content - Content to clean
 * @returns {string} - Content without JavaScript comments
 */
const removeJsComments = (content) => {
  if (!content) return '';
  
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inBlockComment = false;
  
  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    // Handle string literals (preserve content inside strings)
    if (!inBlockComment && (char === '"' || char === "'" || char === '`')) {
      if (!inString) {
        inString = true;
        stringChar = char;
        result += char;
      } else if (char === stringChar && content[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
        result += char;
      } else {
        result += char;
      }
      i++;
      continue;
    }
    
    // Skip processing if we're inside a string
    if (inString) {
      result += char;
      i++;
      continue;
    }
    
    // Handle block comments /* */
    if (!inBlockComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i += 2;
      continue;
    }
    
    if (inBlockComment) {
      i++;
      continue;
    }
    
    // Handle line comments //
    if (char === '/' && nextChar === '/') {
      // Skip to end of line
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      // Keep the newline
      if (i < content.length) {
        result += content[i];
        i++;
      }
      continue;
    }
    
    result += char;
    i++;
  }
  
  return result;
};

/**
 * Assess the risk level of a database query or script
 * @param {string} query - SQL query text
 * @param {string} script - Script content
 * @param {string} dbType - Database type (POSTGRES/MONGO)
 * @returns {Object} - { level: 'low'|'medium'|'high', reasons: string[], color: string }
 */
export const assessQueryRisk = (query, script, dbType) => {
  let rawContent = query || script || '';
  
  // Remove comments based on content type
  let cleanContent = rawContent;
  if (script) {
    // For scripts, remove JavaScript comments
    cleanContent = removeJsComments(rawContent);
  } else if (query) {
    // For queries, remove SQL comments
    cleanContent = removeSqlComments(rawContent);
  }
  
  const content = cleanContent.toUpperCase();
  const reasons = [];
  let riskScore = 0;

  // High risk operations (3 points each)
  const highRiskPatterns = [
    { pattern: /DROP\s+(TABLE|DATABASE|SCHEMA|COLLECTION)/g, reason: 'DROP operation - deletes data permanently', points: 6 },
    { pattern: /TRUNCATE/g, reason: 'TRUNCATE - removes all data from table', points: 6 },
    { pattern: /DELETE\s+FROM\s+\w+\s*;?\s*$/gi, reason: 'DELETE without WHERE clause - affects all rows', points: 5 },
    { pattern: /UPDATE\s+\w+\s+SET\s+.*\s*;?\s*$/gi, reason: 'UPDATE without WHERE clause - affects all rows', points: 5 },
    { pattern: /ALTER\s+(TABLE|DATABASE)/g, reason: 'ALTER operation - modifies database structure', points: 4 },
    { pattern: /GRANT|REVOKE/g, reason: 'Permission changes detected', points: 4 },
    { pattern: /CREATE\s+USER|DROP\s+USER/g, reason: 'User management operation', points: 4 },
  ];

  // Medium risk operations (2 points each)
  const mediumRiskPatterns = [
    { pattern: /DELETE\s+FROM/g, reason: 'DELETE operation with conditions', points: 2 },
    { pattern: /UPDATE\s+.*\s+SET/g, reason: 'UPDATE operation', points: 2 },
    { pattern: /INSERT\s+INTO/g, reason: 'INSERT operation - adds data', points: 2 },
    { pattern: /CREATE\s+(TABLE|INDEX|VIEW)/g, reason: 'CREATE operation - adds database objects', points: 2 },
    { pattern: /\bEXEC\s*\(|\bEXECUTE\s*\(/g, reason: 'Dynamic SQL execution', points: 2 },
  ];

  // MongoDB specific high risk
  if (dbType === 'MONGO') {
    const mongoHighRisk = [
      { pattern: /\.DROP\s*\(/gi, reason: 'DROP collection operation', points: 6 },
      { pattern: /\.DELETEMANY\s*\(\s*\{\s*\}\s*\)/gi, reason: 'deleteMany with empty filter - deletes all documents', points: 5 },
      { pattern: /\.UPDATEMANY\s*\(\s*\{\s*\}\s*,/gi, reason: 'updateMany with empty filter - updates all documents', points: 5 },
      { pattern: /\.REMOVE\s*\(\s*\{\s*\}\s*\)/gi, reason: 'remove with empty filter - removes all documents', points: 5 },
    ];
    highRiskPatterns.push(...mongoHighRisk);

    const mongoMediumRisk = [
      { pattern: /\.DELETEMANY/gi, reason: 'deleteMany operation', points: 2 },
      { pattern: /\.DELETEONE/gi, reason: 'deleteOne operation', points: 2 },
      { pattern: /\.UPDATEMANY/gi, reason: 'updateMany operation', points: 2 },
      { pattern: /\.UPDATEONE/gi, reason: 'updateOne operation', points: 2 },
      { pattern: /\.INSERTMANY/gi, reason: 'insertMany operation', points: 2 },
      { pattern: /\.INSERTONE/gi, reason: 'insertOne operation', points: 2 },
    ];
    mediumRiskPatterns.push(...mongoMediumRisk);
  }

  // Check high risk patterns
  highRiskPatterns.forEach(({ pattern, reason, points }) => {
    // Reset regex lastIndex to avoid stateful issues with global flag
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      riskScore += points;
      reasons.push(reason);
    }
  });

  // Check medium risk patterns
  mediumRiskPatterns.forEach(({ pattern, reason, points }) => {
    // Reset regex lastIndex to avoid stateful issues with global flag
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      riskScore += points;
      reasons.push(reason);
    }
  });

  // Additional risk factors for scripts
  if (script) {
    // Don't automatically add risk just for being a script
    // Analyze the script content instead
    
    // Check for loops that might affect many records (but not forEach for reading)
    // Only flag loops that contain write operations
    const loopPattern = /(?:FOR|WHILE)\s*\([^)]*\)\s*\{[^}]*(?:QUERY|DB\.)[^}]*(?:DELETE|UPDATE|INSERT|DROP|ALTER|TRUNCATE)/gi;
    if (loopPattern.test(content)) {
      riskScore += 1;
      reasons.push('Contains loops with write operations - may affect multiple records');
    }

    // Check for multiple write operations (not just any operations)
    // Look for query() or db. calls with write operations inside
    const writeOperationPattern = /QUERY\s*\(\s*['"`][^'"`]*(DELETE|UPDATE|INSERT|DROP|ALTER|TRUNCATE)/gi;
    const writeOperations = (content.match(writeOperationPattern) || []).length;
    if (writeOperations > 5) {
      riskScore += 1;
      reasons.push(`Multiple write operations detected (${writeOperations})`);
    }
  }

  // Determine risk level
  let level, color, bgColor, borderColor, icon;
  if (riskScore >= 6) {
    level = 'critical';
    color = 'text-pink-700';
    bgColor = 'bg-pink-50';
    borderColor = 'border-pink-300';
    icon = '●'; // Solid circle for critical
  } else if (riskScore >= 4) {
    level = 'high';
    color = 'text-red-700';
    bgColor = 'bg-red-50';
    borderColor = 'border-red-300';
    icon = '●'; // Solid circle for high
  } else if (riskScore >= 2) {
    level = 'medium';
    color = 'text-yellow-700';
    bgColor = 'bg-yellow-50';
    borderColor = 'border-yellow-300';
    icon = '●'; // Solid circle for medium
  } else {
    level = 'low';
    color = 'text-green-700';
    bgColor = 'bg-green-50';
    borderColor = 'border-green-300';
    icon = '●'; // Solid circle for low
  }

  // If no risky operations found, it's a read-only query
  if (reasons.length === 0) {
    reasons.push('Read-only operation - safe to execute');
  }

  return {
    level,
    color,
    bgColor,
    borderColor,
    icon,
    riskScore,
    reasons: [...new Set(reasons)], // Remove duplicates
  };
};

/**
 * Get risk level label
 */
export const getRiskLabel = (level) => {
  const labels = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
  };
  return labels[level] || 'Unknown';
};
