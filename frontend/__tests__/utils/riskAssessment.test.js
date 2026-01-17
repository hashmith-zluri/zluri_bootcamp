import { assessQueryRisk, getRiskLabel } from '../../src/utils/riskAssessment';

describe('Risk Assessment', () => {
  describe('assessQueryRisk', () => {
    describe('SQL comment handling', () => {
      it('should ignore SQL line comments (--)', () => {
        const query = 'SELECT * FROM users; --DROP TABLE users';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
        expect(result.reasons).not.toContain('DROP operation - deletes data permanently');
      });

      it('should ignore SQL block comments (/* */)', () => {
        const query = 'SELECT * FROM users /* DROP TABLE users */';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
        expect(result.reasons).not.toContain('DROP operation - deletes data permanently');
      });

      it('should ignore multiline SQL block comments', () => {
        const query = `SELECT * FROM users 
        /* 
        DROP TABLE users;
        TRUNCATE TABLE orders;
        */`;
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });

      it('should not ignore DROP when not in comments', () => {
        const query = 'DROP TABLE users; -- This is dangerous';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('critical');
        expect(result.reasons).toContain('DROP operation - deletes data permanently');
      });

      it('should preserve strings with comment-like content', () => {
        const query = "SELECT * FROM users WHERE comment = '-- not a comment'";
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });
    });

    describe('JavaScript comment handling', () => {
      it('should ignore JavaScript line comments (//)', () => {
        const script = `
        async function test() {
          // query('DROP TABLE users');
          const result = await query('SELECT * FROM users');
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
        expect(result.reasons).not.toContain('DROP operation - deletes data permanently');
      });

      it('should ignore JavaScript block comments (/* */)', () => {
        const script = `
        async function test() {
          /* query('DROP TABLE users'); */
          const result = await query('SELECT * FROM users');
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
        expect(result.reasons).not.toContain('DROP operation - deletes data permanently');
      });

      it('should ignore multiline JavaScript block comments', () => {
        const script = `
        async function test() {
          /*
          query('DROP TABLE users');
          query('TRUNCATE TABLE orders');
          */
          const result = await query('SELECT * FROM users');
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });

      it('should not ignore DROP when not in comments', () => {
        const script = `
        async function test() {
          // This is a comment
          const result = await query('DROP TABLE users');
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        
        expect(result.level).toBe('critical');
        expect(result.reasons).toContain('DROP operation - deletes data permanently');
      });

      it('should preserve strings with comment-like content', () => {
        const script = `
        async function test() {
          const comment = "// not a comment";
          const result = await query('SELECT * FROM users');
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });
    });

    describe('MongoDB comment handling', () => {
      it('should ignore JavaScript comments in MongoDB scripts', () => {
        const script = `
        async function test() {
          // db.collection('users').drop();
          const result = await db.collection('users').find({}).toArray();
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
        expect(result.reasons).not.toContain('DROP collection operation');
      });

      it('should not ignore DROP when not in comments', () => {
        const script = `
        async function test() {
          // This is a comment
          await db.collection('users').drop();
          return 'dropped';
        }`;
        const result = assessQueryRisk(null, script, 'MONGO');
        
        expect(result.level).toBe('critical');
        expect(result.reasons).toContain('DROP collection operation');
      });
    });

    describe('Complex comment scenarios', () => {
      it('should handle nested comments correctly', () => {
        const script = `
        async function test() {
          /*
          // This is a nested comment
          query('DROP TABLE users');
          */
          const result = await query('SELECT * FROM users');
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });

      it('should handle comments at end of lines', () => {
        const query = 'SELECT * FROM users WHERE id = 1; -- DROP TABLE users';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });

      it('should handle multiple comment types in same content', () => {
        const script = `
        async function test() {
          // Line comment with DROP
          /* Block comment with TRUNCATE */
          const result = await query('SELECT * FROM users');
          return result;
        }`;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });
    });

    describe('Original functionality', () => {
      it('should detect high risk operations without comments', () => {
        const query = 'DROP TABLE users';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('critical');
        expect(result.reasons).toContain('DROP operation - deletes data permanently');
      });

      it('should detect medium risk operations', () => {
        const query = 'INSERT INTO users (name) VALUES ("test")';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('medium');
        expect(result.reasons).toContain('INSERT operation - adds data');
      });

      it('should detect low risk operations', () => {
        const query = 'SELECT * FROM users';
        const result = assessQueryRisk(query, null, 'POSTGRES');
        
        expect(result.level).toBe('low');
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });
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