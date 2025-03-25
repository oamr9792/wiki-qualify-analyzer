/**
 * Utility functions for scoring domains
 */

/**
 * Conservative algorithm to score domains based on Wikipedia citation count
 * @param citationCount Number of times the domain is cited in Wikipedia
 * @returns A reliability score from 0-6
 */
export function scoreDomainByCitationCount(citationCount: number): number {
  if (citationCount >= 200) return 6;
  if (citationCount >= 100) return 4;
  if (citationCount >= 25) return 3;
  if (citationCount >= 5) return 2;
  if (citationCount >= 1) return 1;
  return 0;
}

/**
 * Maps a citation score to a Wikipedia reliability category
 * @param score The score from scoreDomainByCitationCount
 * @returns The reliability category
 */
export function mapScoreToReliability(score: number): 'highlyReliable' | 'moderatelyReliable' | 'unreliable' {
  if (score >= 4) {
    return 'highlyReliable';
  } else if (score >= 2) {
    return 'moderatelyReliable';
  } else {
    return 'unreliable';
  }
} 