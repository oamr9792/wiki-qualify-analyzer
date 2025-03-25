import { getSourceReliabilityScore } from '../data/sourceReliability';

// Add this to your existing scoring function
export function calculateSourceScore(url: string): number {
  try {
    const domain = new URL(url).hostname;
    return getSourceReliabilityScore(domain);
  } catch (error) {
    console.error("Error parsing URL for source scoring:", error);
    return 5; // Default for unparseable URLs
  }
}

// Update your main scoring algorithm to include this
export function calculateOverallScore(article: ArticleData): number {
  // ... existing scoring logic
  
  // Add source reliability component
  const sourceScore = calculateSourceScore(article.url);
  
  // Integrate this with your existing scoring formula
  // For example:
  const weightedSourceScore = sourceScore * 0.3; // 30% weight to source reliability
  
  // ... continue with other scoring factors
  
  return finalScore;
} 