
import { toast } from "sonner";

// Types for our API responses
export interface WikipediaMetrics {
  notability: NotabilityScore;
  references: ReferenceAnalysis;
  contentQuality: ContentQualityScore;
  eligibilityScore: number;
  suggestions: string[];
}

interface NotabilityScore {
  score: number;
  factors: {
    relevance: number;
    recognition: number;
    impact: number;
  };
  description: string;
}

interface ReferenceAnalysis {
  count: number;
  quality: number;
  diversity: number;
  reliability: number;
  description: string;
}

interface ContentQualityScore {
  score: number;
  factors: {
    neutrality: number;
    comprehensiveness: number;
    structure: number;
  };
  description: string;
}

// Simulate API call with realistic Wikipedia eligibility analysis
export async function analyzeWikipediaEligibility(url: string): Promise<WikipediaMetrics> {
  try {
    // For demo purposes, we'll simulate a network request
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // This would be replaced with actual API call in production
    // e.g. return fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ url }) }).then(res => res.json())
    
    // Simulate different responses based on input
    if (!url || !url.trim()) {
      throw new Error("Please enter a valid URL");
    }
    
    const randomScore = () => Math.floor(Math.random() * 100) / 100;
    const randomScoreWeighted = (bias: number) => Math.min(1, Math.max(0, (randomScore() * 0.5) + (bias * 0.5)));
    
    // Determine if this is a high or low quality submission based on the URL
    const isHighQuality = url.includes("notable") || url.includes("verified") || url.length > 30;
    const qualityBias = isHighQuality ? 0.8 : 0.3;
    
    const result: WikipediaMetrics = {
      notability: {
        score: randomScoreWeighted(qualityBias),
        factors: {
          relevance: randomScoreWeighted(qualityBias),
          recognition: randomScoreWeighted(qualityBias),
          impact: randomScoreWeighted(qualityBias),
        },
        description: isHighQuality 
          ? "The subject demonstrates significant recognition in its field."
          : "The subject may not meet Wikipedia's notability guidelines."
      },
      references: {
        count: isHighQuality ? Math.floor(Math.random() * 30) + 15 : Math.floor(Math.random() * 8) + 2,
        quality: randomScoreWeighted(qualityBias),
        diversity: randomScoreWeighted(qualityBias),
        reliability: randomScoreWeighted(qualityBias),
        description: isHighQuality
          ? "The source material is diverse and from reliable sources."
          : "The references need improvement in quality and diversity."
      },
      contentQuality: {
        score: randomScoreWeighted(qualityBias),
        factors: {
          neutrality: randomScoreWeighted(qualityBias),
          comprehensiveness: randomScoreWeighted(qualityBias),
          structure: randomScoreWeighted(qualityBias),
        },
        description: isHighQuality
          ? "The content is well-structured and maintains a neutral point of view."
          : "The content requires more neutral tone and better structure."
      },
      eligibilityScore: randomScoreWeighted(qualityBias),
      suggestions: isHighQuality
        ? [
            "Consider adding more international sources",
            "Expand the impact section with concrete examples",
            "Include information about recent developments"
          ]
        : [
            "Add more reliable third-party sources",
            "Remove promotional language",
            "Include more neutral point of view",
            "Add specific achievements with citations",
            "Improve article structure with clear sections"
          ]
    };
    
    return result;
  } catch (error) {
    let message = "Failed to analyze";
    if (error instanceof Error) {
      message = error.message;
    }
    toast.error(message);
    throw error;
  }
}
