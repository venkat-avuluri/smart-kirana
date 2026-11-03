/**
 * Indian Rupee (INR) and Kirana formatting utilities
 */

/**
 * Format integer paise to Indian Rupee string (e.g., 12550 -> ₹125.50)
 * Uses standard en-IN locale
 * @param {number} paise 
 * @returns {string} Formatted currency
 */
export const formatINR = (paise = 0) => {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(rupees);
};

/**
 * Convert rupees (e.g., 25.5) to integer paise (2550) to prevent float issues
 * @param {number|string} rupees 
 * @returns {number} Integer paise
 */
export const rupeesToPaise = (rupees = 0) => {
  return Math.round(Number(rupees) * 100);
};

/**
 * Convert integer paise to decimal rupees for form inputs
 * @param {number} paise 
 * @returns {number} Decimal rupees
 */
export const paiseToRupees = (paise = 0) => {
  return (Number(paise) || 0) / 100;
};

/**
 * Format Date to readable Indian format: DD MMM YYYY, hh:mm A
 * @param {string|Date} date 
 * @returns {string} Formatted date string
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

/**
 * Format Date to simple: DD/MM/YYYY
 * @param {string|Date} date 
 * @returns {string} Formatted date string
 */
export const formatDateOnly = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};
