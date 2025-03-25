/**
 * Service to handle rate limiting of searches by IP address
 */

// The IP address that should have unlimited searches
const UNLIMITED_IP = '127.0.0.1'; // This will be dynamically determined

// Rate limit configuration
const MAX_SEARCHES = 10; // Increased from 5 to 10
const RATE_LIMIT_PERIOD_HOURS = 1; // Changed from 3 days to 1 hour

// Convert to milliseconds
const RATE_LIMIT_MS = RATE_LIMIT_PERIOD_HOURS * 60 * 60 * 1000;

// LocalStorage keys
const LS_SEARCH_COUNT = 'wikipedia_analyzer_search_count';
const LS_SEARCH_TIMESTAMP = 'wikipedia_analyzer_search_timestamp';

// Add a function to check if an IP should be unlimited
export const isUnlimitedIP = (ipAddress: string): boolean => {
  // Check if the IP is the localhost or your specific IP address
  return ipAddress === '127.0.0.1' || 
         ipAddress === 'localhost' || 
         ipAddress === '::1' ||
         ipAddress.startsWith('192.168.') || // Common local network range
         ipAddress.startsWith('10.') ||      // Common local network range
         ipAddress === 'unknown';            // If we couldn't determine the IP, don't limit it
};

/**
 * Check if a search is allowed
 * @returns Boolean indicating if search is allowed
 */
export const isSearchAllowed = (): boolean => {
  try {
    // Get saved data from localStorage
    const searchCount = parseInt(localStorage.getItem(LS_SEARCH_COUNT) || '0', 10);
    const timestamp = parseInt(localStorage.getItem(LS_SEARCH_TIMESTAMP) || '0', 10);
    const now = Date.now();
    
    // Reset if time period has expired
    if ((now - timestamp) > RATE_LIMIT_MS) {
      localStorage.setItem(LS_SEARCH_COUNT, '0');
      localStorage.setItem(LS_SEARCH_TIMESTAMP, now.toString());
      return true;
    }
    
    // Check if limit reached
    return searchCount < MAX_SEARCHES;
  } catch (e) {
    // If localStorage is not available, default to allowed
    console.error('Error checking rate limit', e);
    return true;
  }
};

/**
 * Increment the search count
 */
export const incrementSearchCount = (): void => {
  try {
    const searchCount = parseInt(localStorage.getItem(LS_SEARCH_COUNT) || '0', 10);
    const timestamp = parseInt(localStorage.getItem(LS_SEARCH_TIMESTAMP) || '0', 10);
    const now = Date.now();
    
    // Initialize or increment
    if (!timestamp) {
      localStorage.setItem(LS_SEARCH_TIMESTAMP, now.toString());
      localStorage.setItem(LS_SEARCH_COUNT, '1');
    } else {
      // Reset if time period has expired
      if ((now - timestamp) > RATE_LIMIT_MS) {
        localStorage.setItem(LS_SEARCH_TIMESTAMP, now.toString());
        localStorage.setItem(LS_SEARCH_COUNT, '1');
      } else {
        localStorage.setItem(LS_SEARCH_COUNT, (searchCount + 1).toString());
      }
    }
  } catch (e) {
    console.error('Error incrementing search count', e);
  }
};

/**
 * Get remaining searches count
 * @returns Number of searches remaining
 */
export const getRemainingSearches = (): number => {
  try {
    const searchCount = parseInt(localStorage.getItem(LS_SEARCH_COUNT) || '0', 10);
    const timestamp = parseInt(localStorage.getItem(LS_SEARCH_TIMESTAMP) || '0', 10);
    const now = Date.now();
    
    // Reset if time period has expired
    if (!timestamp || (now - timestamp) > RATE_LIMIT_MS) {
      return MAX_SEARCHES;
    }
    
    return Math.max(0, MAX_SEARCHES - searchCount);
  } catch (e) {
    console.error('Error getting remaining searches', e);
    return MAX_SEARCHES;
  }
};

/**
 * Get time until rate limit reset in milliseconds
 * @returns Time in milliseconds until reset
 */
export const getTimeUntilReset = (): number => {
  try {
    const timestamp = parseInt(localStorage.getItem(LS_SEARCH_TIMESTAMP) || '0', 10);
    const now = Date.now();
    
    if (!timestamp) {
      return 0;
    }
    
    const resetTime = timestamp + RATE_LIMIT_MS;
    return Math.max(0, resetTime - now);
  } catch (e) {
    console.error('Error getting time until reset', e);
    return 0;
  }
};

/**
 * Get human-readable time until reset
 * @returns String like "45 minutes" or "30 seconds"
 */
export const getReadableTimeUntilReset = (): string => {
  const ms = getTimeUntilReset();
  
  // Convert to minutes and seconds
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  } else {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
}; 