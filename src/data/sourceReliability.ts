// Source reliability database
// Format: source name, reliability rating, score (0-10), primary domain, domain variants
export const sourceReliabilityData = [
  {
    source: "112 Ukraine",
    reliability: "Generally unreliable",
    score: 2,
    domain: "112ukraine.com",
    domain_variants: ["www.112ukraine.com", "112ukraine.com"]
  },
  {
    source: "ABC News (US)",
    reliability: "Generally reliable",
    score: 10,
    domain: "abcnews.go.com",
    domain_variants: ["www.go.com", "go.com", "abcnews.go.com"]
  },
  {
    source: "Academic repositories",
    reliability: "No consensus",
    score: 5,
    domain: "academicrepositories.com",
    domain_variants: ["www.academicrepositories.com", "academicrepositories.com"]
  },
  // ... continuing with all the entries from your list
  {
    source: "ZoomInfo",
    reliability: "Generally unreliable",
    score: 2,
    domain: "zoominfo.com",
    domain_variants: ["www.zoominfo.com", "zoominfo.com"]
  }
];

// Add this to the file
export const domainScoreMap = new Map<string, number>();

// Initialize the map
sourceReliabilityData.forEach(source => {
  source.domain_variants.forEach(domain => {
    const normalizedDomain = domain.replace(/^www\./, '');
    domainScoreMap.set(normalizedDomain, source.score);
  });
});

// Then update the lookup function to use the map
export function getSourceReliabilityScore(domain: string): number {
  if (!domain) return 5;
  
  const normalizedDomain = domain.replace(/^www\./, '');
  return domainScoreMap.get(normalizedDomain) || 5;
} 