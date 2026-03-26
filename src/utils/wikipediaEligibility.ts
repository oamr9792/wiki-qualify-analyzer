/**
 * FULL REPLACEMENT for src/utils/wikipediaEligibility.ts
 *
 * Key changes vs the original:
 *  1. Imports detectPressReleaseOrSelfPromo from pressReleaseDetector
 *  2. In the main forEach loop, press releases are immediately pushed to
 *     sourcesList as category:'unreliable' and returned — they never reach
 *     the reliability scorer, so they score zero points.
 *  3. The categorizedSources logic is unchanged so the Sources tab still
 *     works; press releases just appear in the Unreliable bucket.
 */

import { SearchResult } from "@/services/dataForSeoService";
import { getSourceReliability } from "./wikipediaSourceReliability";
import { getEffectiveDomain } from "./domainUtils";
import { detectPressReleaseOrSelfPromo, getPressReleaseLabel } from "./pressReleaseDetector";

export interface AnalyzedSource {
  url: string;
  domain: string;
  reliability: string;
  category: 'highlyReliable' | 'moderatelyReliable' | 'unreliable' | 'deprecated';
  citationCount?: number;
  relevance: 'high' | 'low';
  /** Set when the source was flagged as a press release / self-promo */
  pressReleaseReason?: string;
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

export function assessWikipediaEligibility(
  query: string,
  organicResults: SearchResult[],
  newsResults: SearchResult[] = [],
  domainCitations: Record<string, number> = {},
  foundWikipediaUrl?: string
): WikipediaEligibilityResult {

  // ── Early return: existing Wikipedia page ────────────────────────────────
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
      sourcesList: [],
    };
  }

  // ── Build source list ─────────────────────────────────────────────────────
  const sourcesList: AnalyzedSource[] = [];
  const processedUrls = new Set<string>();

  for (const result of [...organicResults, ...newsResults]) {
    if (result.url.includes('wikipedia.org')) continue;
    if (processedUrls.has(result.url)) continue;
    processedUrls.add(result.url);

    const domain = getEffectiveDomain(result.url);

    // ── PRESS RELEASE / SELF-PROMO CHECK ──────────────────────────────────
    // This is the core new logic. If a URL is a press release wire, directory,
    // social media post, or company-controlled page, it is immediately
    // classified as 'unreliable' regardless of how prominent the query is.
    // Wikipedia WP:RS requires independence — these sources fail that test.
    const prDetection = detectPressReleaseOrSelfPromo(result.url, domain);
    if (prDetection.isPressRelease) {
      sourcesList.push({
        url: result.url,
        domain,
        reliability: getPressReleaseLabel(prDetection.category),
        category: 'unreliable',
        relevance: 'low',
        pressReleaseReason: prDetection.reason ?? undefined,
      });
      continue; // Do NOT score — skip the rest of the loop
    }

    // ── Standard reliability check ────────────────────────────────────────
    const citationCount = domainCitations[domain] || 0;
    const reliability = getSourceReliability(result.url, citationCount);

    let category: AnalyzedSource['category'];
    let relevance: 'high' | 'low' = 'high';

    const hasKeywordInTitle = result.title?.toLowerCase().includes(query.toLowerCase());
    const hasKeywordInUrl   = result.url.toLowerCase().includes(query.toLowerCase());
    if (!hasKeywordInTitle && !hasKeywordInUrl) relevance = 'low';

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
  }

  // ── Categorize for the Sources tab ───────────────────────────────────────
  const categorizedSources = categorizeSources(sourcesList, query, organicResults, newsResults);

  // ── Score ─────────────────────────────────────────────────────────────────
  // Points:
  //   Reliable + specific mention  → 20 pts
  //   Contextual mention           → 7 pts
  //   Reliable + no mention        → 3 pts
  // Diminishing returns per domain (×0.85 each additional hit), capped at 3.
  const domainCounts = new Map<string, number>();
  let displayScore = 0;

  const allToScore = [
    ...categorizedSources.highlyReliable.map(s => ({ ...s, basePoints: 20 })),
    ...categorizedSources.contextualMention.map(s => ({ ...s, basePoints: 7 })),
    ...categorizedSources.reliableNoMention.map(s => ({ ...s, basePoints: 3 })),
  ].sort((a, b) => a.domain.localeCompare(b.domain));

  for (const source of allToScore) {
    const count = domainCounts.get(source.domain) || 0;
    if (count < 3) {
      displayScore += source.basePoints * Math.pow(0.85, count);
    }
    domainCounts.set(source.domain, count + 1);
  }

  displayScore = Math.min(100, Math.max(5, Math.round(displayScore)));
  const eligible = displayScore >= 66;

  // ── Build result ──────────────────────────────────────────────────────────
  const highlyReliableCount = categorizedSources.highlyReliable.length;
  const uniqueDomains = new Set(categorizedSources.highlyReliable.map(s => s.domain)).size;

  let suggestedAction = '';
  const reasons: string[] = [];

  if (displayScore >= 75) {
    suggestedAction = 'Create a Wikipedia article with these reliable sources';
    reasons.push(`Strong potential. Found ${highlyReliableCount} reliable independent sources (from ${uniqueDomains} different publishers) that specifically cover this topic.`);
  } else if (displayScore >= 66) {
    suggestedAction = 'Consider creating a Wikipedia draft, but gather more sources first';
    reasons.push(`Good potential. Found ${highlyReliableCount} reliable independent sources (from ${uniqueDomains} publishers). This meets Wikipedia's minimum notability threshold.`);
  } else if (displayScore >= 46) {
    suggestedAction = 'Close but not there yet. Find more independent coverage in reliable outlets.';
    reasons.push(`Moderate potential. Found ${highlyReliableCount} qualifying sources. Note: press releases and directory listings have been excluded as they do not establish Wikipedia notability.`);
  } else {
    suggestedAction = 'Not yet eligible. Wikipedia requires significant independent coverage in reliable outlets.';
    reasons.push(`Limited potential. Found ${highlyReliableCount} qualifying independent sources. Press releases, directories, and social media have been excluded per Wikipedia policy (WP:RS, WP:NOTRELIABLE).`);
  }

  return {
    eligible,
    score: displayScore,
    hasExistingWikipedia: false,
    existingWikipediaUrl: foundWikipediaUrl,
    reasons,
    suggestedAction,
    reliableSources: {
      highlyReliable: categorizedSources.highlyReliable.length,
      moderatelyReliable: categorizedSources.reliableNoMention.length,
      unreliable: categorizedSources.unreliable.length,
      deprecated: 0,
    },
    sourcesList,
    categorizedSources,
  };
}

// ── categorizeSources ─────────────────────────────────────────────────────────
// Unchanged logic from original — splits sources into the four display buckets.
function categorizeSources(
  sourcesList: AnalyzedSource[],
  query: string,
  organicResults: SearchResult[],
  newsResults: SearchResult[],
) {
  const out = {
    highlyReliable:    [] as AnalyzedSource[],
    reliableNoMention: [] as AnalyzedSource[],
    contextualMention: [] as AnalyzedSource[],
    unreliable:        [] as AnalyzedSource[],
  };

  const processedUrls = new Set<string>();
  const normalizedQuery = query.toLowerCase().trim();
  const allResults = [...organicResults, ...newsResults];

  const findResult = (url: string) => {
    const norm = (u: string) => u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    return allResults.find(r => norm(r.url) === norm(url));
  };

  for (const source of sourcesList) {
    if (processedUrls.has(source.url)) continue;
    processedUrls.add(source.url);

    // Press releases and truly unreliable sources go straight to unreliable
    if (source.category === 'unreliable' || source.category === 'deprecated') {
      out.unreliable.push(source);
      continue;
    }

    const match = findResult(source.url);
    if (!match) {
      out.reliableNoMention.push(source);
      continue;
    }

    const titleLower = match.title?.toLowerCase() ?? '';
    const urlLower   = match.url.toLowerCase();
    const descLower  = match.description?.toLowerCase() ?? '';

    const urlVariants = [
      normalizedQuery,
      normalizedQuery.replace(/\s+/g, '-'),
      normalizedQuery.replace(/\s+/g, '_'),
    ];

    const inTitle = titleLower.includes(normalizedQuery);
    const inUrl   = urlVariants.some(v =>
      urlLower.includes(`/${v}/`) || urlLower.includes(`/${v}.`) ||
      urlLower.endsWith(`/${v}`) || urlLower.includes(`${v}.com`) ||
      urlLower.includes(`${v}.org`) || urlLower.includes(`${v}.net`)
    );
    const inMeta  = descLower.includes(normalizedQuery);

    if (inTitle || inUrl || inMeta) {
      out.highlyReliable.push(source);
    } else if (urlVariants.some(v => descLower.includes(v))) {
      out.contextualMention.push(source);
    } else {
      out.reliableNoMention.push(source);
    }
  }

  return out;
}

// Keep the old helpers that other files import
export function analyzeSourceReliability(sources: string[]) {
  const result = {
    highlyReliableSources: [] as string[], moderatelyReliableSources: [] as string[],
    unreliableSources: [] as string[], deprecatedSources: [] as string[],
    notEnoughDataSources: [] as string[],
    highlyReliableCount: 0, moderatelyReliableCount: 0, unreliableCount: 0,
    deprecatedCount: 0, notEnoughDataCount: 0,
  };
  sources.forEach(source => {
    const r = getSourceReliability(source);
    if (r.reliability === 'Generally reliable')   { result.highlyReliableSources.push(source); result.highlyReliableCount++; }
    else if (r.reliability === 'No consensus')     { result.moderatelyReliableSources.push(source); result.moderatelyReliableCount++; }
    else if (r.reliability === 'Generally unreliable') { result.unreliableSources.push(source); result.unreliableCount++; }
    else if (r.reliability === 'Deprecated')       { result.deprecatedSources.push(source); result.deprecatedCount++; }
    else                                           { result.notEnoughDataSources.push(source); result.notEnoughDataCount++; }
  });
  return result;
}

export function checkForExistingWikipedia(query: string, results: SearchResult[]) {
  const normalizedQuery = query.trim().toLowerCase();
  const wikipediaResult = results.find(result => {
    if (!result.url.includes('wikipedia.org/wiki/')) return false;
    if (/wikipedia\.org\/wiki\/(Category|Wikipedia|Template|Help|Portal|Talk|File|List_of):/.test(result.url)) return false;
    const titleWithoutSuffix = result.title.replace(/ - Wikipedia.*$/, '').toLowerCase();
    return titleWithoutSuffix === normalizedQuery ||
           normalizedQuery.includes(titleWithoutSuffix) ||
           titleWithoutSuffix.includes(normalizedQuery);
  });
  return { exists: !!wikipediaResult, url: wikipediaResult ? wikipediaResult.url : null };
}
