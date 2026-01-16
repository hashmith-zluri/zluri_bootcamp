import { assessQueryRisk, getRiskLabel } from '../../src/utils/riskAssessment';

describe('Risk Assessment', () => {
  describe('assessQueryRisk', () => {
    describe('Low risk queries', () => {
      it('should assess SELECT query as low risk', () => {
        const result = assessQueryRisk('SELECT * FROM users', null, 'POSTGRES');
        expect(result.level).toBe('low');
        expect(result.riskScore).toBe(0);
        expect(result.reasons).toContain('Read-only operation - safe to execute');
      });

      it('should assess MongoDB find as low risk', () => {
        const result = assessQueryRisk(null, 'db.users.find({})', 'MONGO');
        expect(result.level).toBe('low');
      });

      it('should handle null query and script', () => {
        const result = assessQueryRisk(null, null, 'POSTGRES');
        expect(result.level).toBe('low');
      });

      it('should handle empty string query', () => {
        const result = assessQueryRisk('', null, 'POSTGRES');
        expect(result.level).toBe('low');
      });
    });

    describe('Medium risk queries', () => {
      it('should assess INSERT as medium risk', () => {
        const result = assessQueryRisk('INSERT INTO users (name) VALUES (\'John\')', null, 'POSTGRES');
        expect(result.level).toBe('medium');
        expect(result.reasons).toContain('INSERT operation - adds data');
      });

      it('should assess DELETE with WHERE as medium risk', () => {
        const result = assessQueryRisk('DELETE FROM users WHERE id = 1', null, 'POSTGRES');
        expect(result.level).toBe('medium');
      });

      it('should assess CREATE TABLE as medium risk', () => {
        const result = assessQueryRisk('CREATE TABLE test (id INT)', null, 'POSTGRES');
        expect(result.level).toBe('medium');
      });

      it('should assess MongoDB insertOne as medium risk', () => {
        const result = assessQueryRisk(null, 'db.users.insertOne({name: "John"})', 'MONGO');
        expect(result.level).toBe('medium');
      });

      it('should assess MongoDB updateOne as medium risk', () => {
        const result = assessQueryRisk(null, 'db.users.updateOne({id: 1}, {$set: {name: "Jane"}})', 'MONGO');
        expect(result.level).toBe('medium');
      });

      it('should assess MongoDB deleteOne as medium risk', () => {
        const result = assessQueryRisk(null, 'db.users.deleteOne({id: 1})', 'MONGO');
        expect(result.level).toBe('medium');
      });

      it('should assess MongoDB insertMany as medium risk', () => {
        const result = assessQueryRisk(null, 'db.users.insertMany([{name: "John"}])', 'MONGO');
        expect(result.level).toBe('medium');
      });

      it('should assess MongoDB deleteManyWithFilter as medium risk', () => {
        const result = assessQueryRisk(null, 'db.users.deleteMany({status: "inactive"})', 'MONGO');
        expect(result.level).toBe('medium');
      });

      it('should assess MongoDB updateManyWithFilter as medium risk', () => {
        const result = assessQueryRisk(null, 'db.users.updateMany({status: "active"}, {$set: {verified: true}})', 'MONGO');
        expect(result.level).toBe('medium');
      });

      it('should assess dynamic SQL execution as medium risk', () => {
        const result = assessQueryRisk('EXEC(@sql)', null, 'POSTGRES');
        expect(result.level).toBe('medium');
      });

      it('should assess EXECUTE as medium risk', () => {
        const result = assessQueryRisk('EXECUTE(query)', null, 'POSTGRES');
        expect(result.level).toBe('medium');
      });
    });

    describe('High risk queries', () => {
      it('should assess ALTER TABLE as high risk', () => {
        const result = assessQueryRisk('ALTER TABLE users ADD COLUMN age INT', null, 'POSTGRES');
        expect(result.level).toBe('high');
        expect(result.reasons).toContain('ALTER operation - modifies database structure');
      });

      it('should assess GRANT as high risk', () => {
        const result = assessQueryRisk('GRANT ALL ON users TO admin', null, 'POSTGRES');
        expect(result.level).toBe('high');
      });

      it('should assess REVOKE as high risk', () => {
        const result = assessQueryRisk('REVOKE ALL ON users FROM admin', null, 'POSTGRES');
        expect(result.level).toBe('high');
      });

      it('should assess CREATE USER as high risk', () => {
        const result = assessQueryRisk('CREATE USER admin WITH PASSWORD \'pass\'', null, 'POSTGRES');
        expect(result.level).toBe('high');
      });

      it('should assess DROP USER as high risk', () => {
        const result = assessQueryRisk('DROP USER admin', null, 'POSTGRES');
        expect(result.level).toBe('high');
      });
    });

    describe('Critical risk queries', () => {
      it('should assess DROP TABLE as critical risk', () => {
        const result = assessQueryRisk('DROP TABLE users', null, 'POSTGRES');
        expect(result.level).toBe('critical');
        expect(result.reasons).toContain('DROP operation - deletes data permanently');
      });

      it('should assess DROP DATABASE as critical risk', () => {
        const result = assessQueryRisk('DROP DATABASE test_db', null, 'POSTGRES');
        expect(result.level).toBe('critical');
      });

      it('should assess DROP SCHEMA as critical risk', () => {
        const result = assessQueryRisk('DROP SCHEMA public', null, 'POSTGRES');
        expect(result.level).toBe('critical');
      });

      it('should assess DROP COLLECTION as critical risk', () => {
        const result = assessQueryRisk('DROP COLLECTION users', null, 'MONGO');
        expect(result.level).toBe('critical');
      });

      it('should assess TRUNCATE as critical risk', () => {
        const result = assessQueryRisk('TRUNCATE TABLE users', null, 'POSTGRES');
        expect(result.level).toBe('critical');
      });

      it('should assess MongoDB drop as critical risk', () => {
        const result = assessQueryRisk(null, 'db.users.drop()', 'MONGO');
        expect(result.level).toBe('critical');
      });

      it('should assess DELETE without WHERE as critical risk', () => {
        const result = assessQueryRisk('DELETE FROM users;', null, 'POSTGRES');
        expect(result.level).toBe('critical');
      });

      it('should assess UPDATE without WHERE as critical risk', () => {
        const result = assessQueryRisk('UPDATE users SET active = false;', null, 'POSTGRES');
        expect(result.level).toBe('critical');
      });

      it('should assess MongoDB deleteMany with empty filter as critical risk', () => {
        const result = assessQueryRisk(null, 'db.users.deleteMany({})', 'MONGO');
        expect(result.level).toBe('critical');
      });

      it('should assess MongoDB updateMany with empty filter as critical risk', () => {
        const result = assessQueryRisk(null, 'db.users.updateMany({}, {$set: {active: false}})', 'MONGO');
        expect(result.level).toBe('critical');
      });

      it('should assess MongoDB remove with empty filter as high risk', () => {
        const result = assessQueryRisk(null, 'db.users.remove({})', 'MONGO');
        expect(result.level).toBe('high');
      });
    });

    describe('Script risk assessment', () => {
      it('should assess script with loops and write operations', () => {
        const script = 'for (let i = 0; i < 100; i++) { query(\'DELETE FROM logs WHERE id = \' + i); }';
        const result = assessQueryRisk(null, script, 'POSTGRES');
        expect(result.riskScore).toBeGreaterThan(0);
      });

      it('should assess script with multiple write operations', () => {
        const script = `
          query('DELETE FROM logs WHERE id = 1');
          query('DELETE FROM logs WHERE id = 2');
          query('DELETE FROM logs WHERE id = 3');
          query('DELETE FROM logs WHERE id = 4');
          query('DELETE FROM logs WHERE id = 5');
          query('DELETE FROM logs WHERE id = 6');
        `;
        const result = assessQueryRisk(null, script, 'POSTGRES');
        expect(result.reasons).toContain('Multiple write operations detected (6)');
      });

      it('should not flag read-only loops', () => {
        const script = 'users.forEach(user => { console.log(user.name); });';
        const result = assessQueryRisk(null, script, 'POSTGRES');
        expect(result.level).toBe('low');
      });

      it('should detect while loops with write operations', () => {
        const script = 'while (true) { query(\'UPDATE users SET status = active\'); db.test(); }';
        const result = assessQueryRisk(null, script, 'POSTGRES');
        expect(result.riskScore).toBeGreaterThan(0);
      });
    });

    describe('Case insensitivity', () => {
      it('should detect DROP in lowercase', () => {
        const result = assessQueryRisk('drop table users', null, 'POSTGRES');
        expect(result.level).toBe('critical');
      });

      it('should detect mixed case operations', () => {
        const result = assessQueryRisk('DeLeTe FrOm users WHERE id = 1', null, 'POSTGRES');
        expect(result.level).toBe('medium');
      });
    });

    describe('Return value structure', () => {
      it('should return all required properties', () => {
        const result = assessQueryRisk('SELECT * FROM users', null, 'POSTGRES');
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('color');
        expect(result).toHaveProperty('bgColor');
        expect(result).toHaveProperty('borderColor');
        expect(result).toHaveProperty('icon');
        expect(result).toHaveProperty('riskScore');
        expect(result).toHaveProperty('reasons');
      });

      it('should have correct colors for low risk', () => {
        const result = assessQueryRisk('SELECT * FROM users', null, 'POSTGRES');
        expect(result.color).toBe('text-green-700');
        expect(result.bgColor).toBe('bg-green-50');
        expect(result.borderColor).toBe('border-green-300');
      });

      it('should have correct colors for medium risk', () => {
        const result = assessQueryRisk('INSERT INTO users VALUES (1)', null, 'POSTGRES');
        expect(result.color).toBe('text-yellow-700');
        expect(result.bgColor).toBe('bg-yellow-50');
      });

      it('should have correct colors for high risk', () => {
        const result = assessQueryRisk('ALTER TABLE users ADD COLUMN age INT', null, 'POSTGRES');
        expect(result.color).toBe('text-red-700');
        expect(result.bgColor).toBe('bg-red-50');
      });

      it('should have correct colors for critical risk', () => {
        const result = assessQueryRisk('DROP TABLE users', null, 'POSTGRES');
        expect(result.color).toBe('text-pink-700');
        expect(result.bgColor).toBe('bg-pink-50');
      });

      it('should remove duplicate reasons', () => {
        const result = assessQueryRisk('INSERT INTO users VALUES (1); INSERT INTO logs VALUES (2);', null, 'POSTGRES');
        const insertReasons = result.reasons.filter(r => r.includes('INSERT'));
        expect(insertReasons.length).toBe(1);
      });
    });
  });

  describe('getRiskLabel', () => {
    it('should return correct labels', () => {
      expect(getRiskLabel('low')).toBe('Low Risk');
      expect(getRiskLabel('medium')).toBe('Medium Risk');
      expect(getRiskLabel('high')).toBe('High Risk');
      expect(getRiskLabel('critical')).toBe('Critical Risk');
    });

    it('should return Unknown for invalid level', () => {
      expect(getRiskLabel('invalid')).toBe('Unknown');
      expect(getRiskLabel(null)).toBe('Unknown');
      expect(getRiskLabel(undefined)).toBe('Unknown');
    });
  });
});
