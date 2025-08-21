/**
 * Format Utilities - Handle data formatting and display
 * Single responsibility: Data formatting, date handling, and display helpers
 */

/**
 * Format matching score for display
 * @param {number} score - Score between 0-100
 * @returns {string} Formatted score with percentage
 */
export const formatScore = (score) => {
  if (typeof score !== 'number' || isNaN(score)) return '0%';
  return `${Math.round(score)}%`;
};

/**
 * Format percentage with precision
 * @param {number} value - Decimal value (0.0 - 1.0)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, decimals = 1) => {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  try {
    return new Intl.DateTimeFormat('en-US', formatOptions).format(new Date(date));
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

/**
 * Format time duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '0s';
  
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Format processing time for display
 * @param {number} time - Processing time in seconds
 * @returns {string} Human-readable processing time
 */
export const formatProcessingTime = (time) => {
  if (time < 1) return `${Math.round(time * 1000)}ms`;
  return `${time.toFixed(2)}s`;
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Capitalize first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} Title case text
 */
export const toTitleCase = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

/**
 * Format skill list for display
 * @param {string[]} skills - Array of skills
 * @param {number} maxVisible - Maximum skills to show
 * @returns {Object} Formatted skills with overflow info
 */
export const formatSkillsList = (skills, maxVisible = 5) => {
  if (!Array.isArray(skills)) return { visible: [], hidden: 0 };
  
  const visible = skills.slice(0, maxVisible);
  const hidden = Math.max(0, skills.length - maxVisible);
  
  return { visible, hidden };
};

/**
 * Format job title for display
 * @param {string} title - Job title
 * @returns {string} Formatted job title
 */
export const formatJobTitle = (title) => {
  if (!title || typeof title !== 'string') return 'Not Specified';
  return toTitleCase(title.trim());
};

/**
 * Format experience years
 * @param {string|number} experience - Experience in years
 * @returns {string} Formatted experience
 */
export const formatExperience = (experience) => {
  if (!experience) return 'Not Specified';
  if (typeof experience === 'number') return `${experience} years`;
  return experience.toString();
};

/**
 * Format phone number for display
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return 'Not Provided';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone; // Return original if can't format
};

/**
 * Format email for display (with privacy option)
 * @param {string} email - Email address
 * @param {boolean} mask - Whether to mask part of email
 * @returns {string} Formatted email
 */
export const formatEmail = (email, mask = false) => {
  if (!email || typeof email !== 'string') return 'Not Provided';
  
  if (!mask) return email;
  
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  
  const maskedLocal = localPart.length > 2 
    ? `${localPart[0]}***${localPart[localPart.length - 1]}`
    : '***';
    
  return `${maskedLocal}@${domain}`;
};

/**
 * Format number with commas for thousands
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return num.toLocaleString();
};

/**
 * Format match status for display
 * @param {string} status - Match status
 * @returns {Object} Status with display properties
 */
export const formatMatchStatus = (status) => {
  const statusMap = {
    'pending': { label: 'Pending', color: 'yellow', icon: '⏳' },
    'processing': { label: 'Processing', color: 'blue', icon: '⚡' },
    'completed': { label: 'Completed', color: 'green', icon: '✅' },
    'failed': { label: 'Failed', color: 'red', icon: '❌' },
    'cancelled': { label: 'Cancelled', color: 'gray', icon: '⏹️' }
  };
  
  return statusMap[status] || { label: status, color: 'gray', icon: '❓' };
};
