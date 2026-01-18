import sqlParser from 'node-sql-parser';
const { Parser } = sqlParser;

/**
 * Advanced Risk Assessment System
 * Combines AST parsing, pattern analysis, and security checks
 */

/**
 * SQL Parser instances for different database types
 */
const sqlParsers = {
  POSTGRES: new Parser(),
  MYSQL: new Parser(),
  MONGO: null // MongoDB uses JavaScript, not SQL
};

/**
 * Advanced comment removal with proper string literal handling
 * @param {string} content - Content to clean
 * @param {string} type - 'sql' or 'js'
 * @returns {string} - Content without comments
 */
const removeComments = (content, type = 'sql') => {
  const commentRules = {
    sql: {
      lineComment: '--',
      blockStart: '/*',
      blockEnd: '*/',
      stringChars: ['"', "'", '`']
    },
    js: {
      lineComment: '//',
      blockStart: '/*',
      blockEnd: '*/',
      stringChars: ['"', "'", '`']
    }
  };

  const rules = commentRules[type] || commentRules.sql;
  let result = '';
  let inString = false;
  let stringChar = '';
  let inBlockComment = false;
  let i = 0;
  
  while (i < content.length) {
    const char = content[i];
    const remaining = content.slice(i);
    
    // Handle string literals
    const isStringChar = rules.stringChars.includes(char);
    const isEscaped = i > 0 && content[i - 1] === '\\';
    
    if (inBlockComment) {
      // Look for block comment end
      if (remaining.startsWith(rules.blockEnd)) {
        inBlockComment = false;
        i += rules.blockEnd.length;
        continue;
      }
      i++;
      continue;
    }
    
    if (inString) {
      if (char === stringChar && !isEscaped) {
        inString = false;
        stringChar = '';
      }
      result += char;
      i++;
      continue;
    }
    
    // Not in string or block comment
    if (isStringChar) {
      inString = true;
      stringChar = char;
      result += char;
      i++;
      continue;
    }
    
    if (remaining.startsWith(rules.blockStart)) {
      inBlockComment = true;
      i += rules.blockStart.length;
      continue;
    }
    
    if (remaining.startsWith(rules.lineComment)) {
      // Skip to end of line
      const nextNewline = content.indexOf('\n', i);
      if (nextNewline === -1) {
        break; // End of content
      }
      i = nextNewline;
      continue;
    }
    
    result += char;
    i++;
  }
  
  return result;
};

/**
 * AST-based SQL risk analysis
 * @param {string} sql - SQL query to analyze
 * @param {string} dbType - Database type
 * @returns {Object} - Risk analysis result
 */
const analyzeSqlAst = (sql, dbType) => {
  try {
    const parser = sqlParsers[dbType] || sqlParsers.POSTGRES;
    const ast = parser.astify(sql);
    
    const risks = [];
    let riskScore = 0;
    
    // Analyze AST nodes for security risks
    const analyzeNode = (node, path = []) => {
      if (!node || typeof node !== 'object') return;
      
      // Check for dangerous operations
      if (node.type) {
        switch (node.type.toLowerCase()) {
          case 'drop':
            riskScore += 6;
            risks.push({
              type: 'critical',
              reason: `DROP ${node.keyword || node.name || 'table'} - permanently deletes data`,
              location: path.join('.')
            });
            break;
            
          case 'truncate':
            riskScore += 6;
            risks.push({
              type: 'critical',
              reason: 'TRUNCATE operation - removes all table data',
              location: path.join('.')
            });
            break;
            
          case 'delete':
            // Check if WHERE clause exists and has conditions
            const hasWhere = node.where && 
              (Array.isArray(node.where) ? node.where.length > 0 : true);
            
            if (!hasWhere) {
              riskScore += 5;
              risks.push({
                type: 'critical',
                reason: 'DELETE without WHERE clause - affects all rows',
                location: path.join('.')
              });
            } else {
              riskScore += 2;
              risks.push({
                type: 'medium',
                reason: 'DELETE operation with conditions',
                location: path.join('.')
              });
            }
            break;
            
          case 'update':
            // Check if WHERE clause exists and has conditions
            const hasWhereUpdate = node.where && 
              (Array.isArray(node.where) ? node.where.length > 0 : true);
            
            if (!hasWhereUpdate) {
              riskScore += 5;
              risks.push({
                type: 'critical',
                reason: 'UPDATE without WHERE clause - affects all rows',
                location: path.join('.')
              });
            } else {
              riskScore += 2;
              risks.push({
                type: 'medium',
                reason: 'UPDATE operation',
                location: path.join('.')
              });
            }
            break;
            
          case 'insert':
            riskScore += 2;
            risks.push({
              type: 'medium',
              reason: 'INSERT operation - adds data',
              location: path.join('.')
            });
            break;
            
          case 'alter':
            riskScore += 4;
            risks.push({
              type: 'high',
              reason: 'ALTER operation - modifies database structure',
              location: path.join('.')
            });
            break;
            
          case 'create':
            if (node.keyword && ['user', 'role'].includes(node.keyword.toLowerCase())) {
              riskScore += 4;
              risks.push({
                type: 'high',
                reason: 'User/role creation - security implications',
                location: path.join('.')
              });
            } else {
              riskScore += 2;
              risks.push({
                type: 'medium',
                reason: 'CREATE operation - adds database objects',
                location: path.join('.')
              });
            }
            break;
            
          case 'grant':
          case 'revoke':
            riskScore += 4;
            risks.push({
              type: 'high',
              reason: 'Permission changes detected',
              location: path.join('.')
            });
            break;
        }
      }
      
      // Check for dynamic SQL execution
      if (node.expr && node.expr.type === 'function' && 
          ['exec', 'execute', 'sp_executesql'].includes(node.expr.name?.toLowerCase())) {
        riskScore += 3;
        risks.push({
          type: 'high',
          reason: 'Dynamic SQL execution detected',
          location: path.join('.')
        });
      }
      
      // Recursively analyze child nodes
      Object.keys(node).forEach(key => {
        if (Array.isArray(node[key])) {
          node[key].forEach((item, index) => {
            analyzeNode(item, [...path, key, index.toString()]);
          });
        } else if (typeof node[key] === 'object') {
          analyzeNode(node[key], [...path, key]);
        }
      });
    };
    
    // Handle single statement or array of statements
    if (Array.isArray(ast)) {
      ast.forEach((statement, index) => {
        analyzeNode(statement, ['statement', index.toString()]);
      });
    } else {
      analyzeNode(ast, ['root']);
    }
    
    return { risks, riskScore, astAnalysis: true };
    
  } catch (error) {
    // If AST parsing fails, fall back to pattern-based analysis
    console.warn('AST parsing failed, falling back to pattern analysis:', error.message);
    return { risks: [], riskScore: 0, astAnalysis: false, parseError: error.message };
  }
};

/**
 * MongoDB/JavaScript security analysis
 * @param {string} script - JavaScript/MongoDB script
 * @returns {Object} - Risk analysis result
 */
const analyzeMongoScript = (script) => {
  const risks = [];
  let riskScore = 0;
  
  // Remove comments first
  const cleanScript = removeComments(script, 'js').toUpperCase();
  
  // MongoDB-specific dangerous patterns
  const mongoPatterns = [
    {
      pattern: /\.DROP\s*\(/gi,
      reason: 'DROP collection operation',
      points: 6,
      type: 'critical'
    },
    {
      pattern: /\.DELETEMANY\s*\(\s*\{\s*\}\s*\)/gi,
      reason: 'deleteMany with empty filter - deletes all documents',
      points: 5,
      type: 'critical'
    },
    {
      pattern: /\.UPDATEMANY\s*\(\s*\{\s*\}\s*,/gi,
      reason: 'updateMany with empty filter - updates all documents',
      points: 5,
      type: 'critical'
    },
    {
      pattern: /\.REMOVE\s*\(\s*\{\s*\}\s*\)/gi,
      reason: 'remove with empty filter - removes all documents',
      points: 5,
      type: 'critical'
    },
    {
      pattern: /\.DELETEMANY/gi,
      reason: 'deleteMany operation',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /\.DELETEONE/gi,
      reason: 'deleteOne operation',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /\.UPDATEMANY/gi,
      reason: 'updateMany operation',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /\.UPDATEONE/gi,
      reason: 'updateOne operation',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /\.INSERTMANY/gi,
      reason: 'insertMany operation',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /\.INSERTONE/gi,
      reason: 'insertOne operation',
      points: 2,
      type: 'medium'
    }
  ];
  
  // JavaScript security patterns
  const jsSecurityPatterns = [
    {
      pattern: /EVAL\s*\(/gi,
      reason: 'eval() usage - code injection risk',
      points: 4,
      type: 'high'
    },
    {
      pattern: /(?:NEW\s+)?FUNCTION\s*\(\s*['"`\\][^'"`\\]*['"`\\]/gi,
      reason: 'Dynamic function creation - code injection risk',
      points: 3,
      type: 'high'
    },
    {
      pattern: /\$WHERE\s*:/gi,
      reason: '$where operator - JavaScript injection risk',
      points: 4,
      type: 'high'
    },
    {
      pattern: /SETTIMEOUT\s*\(\s*['"`][^'"`]*['"`]/gi,
      reason: 'setTimeout with string - code injection risk',
      points: 3,
      type: 'high'
    },
    {
      pattern: /SETINTERVAL\s*\(\s*['"`][^'"`]*['"`]/gi,
      reason: 'setInterval with string - code injection risk',
      points: 3,
      type: 'high'
    }
  ];

  // SQL injection patterns in JavaScript (query() calls, etc.)
  const sqlInJsPatterns = [
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*DROP[^'"`]*['"`]/gi,
      reason: 'DROP operation in query() call - permanently deletes data',
      points: 6,
      type: 'critical'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*TRUNCATE[^'"`]*['"`]/gi,
      reason: 'TRUNCATE operation in query() call - removes all table data',
      points: 6,
      type: 'critical'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*DELETE\s+FROM\s+\w+\s*;?\s*['"`]/gi,
      reason: 'DELETE without WHERE in query() call - affects all rows',
      points: 5,
      type: 'critical'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*UPDATE\s+\w+\s+SET[^'"`]*\s*;?\s*['"`]/gi,
      reason: 'UPDATE without WHERE in query() call - may affect all rows',
      points: 4,
      type: 'high'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*DELETE\s+FROM[^'"`]*['"`]/gi,
      reason: 'DELETE operation in query() call',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*UPDATE[^'"`]*SET[^'"`]*['"`]/gi,
      reason: 'UPDATE operation in query() call',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*INSERT\s+INTO[^'"`]*['"`]/gi,
      reason: 'INSERT operation in query() call',
      points: 2,
      type: 'medium'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*ALTER\s+TABLE[^'"`]*['"`]/gi,
      reason: 'ALTER TABLE operation in query() call',
      points: 4,
      type: 'high'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*CREATE\s+(?:USER|ROLE)[^'"`]*['"`]/gi,
      reason: 'User/role creation in query() call',
      points: 4,
      type: 'high'
    },
    {
      pattern: /QUERY\s*\(\s*['"`][^'"`]*(?:GRANT|REVOKE)[^'"`]*['"`]/gi,
      reason: 'Permission changes in query() call',
      points: 4,
      type: 'high'
    }
  ];
  
  // Analyze patterns
  [...mongoPatterns, ...jsSecurityPatterns, ...sqlInJsPatterns].forEach(({ pattern, reason, points, type }) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(cleanScript)) {
      riskScore += points;
      risks.push({ type, reason, location: 'script' });
    }
  });
  
  // Check for loops with write operations
  const loopPattern = /(?:FOR|WHILE)\s*\([^)]*\)\s*\{[^}]*(?:QUERY|DB\.)[^}]*(?:DELETE|UPDATE|INSERT|DROP|ALTER|TRUNCATE)/gi;
  if (loopPattern.test(cleanScript)) {
    riskScore += 1;
    risks.push({
      type: 'medium',
      reason: 'Contains loops with write operations - may affect multiple records',
      location: 'script'
    });
  }
  
  // Check for multiple write operations
  const writeOperationPattern = /(?:QUERY\s*\(\s*['"`][^'"`]*(?:DELETE|UPDATE|INSERT|DROP|ALTER|TRUNCATE)|DB\.[^.]+\.(?:DELETE|UPDATE|INSERT|DROP))/gi;
  const writeOperations = (cleanScript.match(writeOperationPattern) || []).length;
  if (writeOperations > 5) {
    riskScore += 1;
    risks.push({
      type: 'medium',
      reason: `Multiple write operations detected (${writeOperations})`,
      location: 'script'
    });
  }
  
  return { risks, riskScore, astAnalysis: false };
};

/**
 * Risk level configuration
 */
const RISK_LEVELS = [
  {
    threshold: 6,
    level: 'critical',
    label: 'Critical Risk',
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-300',
    icon: '●'
  },
  {
    threshold: 4,
    level: 'high',
    label: 'High Risk',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    icon: '●'
  },
  {
    threshold: 2,
    level: 'medium',
    label: 'Medium Risk',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    icon: '●'
  },
  {
    threshold: 0,
    level: 'low',
    label: 'Low Risk',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    icon: '●'
  }
];

/**
 * Determine risk level based on score
 * @param {number} score - Risk score
 * @returns {Object} - Risk level configuration
 */
const determineRiskLevel = (score) => {
  return RISK_LEVELS.find(level => score >= level.threshold) || RISK_LEVELS[RISK_LEVELS.length - 1];
};

/**
 * Assess the risk level of a database query or script
 * @param {string} query - SQL query text
 * @param {string} script - Script content
 * @param {string} dbType - Database type (POSTGRES/MONGO/MYSQL)
 * @returns {Object} - Comprehensive risk analysis
 */
export const assessQueryRisk = (query, script, dbType) => {
  // Input validation
  if (!query && !script) {
    return {
      level: 'low',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300',
      icon: '●',
      riskScore: 0,
      reasons: ['No content to analyze'],
      analysis: { method: 'none', astUsed: false }
    };
  }

  let analysisResult;
  const isScript = Boolean(script);
  
  try {
    if (isScript || dbType === 'MONGO') {
      // Use JavaScript/MongoDB analysis
      analysisResult = analyzeMongoScript(script || query);
    } else {
      // Use AST-based SQL analysis
      const cleanQuery = removeComments(query, 'sql');
      analysisResult = analyzeSqlAst(cleanQuery, dbType);
      
      // If AST parsing failed, fall back to MongoDB script analysis for safety
      if (!analysisResult.astAnalysis && analysisResult.parseError) {
        analysisResult = analyzeMongoScript(query);
        analysisResult.fallbackUsed = true;
      }
    }
  } catch (error) {
    // Ultimate fallback - return safe default
    return {
      level: 'medium',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
      icon: '●',
      riskScore: 2,
      reasons: ['Unable to analyze query - treating as medium risk for safety'],
      analysis: { method: 'error', error: error.message, astUsed: false }
    };
  }
  
  // Determine risk level
  const riskLevel = determineRiskLevel(analysisResult.riskScore);
  
  // Format reasons
  const reasons = analysisResult.risks.length > 0 
    ? analysisResult.risks.map(risk => risk.reason)
    : ['Read-only operation - safe to execute'];

  return {
    level: riskLevel.level,
    color: riskLevel.color,
    bgColor: riskLevel.bgColor,
    borderColor: riskLevel.borderColor,
    icon: riskLevel.icon,
    riskScore: analysisResult.riskScore,
    reasons: [...new Set(reasons)], // Remove duplicates
    analysis: {
      method: isScript || dbType === 'MONGO' ? 'javascript' : 'sql-ast',
      astUsed: analysisResult.astAnalysis || false,
      fallbackUsed: analysisResult.fallbackUsed || false,
      parseError: analysisResult.parseError,
      detailedRisks: analysisResult.risks
    }
  };
};

/**
 * Get risk level label
 * @param {string} level - Risk level
 * @returns {string} - Human readable label
 */
export const getRiskLabel = (level) => {
  const riskLevel = RISK_LEVELS.find(l => l.level === level);
  return riskLevel ? riskLevel.label : 'Unknown';
};

/**
 * Validate SQL syntax without executing
 * @param {string} sql - SQL to validate
 * @param {string} dbType - Database type
 * @returns {Object} - Validation result
 */
export const validateSqlSyntax = (sql, dbType) => {
  try {
    const parser = sqlParsers[dbType] || sqlParsers.POSTGRES;
    const ast = parser.astify(sql);
    return {
      valid: true,
      ast: ast,
      error: null
    };
  } catch (error) {
    return {
      valid: false,
      ast: null,
      error: error.message
    };
  }
};

/**
 * Enhanced risk assessment with comprehensive analysis
 * @param {string} query - SQL query text
 * @param {string} script - Script content
 * @param {string} dbType - Database type
 * @returns {Object} - Comprehensive analysis with recommendations
 */
export const getComprehensiveRiskAnalysis = (query, script, dbType) => {
  const riskResult = assessQueryRisk(query, script, dbType);
  
  // Generate recommendations based on risk level
  const recommendations = [];
  
  switch (riskResult.level) {
    case 'critical':
      recommendations.push('🚨 CRITICAL: This operation should be reviewed by a senior developer');
      recommendations.push('🔒 Consider requiring additional approval for execution');
      recommendations.push('📋 Ensure you have a backup before proceeding');
      recommendations.push('⏰ Execute during maintenance window if possible');
      break;
      
    case 'high':
      recommendations.push('⚠️ HIGH RISK: Review this operation carefully');
      recommendations.push('🔍 Verify the WHERE clause conditions');
      recommendations.push('📊 Consider testing on a smaller dataset first');
      break;
      
    case 'medium':
      recommendations.push('📝 MEDIUM RISK: Standard review recommended');
      recommendations.push('✅ Verify the operation matches your intent');
      break;
      
    case 'low':
      recommendations.push('✅ LOW RISK: Safe to execute');
      break;
  }
  
  // Add syntax validation for SQL
  let syntaxValidation = null;
  if (query && dbType !== 'MONGO') {
    syntaxValidation = validateSqlSyntax(query, dbType);
    if (!syntaxValidation.valid) {
      recommendations.unshift('❌ SYNTAX ERROR: Fix syntax errors before execution');
    }
  }
  
  return {
    ...riskResult,
    recommendations,
    syntaxValidation,
    timestamp: new Date().toISOString()
  };
};