/**
 * Validation Utilities - Handle input validation and form validation
 * Single responsibility: Data validation and error handling
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }
  
  // Remove all non-numeric characters for validation
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length < 10 || cleaned.length > 15) {
    return { valid: false, error: 'Phone number must be 10-15 digits' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {Object} Validation result
 */
export const validateRequired = (value, fieldName = 'Field') => {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate text length
 * @param {string} text - Text to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @param {string} fieldName - Field name for error message
 * @returns {Object} Validation result
 */
export const validateTextLength = (text, minLength = 0, maxLength = Infinity, fieldName = 'Text') => {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  if (text.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (text.length > maxLength) {
    return { valid: false, error: `${fieldName} must be no more than ${maxLength} characters` };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {Object} Validation result
 */
export const validateURL = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  
  try {
    new URL(url);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with strength level
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required', strength: 'none' };
  }
  
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength) {
    return { 
      valid: false, 
      error: `Password must be at least ${minLength} characters`, 
      strength: 'weak' 
    };
  }
  
  const strengthScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
    .filter(Boolean).length;
  
  let strength, valid = true, error = null;
  
  if (strengthScore < 2) {
    strength = 'weak';
    valid = false;
    error = 'Password must contain at least 2 of: uppercase, lowercase, numbers, special characters';
  } else if (strengthScore < 3) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }
  
  return { valid, error, strength };
};

/**
 * Validate number range
 * @param {number} value - Number to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} fieldName - Field name for error message
 * @returns {Object} Validation result
 */
export const validateNumberRange = (value, min = -Infinity, max = Infinity, fieldName = 'Value') => {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }
  
  if (value < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  
  if (value > max) {
    return { valid: false, error: `${fieldName} must be no more than ${max}` };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate array of items
 * @param {Array} array - Array to validate
 * @param {number} minItems - Minimum number of items
 * @param {number} maxItems - Maximum number of items
 * @param {string} fieldName - Field name for error message
 * @returns {Object} Validation result
 */
export const validateArray = (array, minItems = 0, maxItems = Infinity, fieldName = 'Items') => {
  if (!Array.isArray(array)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }
  
  if (array.length < minItems) {
    return { valid: false, error: `${fieldName} must have at least ${minItems} items` };
  }
  
  if (array.length > maxItems) {
    return { valid: false, error: `${fieldName} must have no more than ${maxItems} items` };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate form data with multiple fields
 * @param {Object} data - Form data to validate
 * @param {Object} rules - Validation rules for each field
 * @returns {Object} Validation result with field-specific errors
 */
export const validateForm = (data, rules) => {
  const errors = {};
  let isValid = true;
  
  Object.keys(rules).forEach(fieldName => {
    const fieldValue = data[fieldName];
    const fieldRules = rules[fieldName];
    
    // Apply each validation rule for the field
    fieldRules.forEach(rule => {
      if (errors[fieldName]) return; // Skip if already has error
      
      const result = rule(fieldValue, fieldName);
      if (!result.valid) {
        errors[fieldName] = result.error;
        isValid = false;
      }
    });
  });
  
  return { valid: isValid, errors };
};

/**
 * Sanitize input text (remove potentially harmful content)
 * @param {string} input - Input text to sanitize
 * @returns {string} Sanitized text
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove HTML tags and potentially harmful characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, '') // Remove potentially harmful characters
    .trim();
};

/**
 * Validate file upload data
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateFileUpload = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    required = true
  } = options;
  
  if (!file && required) {
    return { valid: false, error: 'File is required' };
  }
  
  if (!file) {
    return { valid: true, error: null };
  }
  
  if (file.size > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File size must be less than ${sizeMB}MB` };
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
  }
  
  return { valid: true, error: null };
};
