/**
 * Service to handle rate limiting of searches by IP address
 */

// The IP address that should have unlimited searches
const UNLIMITED_IP = '127.0.0.1'; // This will be dynamically determined

// Rate limit configuration
const MAX_SEARCHES = 5;
const RATE_LIMIT_PERIOD_DAYS = 3;

// In-memory storage for rate limiting (replace with database in production)
interface RateLimitEntry {
  count: number;
  timestamp: number;
}

const rateLimitStore: Record<string, RateLimitEntry> = {};

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
 * Check if a search should be allowed for the given IP address
 * @param ipAddress The IP address to check
 * @returns Whether the search is allowed
 */
export const isSearchAllowed = (ipAddress: string): boolean => {
  // Always allow searches from unlimited IPs
  if (isUnlimitedIP(ipAddress)) {
    return true;
  }

  // Get the current entry for this IP
  const entry = rateLimitStore[ipAddress];
  const now = Date.now();

  // If no entry exists or the entry is older than the rate limit period, allow and reset
  if (!entry || (now - entry.timestamp) > (RATE_LIMIT_PERIOD_DAYS * 24 * 60 * 60 * 1000)) {
    rateLimitStore[ipAddress] = {
      count: 1,
      timestamp: now
    };
    return true;
  }

  // If under the limit, increment and allow
  if (entry.count < MAX_SEARCHES) {
    entry.count += 1;
    return true;
  }

  // If over the limit, deny
  return false;
};

/**
 * Get the number of remaining searches for an IP address
 * @param ipAddress The IP address to check
 * @returns The number of remaining searches
 */
export const getRemainingSearches = (ipAddress: string): number => {
  if (isUnlimitedIP(ipAddress)) {
    return Infinity;
  }

  const entry = rateLimitStore[ipAddress];
  const now = Date.now();

  if (!entry || (now - entry.timestamp) > (RATE_LIMIT_PERIOD_DAYS * 24 * 60 * 60 * 1000)) {
    return MAX_SEARCHES;
  }

  return Math.max(0, MAX_SEARCHES - entry.count);
};

/**
 * Get the time until rate limit reset in milliseconds
 * @param ipAddress The IP address to check
 * @returns Time in milliseconds until reset, or 0 if no limit
 */
export const getTimeUntilReset = (ipAddress: string): number => {
  if (isUnlimitedIP(ipAddress)) {
    return 0;
  }

  const entry = rateLimitStore[ipAddress];
  const now = Date.now();

  if (!entry) {
    return 0;
  }

  const resetTime = entry.timestamp + (RATE_LIMIT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  return Math.max(0, resetTime - now);
}; 