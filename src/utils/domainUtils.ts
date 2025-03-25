/**
 * List of known multi-part TLDs that should be treated specially
 * This is a simplified list; a complete list would be much longer
 */
const MULTI_PART_TLDS = [
  'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.in', 'co.id', 'co.il',
  'com.au', 'com.br', 'com.mx', 'com.ar', 'com.sg', 'com.tr', 'com.hk', 'com.cn'
];

/**
 * Map of domain aliases to their canonical forms
 */
const DOMAIN_ALIASES: Record<string, string> = {
  'youtu.be': 'youtube.com',
  'goo.gl': 'google.com',
  'wapo.st': 'washingtonpost.com',
  'nyti.ms': 'nytimes.com',
  'on.wsj.com': 'wsj.com',
  't.co': 'twitter.com',
  'ny.com': 'nytimes.com',
  'go.com': 'abc.go.com',
  'fb.com': 'facebook.com',
  'bloomberg.net': 'bloomberg.com',
  'bit.ly': 'bitly.com',
  'msn.com': 'microsoft.com',
  'news.bbc.co.uk': 'bbc.co.uk'
};

/**
 * List of known major domain services that may have localized versions
 */
const MAJOR_SERVICES = [
  'google', 'facebook', 'twitter', 'linkedin', 'amazon', 'microsoft',
  'apple', 'yahoo', 'netflix', 'ebay', 'spotify', 'github', 'medium',
  'bloomberg', 'reuters', 'bbc', 'cnn', 'nytimes', 'wsj', 'guardian'
];

/**
 * Normalizes a domain to handle localized versions and subdomains
 * @param domain Domain to normalize (e.g., "il.linkedin.com")
 * @returns Normalized domain (e.g., "linkedin.com")
 */
export function normalizeDomain(domain: string): string {
  // Remove 'www.' prefix
  let normalizedDomain = domain.replace(/^www\./, '');
  
  // Direct alias replacement
  if (DOMAIN_ALIASES[normalizedDomain]) {
    return DOMAIN_ALIASES[normalizedDomain];
  }
  
  // Handle multi-part TLDs
  for (const tld of MULTI_PART_TLDS) {
    if (normalizedDomain.endsWith(`.${tld}`)) {
      const parts = normalizedDomain.split('.');
      if (parts.length > 3) {
        // Get the main domain without country/region subdomains
        // e.g., "uk.reuters.co.jp" -> "reuters.co.jp"
        // This keeps the last 3 parts (main domain + multi-part TLD)
        return parts.slice(-3).join('.');
      }
      return normalizedDomain;
    }
  }
  
  // Handle localized versions of major services
  // For domains like fr.linkedin.com, uk.reuters.com, etc.
  const domainParts = normalizedDomain.split('.');
  
  if (domainParts.length > 2) {
    // Check if it's a localized version of a major service
    // This looks at the middle part of domains like "fr.linkedin.com"
    const potentialService = domainParts[domainParts.length - 2]; // e.g., "linkedin" from "fr.linkedin.com"
    
    if (MAJOR_SERVICES.includes(potentialService)) {
      // Return the normalized form, e.g., "linkedin.com"
      return `${potentialService}.${domainParts[domainParts.length - 1]}`;
    }
    
    // Default to the last two parts for other subdomains
    // e.g., "mail.google.com" -> "google.com"
    return domainParts.slice(-2).join('.');
  }
  
  return normalizedDomain;
}

/**
 * Gets the base/effective domain from a URL
 * @param url Full URL or domain
 * @returns Normalized domain
 */
export function getEffectiveDomain(url: string): string {
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return normalizeDomain(domain);
  } catch (e) {
    // If parsing fails, just try to normalize the input directly
    return normalizeDomain(url);
  }
} 