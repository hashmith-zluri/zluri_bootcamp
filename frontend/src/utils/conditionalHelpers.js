// Utility functions to reduce nested conditions

/**
 * Safely executes a function if condition is met
 * @param {boolean} condition - The condition to check
 * @param {Function} fn - The function to execute
 * @param {...any} args - Arguments to pass to the function
 * @returns {any} Result of function execution or undefined
 */
export const executeIf = (condition, fn, ...args) => {
  return condition ? fn(...args) : undefined;
};

/**
 * Returns the first truthy value from an array of functions/values
 * @param {...any} values - Values or functions to evaluate
 * @returns {any} First truthy value
 */
export const firstTruthy = (...values) => {
  for (const value of values) {
    const result = typeof value === 'function' ? value() : value;
    if (result) return result;
  }
  return null;
};

/**
 * Safely gets nested object properties
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g., 'user.profile.name')
 * @param {any} defaultValue - Default value if path doesn't exist
 * @returns {any} The value at the path or default value
 */
export const safeGet = (obj, path, defaultValue = null) => {
  try {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * Checks if any of the provided conditions are true
 * @param {...any} conditions - Conditions to check
 * @returns {boolean} True if any condition is truthy
 */
export const anyTrue = (...conditions) => {
  return conditions.some(condition => 
    typeof condition === 'function' ? condition() : condition
  );
};

/**
 * Checks if all of the provided conditions are true
 * @param {...any} conditions - Conditions to check
 * @returns {boolean} True if all conditions are truthy
 */
export const allTrue = (...conditions) => {
  return conditions.every(condition => 
    typeof condition === 'function' ? condition() : condition
  );
};

/**
 * Creates a switch-like object for cleaner conditional logic
 * @param {any} value - The value to match against
 * @param {Object} cases - Object with case values as keys and handlers as values
 * @param {any} defaultCase - Default value/function if no case matches
 * @returns {any} Result of matched case or default
 */
export const switchCase = (value, cases, defaultCase = null) => {
  const handler = cases[value] || defaultCase;
  return typeof handler === 'function' ? handler() : handler;
};

/**
 * Validates multiple conditions and returns the first error message
 * @param {Array} validations - Array of [condition, errorMessage] pairs
 * @returns {string|null} First error message or null if all valid
 */
export const validateConditions = (validations) => {
  for (const [condition, errorMessage] of validations) {
    if (!condition) return errorMessage;
  }
  return null;
};

/**
 * Chains multiple transformations on a value
 * @param {any} value - Initial value
 * @param {...Function} transformers - Functions to apply in sequence
 * @returns {any} Final transformed value
 */
export const pipe = (value, ...transformers) => {
  return transformers.reduce((acc, transformer) => transformer(acc), value);
};