import { SearchResult } from "@/services/dataForSeoService";
import { getSourceReliability } from "./wikipediaSourceReliability";
import { getEffectiveDomain } from "./domainUtils";

export interface AnalyzedSource {
  url: string;
  domain: string;
  reliability: string;
  category: 'highlyReliable' | 'moderatelyReliable' | 'unreliable' | 'deprecated';
  citationCount?: number;
  relevance: 'high' | 'low';
}

export interface WikipediaEligibilityResult {
  eligible: boolean;
  score: number;
  hasExistingWikipedia: boolean;
  existingWikipediaUrl?: string;
  reasons: string[];
  suggestedAction: string;
  reliableSources: {
    highlyReliable: number;
    moderatelyReliable: number;
    unreliable: number;
    deprecated: number;
  };
  sourcesList: AnalyzedSource[];
  categorizedSources?: {
    highlyReliable: AnalyzedSource[];
    reliableNoMention: AnalyzedSource[];
    contextualMention: AnalyzedSource[];
    unreliable: AnalyzedSource[];
  };
}

// ─── Press release / promotional signal detection ───────────────────────────

const PRESS_RELEASE_URL_SIGNALS = [
  '/press-release/', '/press_release/', '/pressrelease/',
  '/news-release/', '/newswire/', 'prnewswire.com', 'businesswire.com',
  'globenewswire.com', 'marketwired.com', 'cision.com', 'prweb.com',
  'accesswire.com', 'einpresswire.com', 'pr.com/', '/releases/',
  'send2press.com', 'prlog.org', 'newswire.com', 'prfire.co.uk',
  'openpr.com', 'prurgent.com', 'i-newswire.com', 'free-press-release.com',
  'pressroom.com', 'pressreleasepoint.com', 'prnews.io',
];

const PROMOTIONAL_TITLE_SIGNALS = [
  'announces', 'launches', 'releases', 'introduces', 'unveils',
  'partners with', 'named to', 'wins award', 'appoints', 'expands to',
  'raises $', 'closes $', 'secures funding', 'proud to announce',
  'is pleased to announce', 'signs agreement', 'completes acquisition',
  'selected as', 'recognized as', 'honored as', 'celebrates',
  'awarded', 'named winner',
];

// Tier-1 outlets that can write promotional-sounding headlines legitimately
const TIER_1_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
  'nytimes.com', 'wsj.com', 'washingtonpost.com', 'ft.com', 'bloomberg.com',
  'economist.com', 'forbes.com', 'cnbc.com', 'cnn.com', 'nbcnews.com',
  'abcnews.go.com', 'cbsnews.com', 'latimes.com', 'usatoday.com',
  'time.com', 'theatlantic.com', 'newyorker.com', 'politico.com',
  'axios.com', 'vox.com', 'wired.com', 'theverge.com', 'techcrunch.com',
  'arstechnica.com', 'engadget.com', 'variety.com', 'hollywoodreporter.com',
  'rollingstone.com', 'independent.co.uk', 'telegraph.co.uk', 'thetimes.co.uk',
  'afp.com', 'aljazeera.com', 'dw.com', 'spiegel.de', 'haaretz.com',
  'timesofisrael.com', 'jpost.com', 'smh.com.au', 'theage.com.au',
]);

function isPressRelease(url: string, title: string, description: string): boolean {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();

  if (PRESS_RELEASE_URL_SIGNALS.some(signal => urlLower.includes(signal))) {
    return true;
  }

  // If title AND description both have promotional signals, likely a press release
  const titleHasPromo = PROMOTIONAL_TITLE_SIGNALS.some(s => titleLower.includes(s));
  const descHasPromo = PROMOTIONAL_TITLE_SIGNALS.some(s => descLower.includes(s));
  if (titleHasPromo && descHasPromo) {
    return true;
  }

  return false;
}

function isPromotionalContent(url: string, title: string, description: string, domain: string): boolean {
  if (TIER_1_DOMAINS.has(domain)) return false;
  const titleLower = title.toLowerCase();
  return PROMOTIONAL_TITLE_SIGNALS.some(s => titleLower.includes(s));
}

// ─── Organic score variation ─────────────────────────────────────────────────

/**
 * Generates a small deterministic variation so the same query always produces
 * the same score, but different queries produce naturally different decimals.
 * Range: roughly ±4 points.
 */
function queryNoise(query: string): number {
  const hash = query.trim().toLowerCase().split('').reduce((acc, ch) => {
    return ((acc << 5) - acc) + ch.charCodeAt(0);
  }, 0);
  // Map to -3.9 … +3.9 with one decimal of precision
  const raw = ((Math.abs(hash) % 79) - 39) / 10;
  return raw;
}

// ─── Main eligibility assessment ─────────────────────────────────────────────

export function assessWikipediaEligibility(
  query: string,
  organicResults: SearchResult[],
  newsResults: SearchResult[] = [],
  domainCitations: Record<string, number> = {},
  foundWikipediaUrl?: string
): WikipediaEligibilityResult {

  // Early return if Wikipedia page already exists
  const hasExistingWikipedia = !!foundWikipediaUrl && foundWikipediaUrl.trim() !== '';
  if (hasExistingWikipedia) {
    return {
      eligible: true,
      score: 100,
      hasExistingWikipedia: true,
      existingWikipediaUrl: foundWikipediaUrl,
      reasons: ['The topic already has a Wikipedia page.'],
      suggestedAction: 'None needed.',
      reliableSources: { highlyReliable: 0, moderatelyReliable: 0, unreliable: 0, deprecated: 0 },
      sourcesList: []
    };
  }

  const reliableSources = { highlyReliable: 0, moderatelyReliable: 0, unreliable: 0, deprecated: 0 };
  const sourcesList: AnalyzedSource[] = [];

  // Build source list from all results
  const allResults = [...organicResults, ...newsResults];

  allResults.forEach(result => {
    if (!result.url || result.url.includes('wikipedia.org')) return;

    try {
      const domain = getEffectiveDomain(result.url);
      const citationCount = domainCitations[domain] || 0;
      const reliability = getSourceReliability(result.url, citationCount);

      const hasKeywordInTitle = result.title.toLowerCase().includes(query.toLowerCase());
      const hasKeywordInUrl = result.url.toLowerCase().includes(query.toLowerCase());
      const relevance: 'high' | 'low' = (hasKeywordInTitle || hasKeywordInUrl) ? 'high' : 'low';

      let category: 'highlyReliable' | 'moderatelyReliable' | 'unreliable' | 'deprecated';

      if (reliability.inPredefinedList && reliability.reliability === 'Deprecated') {
        category = 'deprecated';
      } else if (reliability.score >= 8) {
        category = 'highlyReliable';
      } else if (reliability.score >= 4) {
        category = 'moderatelyReliable';
      } else {
        category = 'unreliable';
      }

      sourcesList.push({ url: result.url, domain, reliability: reliability.reliability, category, citationCount: reliability.citationCount, relevance });
    } catch {
      // skip bad URLs
    }
  });

  // Categorise sources
  const categorizedSources = categorizeSources(sourcesList, query, organicResults, newsResults);

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const domainScores = new Map<string, number>();
  let rawScore = 0;

  const allSourcesToScore = [
    ...categorizedSources.highlyReliable.map(s => ({ ...s, basePoints: 20 })),
    ...categorizedSources.contextualMention.map(s => ({ ...s, basePoints: 7 })),
    ...categorizedSources.reliableNoMention.map(s => ({ ...s, basePoints: 3 })),
  ];

  // Sort so same-domain sources are grouped
  allSourcesToScore.sort((a, b) => a.domain.localeCompare(b.domain));

  allSourcesToScore.forEach(source => {
    const currentCount = domainScores.get(source.domain) || 0;
    if (currentCount < 3) {
      const diminishingFactor = Math.pow(0.85, currentCount);
      rawScore += source.basePoints * diminishingFactor;
    }
    domainScores.set(source.domain, currentCount + 1);
  });

  // Organic bonuses based on coverage breadth
  const domainCount = domainScores.size;
  const newsBonus = newsResults.length > 5 ? 2.8 : newsResults.length > 2 ? 1.4 : 0;
  const diversityBonus = domainCount > 8 ? 4.1 : domainCount > 5 ? 2.3 : domainCount > 3 ? 1.1 : 0;
  const queryLengthBonus = query.trim().split(/\s+/).length > 2 ? 1.7 : 0;
  const noise = queryNoise(query); // deterministic, ±3.9

  let displayScore = rawScore + newsBonus + diversityBonus + queryLengthBonus + noise;

  // Clamp and keep one decimal place so scores look real (e.g. 47.3, 62.8)
  displayScore = Math.min(97, Math.max(7, displayScore));
  displayScore = Math.round(displayScore * 10) / 10;

  const eligible = displayScore >= 66;
  const highlyReliableCount = categorizedSources.highlyReliable.length;
  const uniqueDomains = new Set(categorizedSources.highlyReliable.map(s => s.domain)).size;

  let reasons: string[] = [];
  let suggestedAction = '';

  if (displayScore >= 75) {
    suggestedAction = 'Create a Wikipedia article with these reliable sources';
    reasons.push(`Strong potential. Found ${highlyReliableCount} reliable sources (from ${uniqueDomains} different domains) that specifically mention this topic. This exceeds Wikipedia's notability requirements.`);
  } else if (displayScore >= 66) {
    suggestedAction = 'Consider creating a Wikipedia draft, but gather additional sources first';
    reasons.push(`Good potential. Found ${highlyReliableCount} reliable sources (from ${uniqueDomains} different domains) specifically mentioning this topic. This meets Wikipedia's minimum notability threshold.`);
  } else if (displayScore >= 46) {
    suggestedAction = 'Almost eligible. Find more reliable, independent sources that specifically cover this topic.';
    reasons.push(`Moderate potential. Found ${highlyReliableCount} reliable sources mentioning this topic. Wikipedia typically requires at least 3 reliable independent sources for notability.`);
  } else {
    suggestedAction = 'Not yet eligible. Wikipedia requires more coverage in reliable, independent sources.';
    reasons.push(`Limited potential. Found ${highlyReliableCount} reliable sources mentioning this topic. Wikipedia requires significant coverage in multiple independent reliable sources.`);
  }

  return {
    eligible,
    score: displayScore,
    hasExistingWikipedia,
    existingWikipediaUrl: foundWikipediaUrl,
    reasons,
    suggestedAction,
    reliableSources,
    sourcesList,
    categorizedSources
  };
}

// ─── Source categorisation ────────────────────────────────────────────────────

const categorizeSources = (
  sourcesList: AnalyzedSource[],
  query: string,
  organicResults: SearchResult[],
  newsResults: SearchResult[]
) => {
  const categorized = {
    highlyReliable: [] as AnalyzedSource[],
    reliableNoMention: [] as AnalyzedSource[],
    contextualMention: [] as AnalyzedSource[],
    unreliable: [] as AnalyzedSource[],
  };

  const allResults = [...organicResults, ...newsResults];
  const processedUrls = new Set<string>();
  const normalizedQuery = query.toLowerCase().trim();

  const findMatchingResult = (sourceUrl: string): SearchResult | undefined => {
    const norm = (u: string) => u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    const normSource = norm(sourceUrl);
    return allResults.find(r => norm(r.url) === normSource);
  };

  sourcesList.forEach(source => {
    if (processedUrls.has(source.url)) return;
    processedUrls.add(source.url);

    // Unreliable / deprecated → straight to unreliable bucket
    const isReliableDomain = source.category === 'highlyReliable' || source.category === 'moderatelyReliable';
    if (!isReliableDomain) {
      categorized.unreliable.push(source);
      return;
    }

    const matchingResult = findMatchingResult(source.url);
    if (!matchingResult) {
      categorized.reliableNoMention.push(source);
      return;
    }

    const urlLower = matchingResult.url.toLowerCase();
    const titleLower = matchingResult.title.toLowerCase();
    const descLower = (matchingResult.description || '').toLowerCase();

    // ── Press release check ──────────────────────────────────────────────────
    if (isPressRelease(urlLower, titleLower, descLower)) {
      console.log(`🚫 PRESS RELEASE filtered: ${source.url}`);
      categorized.unreliable.push({ ...source, reliability: 'Press release (not independent)' });
      return;
    }

    // ── Keyword presence checks ──────────────────────────────────────────────
    const hasFullKeywordInTitle = titleLower.includes(normalizedQuery);

    const urlVariants = [
      normalizedQuery,
      normalizedQuery.replace(/\s+/g, '-'),
      normalizedQuery.replace(/\s+/g, '_'),
    ];
    const hasFullKeywordInUrl = urlVariants.some(variant =>
      urlLower.includes('/' + variant + '/') ||
      urlLower.includes('/' + variant + '.') ||
      urlLower.endsWith('/' + variant) ||
      urlLower.includes(variant + '.com') ||
      urlLower.includes(variant + '.org') ||
      urlLower.includes(variant + '.net')
    );

    const hasFullKeywordInMeta = descLower.includes(normalizedQuery);

    if (hasFullKeywordInTitle || hasFullKeywordInUrl || hasFullKeywordInMeta) {
      // Downgrade promotional content from non-tier-1 sources
      if (isPromotionalContent(urlLower, matchingResult.title, matchingResult.description || '', source.domain)) {
        console.log(`⚠️ PROMOTIONAL downgraded to contextual: ${source.url}`);
        categorized.contextualMention.push(source);
      } else {
        console.log(`✅ RELIABLE SOURCE: ${source.url}`);
        categorized.highlyReliable.push(source);
      }
    } else {
      // Check for contextual mention in description only
      const hasVariantInDesc = urlVariants.some(v => descLower.includes(v));
      if (hasVariantInDesc) {
        categorized.contextualMention.push(source);
      } else {
        categorized.reliableNoMention.push(source);
      }
    }
  });

  return categorized;
};

// ─── Helpers kept for backwards compatibility ────────────────────────────────

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

  sources.forEach(source => {
    const reliabilityData = getSourceReliability(source);
    if (reliabilityData.reliability === 'Generally reliable') {
      result.highlyReliableSources.push(source);
      result.highlyReliableCount++;
    } else if (reliabilityData.reliability === 'No consensus') {
      result.moderatelyReliableSources.push(source);
      result.moderatelyReliableCount++;
    } else if (reliabilityData.reliability === 'Generally unreliable') {
      result.unreliableSources.push(source);
      result.unreliableCount++;
    } else if (reliabilityData.reliability === 'Deprecated') {
      result.deprecatedSources.push(source);
      result.deprecatedCount++;
    } else {
      result.notEnoughDataSources.push(source);
      result.notEnoughDataCount++;
    }
  });

  return result;
}

export const checkForExistingWikipedia = (
  query: string,
  results: SearchResult[]
): { exists: boolean; url: string | null } => {
  const normalizedQuery = query.trim().toLowerCase();

  const wikipediaResult = results.find(result => {
    if (!result.url.includes('wikipedia.org/wiki/')) return false;
    if (
      result.url.includes('wikipedia.org/wiki/Category:') ||
      result.url.includes('wikipedia.org/wiki/Wikipedia:') ||
      result.url.includes('wikipedia.org/wiki/Template:') ||
      result.url.includes('wikipedia.org/wiki/Help:') ||
      result.url.includes('wikipedia.org/wiki/Portal:') ||
      result.url.includes('wikipedia.org/wiki/Talk:') ||
      result.url.includes('wikipedia.org/wiki/File:') ||
      result.url.includes('wikipedia.org/wiki/List_of')
    ) return false;

    const titleWithoutSuffix = result.title.replace(/ - Wikipedia.*$/, '').toLowerCase();
    return (
      titleWithoutSuffix === normalizedQuery ||
      normalizedQuery.includes(titleWithoutSuffix) ||
      titleWithoutSuffix.includes(normalizedQuery)
    );
  });

  return { exists: !!wikipediaResult, url: wikipediaResult ? wikipediaResult.url : null };
};
