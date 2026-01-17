import {
  executeIf,
  firstTruthy,
  safeGet,
  anyTrue,
  allTrue,
  switchCase,
  validateConditions,
  pipe
} from '../../src/utils/conditionalHelpers';

describe('conditionalHelpers', () => {
  describe('executeIf', () => {
    it('should execute function when condition is true', () => {
      const mockFn = jest.fn(() => 'result');
      const result = executeIf(true, mockFn, 'arg1', 'arg2');
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('result');
    });

    it('should not execute function when condition is false', () => {
      const mockFn = jest.fn();
      const result = executeIf(false, mockFn);
      
      expect(mockFn).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('firstTruthy', () => {
    it('should return first truthy value', () => {
      const result = firstTruthy(false, null, 'first', 'second');
      expect(result).toBe('first');
    });

    it('should execute functions and return first truthy result', () => {
      const result = firstTruthy(
        () => false,
        () => null,
        () => 'function result'
      );
      expect(result).toBe('function result');
    });

    it('should return null if no truthy values', () => {
      const result = firstTruthy(false, null, undefined);
      expect(result).toBeNull();
    });
  });

  describe('safeGet', () => {
    const testObj = {
      user: {
        profile: {
          name: 'John'
        }
      }
    };

    it('should get nested property', () => {
      const result = safeGet(testObj, 'user.profile.name');
      expect(result).toBe('John');
    });

    it('should return default value for non-existent path', () => {
      const result = safeGet(testObj, 'user.profile.age', 'unknown');
      expect(result).toBe('unknown');
    });

    it('should return null for non-existent path without default', () => {
      const result = safeGet(testObj, 'user.settings.theme');
      expect(result).toBeNull();
    });
  });

  describe('anyTrue', () => {
    it('should return true if any condition is true', () => {
      const result = anyTrue(false, true, false);
      expect(result).toBe(true);
    });

    it('should return false if all conditions are false', () => {
      const result = anyTrue(false, false, false);
      expect(result).toBe(false);
    });

    it('should work with functions', () => {
      const result = anyTrue(() => false, () => true);
      expect(result).toBe(true);
    });
  });

  describe('allTrue', () => {
    it('should return true if all conditions are true', () => {
      const result = allTrue(true, true, true);
      expect(result).toBe(true);
    });

    it('should return false if any condition is false', () => {
      const result = allTrue(true, false, true);
      expect(result).toBe(false);
    });

    it('should work with functions', () => {
      const result = allTrue(() => true, () => true);
      expect(result).toBe(true);
    });
  });

  describe('switchCase', () => {
    const cases = {
      'option1': 'result1',
      'option2': () => 'result2'
    };

    it('should return matching case value', () => {
      const result = switchCase('option1', cases);
      expect(result).toBe('result1');
    });

    it('should execute matching case function', () => {
      const result = switchCase('option2', cases);
      expect(result).toBe('result2');
    });

    it('should return default case for no match', () => {
      const result = switchCase('option3', cases, 'default');
      expect(result).toBe('default');
    });
  });

  describe('validateConditions', () => {
    it('should return null if all conditions are valid', () => {
      const validations = [
        [true, 'Error 1'],
        [true, 'Error 2']
      ];
      const result = validateConditions(validations);
      expect(result).toBeNull();
    });

    it('should return first error message', () => {
      const validations = [
        [true, 'Error 1'],
        [false, 'Error 2'],
        [false, 'Error 3']
      ];
      const result = validateConditions(validations);
      expect(result).toBe('Error 2');
    });
  });

  describe('pipe', () => {
    it('should apply transformations in sequence', () => {
      const add1 = (x) => x + 1;
      const multiply2 = (x) => x * 2;
      const toString = (x) => x.toString();
      
      const result = pipe(5, add1, multiply2, toString);
      expect(result).toBe('12');
    });

    it('should work with single transformation', () => {
      const result = pipe(5, x => x * 2);
      expect(result).toBe(10);
    });
  });
});