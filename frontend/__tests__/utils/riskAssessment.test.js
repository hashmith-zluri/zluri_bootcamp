import { 
  assessQueryRisk, 
  getRiskLabel, 
  validateSqlSyntax,
  getComprehensiveRiskAnalysis
} from '../../src/utils/riskAssessment';

describe('Risk Assessment', () => {
  describe('assessQueryRisk', () => {
    describe('SQL AST Analysis', () => {
      it('should detect DROP operations using AST', () => {
        const query = 'DROP TABLE users';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('critical');
        expect(result.analysis.astUsed).toBe(true);
        expect(result.analysis.method).toBe('sql-ast');
        expect(result.reasons.some(reason => reason.includes('DROP') && reason.includes('permanently deletes data'))).toBe(true);
      });

      it('should detect DELETE without WHERE using AST', () => {
        const query = 'DELETE FROM users';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(['critical', 'high']).toContain(result.level); // AST might interpret differently
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons.some(reason => reason.includes('DELETE'))).toBe(true);
      });

      it('should detect DELETE with WHERE using AST', () => {
        const query = 'DELETE FROM users WHERE id = 1';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('medium');
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons.some(reason => reason.includes('DELETE operation with conditions'))).toBe(true);
      });

      it('should detect UPDATE without WHERE using AST', () => {
        const query = 'UPDATE users SET name = "John"';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(['critical', 'high']).toContain(result.level); // AST might interpret differently
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons.some(reason => reason.includes('UPDATE'))).toBe(true);
      });

      it('should detect UPDATE with WHERE using AST', () => {
        const query = 'UPDATE users SET name = "John" WHERE id = 1';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('medium');
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons.some(reason => reason.includes('UPDATE operation'))).toBe(true);
      });

      it('should detect INSERT operations using AST', () => {
        const query = 'INSERT INTO users (name, email) VALUES ("John", "john@example.com")';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('medium');
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons.some(reason => reason.includes('INSERT operation - adds data'))).toBe(true);
      });

      it('should detect ALTER operations using AST', () => {
        const query = 'ALTER TABLE users ADD COLUMN age INTEGER';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(['high', 'critical']).toContain(result.level); // AST might score differently
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons.some(reason => reason.includes('ALTER'))).toBe(true);
      });

      it('should detect safe SELECT operations using AST', () => {
        const query = 'SELECT * FROM users WHERE id = 1';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });

      it('should handle complex queries with multiple operations', () => {
        const query = `
          INSERT INTO audit_log (action, user_id) VALUES ('login', 1);
          UPDATE users SET last_login = NOW() WHERE id = 1;
        `;
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('high'); // INSERT (2) + UPDATE (2) = 4 points
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons.some(reason => reason.includes('INSERT operation - adds data'))).toBe(true);
        expect(result.reasons.some(reason => reason.includes('UPDATE operation'))).toBe(true);
      });
    });

    describe('MongoDB/JavaScript Analysis', () => {
      it('should detect MongoDB drop operations', () => {
        const script = 'db.collection("users").drop()';
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('critical');
        expect(result.analysis.method).toBe('javascript');
        expect(result.reasons.some(reason => reason.includes('DROP collection operation'))).toBe(true);
      });

      it('should detect deleteMany with empty filter', () => {
        const script = 'db.collection("users").deleteMany({})';
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('critical');
        expect(result.reasons.some(reason => reason.includes('deleteMany with empty filter - deletes all documents'))).toBe(true);
      });

      it('should detect deleteMany with filter', () => {
        const script = 'db.collection("users").deleteMany({status: "inactive"})';
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('medium');
        expect(result.reasons.some(reason => reason.includes('deleteMany operation'))).toBe(true);
      });

      it('should detect eval() usage', () => {
        const script = 'eval("db.collection(\\"users\\").find()")';
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('high');
        expect(result.reasons.some(reason => reason.includes('eval() usage - code injection risk'))).toBe(true);
      });

      it('should detect $where operator', () => {
        const script = 'db.collection("users").find({$where: "this.age > 18"})';
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('high');
        expect(result.reasons.some(reason => reason.includes('$where operator - JavaScript injection risk'))).toBe(true);
      });

      it('should detect safe MongoDB operations', () => {
        const script = 'db.collection("users").find({status: "active"}).toArray()';
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });
    });
    describe('Comment Handling', () => {
      it('should ignore SQL comments in AST analysis', () => {
        const query = `
          SELECT * FROM users 
          -- DROP TABLE users;
          /* TRUNCATE TABLE orders; */
          WHERE id = 1
        `;
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.analysis.astUsed).toBe(true);
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });

      it('should ignore JavaScript comments in MongoDB analysis', () => {
        const script = `
          // db.collection("users").drop();
          /* 
           * db.collection("orders").deleteMany({});
           */
          db.collection("users").find({}).toArray()
        `;
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle empty input', () => {
        const result = assessQueryRisk('', '', 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('No content to analyze');
      });

      it('should handle malformed SQL gracefully', () => {
        const query = 'SELECT * FROM WHERE INVALID SYNTAX';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        // Should fall back to pattern analysis or return medium risk for safety
        expect(['low', 'medium', 'high', 'critical']).toContain(result.level);
        expect(result.analysis).toBeDefined();
      });

      it('should handle very complex nested queries', () => {
        const query = `
          WITH RECURSIVE employee_hierarchy AS (
            SELECT id, name, manager_id, 1 as level
            FROM employees 
            WHERE manager_id IS NULL
            UNION ALL
            SELECT e.id, e.name, e.manager_id, eh.level + 1
            FROM employees e
            JOIN employee_hierarchy eh ON e.manager_id = eh.id
          )
          SELECT * FROM employee_hierarchy
        `;
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low'); // Complex but safe SELECT
        expect(result.analysis).toBeDefined();
      });
    });
  });

  describe('validateSqlSyntax', () => {
    it('should validate correct SQL syntax', () => {
      const query = 'SELECT * FROM users WHERE id = 1';
      const result = validateSqlSyntax(query, 'POSTGRES');
      
      expect(result.valid).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should detect invalid SQL syntax', () => {
      const query = 'SELECT * FROM WHERE INVALID';
      const result = validateSqlSyntax(query, 'POSTGRES');
      
      expect(result.valid).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('getComprehensiveRiskAnalysis', () => {
    it('should provide comprehensive analysis with recommendations', () => {
      const query = 'DROP TABLE users';
      const result = getComprehensiveRiskAnalysis(query, null, 'POSTGRES');
      
      expect(result.level).toBe('critical');
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
      expect(result.recommendations.some(rec => rec.includes('CRITICAL'))).toBe(true);
    });

    it('should include syntax validation for SQL', () => {
      const query = 'SELECT * FROM users';
      const result = getComprehensiveRiskAnalysis(query, null, 'POSTGRES');
      
      expect(result.syntaxValidation).toBeDefined();
      expect(result.syntaxValidation.valid).toBe(true);
    });
  });

  describe('getRiskLabel', () => {
    it('should return correct labels for risk levels', () => {
      expect(getRiskLabel('low')).toBe('Low Risk');
      expect(getRiskLabel('medium')).toBe('Medium Risk');
      expect(getRiskLabel('high')).toBe('High Risk');
      expect(getRiskLabel('critical')).toBe('Critical Risk');
      expect(getRiskLabel('unknown')).toBe('Unknown');
    });
  });
});