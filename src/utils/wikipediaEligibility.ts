import { SearchResult } from "@/services/dataForSeoService";
import {
  evaluateSource,
  assessNotability,
  SourceVerdict,
  NotabilityAssessment,
} from "./sourceEvaluation";
import type { WikipediaExistenceResult } from "@/services/wikipediaExistenceService";

/**
 * wikipediaEligibility.ts
 *
 * Turns a set of search results into a Wikipedia notability assessment.
 *
 * Every judgement here delegates to `sourceEvaluation.evaluateSource`, so the
 * entity analyser and the standalone source checker cannot disagree.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The previous scorer awarded 20 points per "reliable" source based on the
 * domain alone, then added a hash-derived random component (±3.9) plus a bonus
 * for longer query strings, purely so the numbers looked organic. Both have been
 * removed: the noise could flip the eligible/not-eligible verdict at the 66-point
 * boundary, and query length is not evidence of notability.
 *
 * The score is now a deterministic function of how many independent, reliable,
 * in-depth sources exist — which is what actually decides a deletion discussion.
 */

export interface AnalyzedSource {
  url: string;
  domain: string;
  /** Human-readable reliability label. */
  reliability: string;
  /** Retained for backwards compatibility with existing components. */
  category: 'highlyReliable' | 'moderatelyReliable' | 'unreliable' | 'deprecated';
  relevance: 'high' | 'low';
  /** Full policy verdict — the authoritative field. */
  verdict: SourceVerdict;
}

export interface CategorizedSources {
  /** Clears all four gates — counts toward WP:GNG. */
  qualifying: AnalyzedSource[];
  /** Reliable and independent but coverage is thin or context-dependent. */
  supporting: AnalyzedSource[];
  /** Fails a hard gate — press releases, directories, deprecated outlets. */
  rejected: AnalyzedSource[];
}

export interface WikipediaEligibilityResult {
  eligible: boolean;
  score: number;
  hasExistingWikipedia: boolean;
  existingWikipediaUrl?: string;
  /** Full result of the MediaWiki existence check. */
  existence: WikipediaExistenceResult | null;
  reasons: string[];
  suggestedAction: string;
  sourcesList: AnalyzedSource[];
  categorized: CategorizedSources;
  notability: NotabilityAssessment;
}

// ─────────────────────────────────────────────────────────────────────────────

function toLegacyCategory(verdict: SourceVerdict): AnalyzedSource['category'] {
  if (verdict.tier === 'deprecated') return 'deprecated';
  if (verdict.status === 'counts') return 'highlyReliable';
  if (verdict.status === 'partial') return 'moderatelyReliable';
  return 'unreliable';
}

/** De-duplicates results by normalised URL, keeping the first occurrence. */
function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    if (!r.url) continue;
    const key = r.url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assesses whether `query` meets Wikipedia's general notability guideline.
 *
 * @param query      The subject being assessed.
 * @param organic    Organic search results.
 * @param news       News search results.
 * @param existence  Result of `checkWikipediaExistence`. Pass null if the check
 *                   has not completed — the assessment then proceeds on sources
 *                   alone rather than guessing.
 */
export function assessWikipediaEligibility(
  query: string,
  organic: SearchResult[],
  news: SearchResult[] = [],
  existence: WikipediaExistenceResult | null = null,
): WikipediaEligibilityResult {

  const allResults = dedupeResults([...organic, ...news])
    .filter(r => r.url && !r.url.includes('wikipedia.org'));

  // ── Evaluate every source against Wikipedia sourcing policy ────────────────
  const sourcesList: AnalyzedSource[] = allResults.map(result => {
    const verdict = evaluateSource(
      { url: result.url, title: result.title, description: result.description },
      query,
    );

    return {
      url: result.url,
      domain: verdict.domain,
      reliability: verdict.outletName
        ? `${verdict.outletName} — ${verdict.headline}`
        : verdict.headline,
      category: toLegacyCategory(verdict),
      relevance: verdict.coverage === 'significant' ? 'high' : 'low',
      verdict,
    };
  });

  const categorized: CategorizedSources = {
    qualifying: sourcesList.filter(s => s.verdict.status === 'counts'),
    supporting: sourcesList.filter(s => s.verdict.status === 'partial'),
    rejected:   sourcesList.filter(s => s.verdict.status === 'fails'),
  };

  const notability = assessNotability(sourcesList.map(s => s.verdict));

  // ── Existing-article handling ──────────────────────────────────────────────
  // An existing article is reported alongside the assessment, never instead of
  // it: the old code short-circuited to a hard-coded score of 100, which meant a
  // single false positive produced a completely fabricated result.
  const hasExistingWikipedia = existence?.status === 'exists';

  const reasons: string[] = [];
  let suggestedAction: string;

  if (hasExistingWikipedia) {
    reasons.push(existence!.explanation);
    reasons.push(
      `Source analysis still ran: ${notability.qualifyingCount} of ${sourcesList.length} sources found would count toward notability.`,
    );
    suggestedAction = 'An article already exists. Any work here would be editing that article, not creating one.';
  } else {
    if (existence?.status === 'ambiguous') {
      reasons.push(`Possible existing article: ${existence.explanation}`);
    } else if (existence?.status === 'not_found') {
      reasons.push(existence.explanation);
    }

    reasons.push(notability.verdict);

    const rejectedCount = categorized.rejected.length;
    if (rejectedCount > 0) {
      const prCount = categorized.rejected.filter(s =>
        s.verdict.failures.some(f => f.policy === 'WP:ORGIND' || f.policy === 'WP:FORBESCON'),
      ).length;
      if (prCount > 0) {
        reasons.push(
          `${prCount} source${prCount === 1 ? '' : 's'} were excluded as press releases, syndicated wire copy, sponsored placements or contributor posts. These are the most common reason a draft is rejected at review.`,
        );
      }
    }

    if (notability.score >= 80) {
      suggestedAction = 'Strong case. Draft the article, citing the qualifying sources listed below.';
    } else if (notability.eligible) {
      suggestedAction = 'Borderline but arguable. Add one or two more independent, in-depth sources before submitting to reduce the chance of rejection.';
    } else if (notability.qualifyingDomains >= 2) {
      suggestedAction = `Not yet. You need qualifying coverage from at least ${3 - notability.qualifyingDomains} more independent publisher${3 - notability.qualifyingDomains === 1 ? '' : 's'}.`;
    } else {
      suggestedAction = 'Not eligible. Wikipedia requires substantial, independent coverage from multiple reliable publishers — press releases and profiles you placed do not count.';
    }
  }

  return {
    eligible: notability.eligible,
    score: notability.score,
    hasExistingWikipedia,
    existingWikipediaUrl: existence?.url || undefined,
    existence,
    reasons,
    suggestedAction,
    sourcesList,
    categorized,
    notability,
  };
}
