import { getEffectiveDomain } from '@/utils/domainUtils';
import { getSourceReliability } from '@/utils/wikipediaSourceReliability';

/**
 * Analyze sources and categorize them based on reliability
 * @param sources List of source URLs
 * @returns Object with categorized sources
 */
export function analyzeSourceReliability(sources: string[]) {
  const result = {
    highlyReliableSources: [] as string[],
    moderatelyReliableSources: [] as string[],
    unreliableSources: [] as string[],
    deprecatedSources: [] as string[],
    notEnoughDataSources: [] as string[],
    highlyReliableCount: 0,
    moderatelyReliableCount: 0,
    unreliableCount: 0,
    deprecatedCount: 0,
    notEnoughDataCount: 0
  };

  // Process each source
  sources.forEach(source => {
    const reliabilityData = getSourceReliability(source);
    const domain = getEffectiveDomain(source);
    
    // Only categorize based on exact reliability ratings from our predefined list
    if (reliabilityData.reliability === "Generally reliable") {
      result.highlyReliableSources.push(domain);
      result.highlyReliableCount++;
    } else if (reliabilityData.reliability === "No consensus") {
      result.moderatelyReliableSources.push(domain);
      result.moderatelyReliableCount++;
    } else if (reliabilityData.reliability === "Generally unreliable") {
      result.unreliableSources.push(domain);
      result.unreliableCount++;
    } else if (reliabilityData.reliability === "Deprecated") {
      // Only mark as deprecated if explicitly in our list with that rating
      result.deprecatedSources.push(domain);
      result.deprecatedCount++;
    } else if (reliabilityData.reliability === "Not enough data") {
      // For domains not in our list
      result.notEnoughDataSources.push(domain);
      result.notEnoughDataCount++;
    }
  });

  return result;
} 