/**
 * wikipediaExistenceService.ts
 *
 * Authoritative check for whether an entity already has an English Wikipedia article.
 *
 * WHY THIS EXISTS
 * ---------------
 * The previous implementation inferred article existence by substring-matching
 * Google result URLs against the search query. That produced false positives:
 * searching "Orani Amroussi" matched en.wikipedia.org/wiki/Orani (a comune in
 * Sardinia) because "orani amroussi".includes("orani") is true.
 *
 * This module asks the MediaWiki API directly and requires a STRICT title match.
 * Substring matching is never used to claim an article exists.
 */

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

export type ExistenceStatus = 'exists' | 'ambiguous' | 'not_found';

export interface WikipediaExistenceResult {
  status: ExistenceStatus;
  /** Canonical article URL when status is 'exists' or 'ambiguous'. */
  url: string | null;
  /** Canonical article title when resolved. */
  title: string | null;
  /** Short human-readable explanation of how we decided. */
  explanation: string;
  /** Candidate titles worth a human look when status is 'ambiguous'. */
  candidates: Array<{ title: string; url: string; snippet: string }>;
  /** True when the bare title resolves to a disambiguation page. */
  isDisambiguation: boolean;
}

// ── Title normalisation ──────────────────────────────────────────────────────

/**
 * Normalises a title for comparison: strips diacritics, punctuation and case,
 * collapses whitespace. "Zoë Smith-Jones, Jr." → "zoe smith-jones jr"
 */
export function normalizeTitle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Removes a trailing parenthetical qualifier: "Jane Doe (author)" → "Jane Doe" */
export function stripQualifier(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Extracts the qualifier if present: "Jane Doe (author)" → "author" */
function getQualifier(title: string): string | null {
  const match = title.match(/\s*\(([^)]*)\)\s*$/);
  return match ? match[1].toLowerCase() : null;
}

function titleToUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s/g, '_'))}`;
}

// ── API plumbing ─────────────────────────────────────────────────────────────

async function apiGet(params: Record<string, string>): Promise<any> {
  const url = new URL(WIKI_API);
  const merged = { format: 'json', origin: '*', ...params };
  Object.entries(merged).forEach(([k, v]) => url.searchParams.append(k, v));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`MediaWiki API returned ${response.status}`);
  }
  return response.json();
}

/**
 * Titles that are never a person/company article even on an exact match.
 * A hit on one of these means "no article about this entity".
 */
const NON_ARTICLE_PREFIXES = [
  'category:', 'wikipedia:', 'template:', 'help:', 'portal:',
  'talk:', 'file:', 'draft:', 'module:', 'mediawiki:', 'special:',
];

function isNonArticleTitle(title: string): boolean {
  const lower = title.toLowerCase();
  if (NON_ARTICLE_PREFIXES.some(p => lower.startsWith(p))) return true;
  if (lower.startsWith('list of ')) return true;
  if (lower.endsWith('(disambiguation)')) return true;
  return false;
}

// ── Step 1: direct title resolution ──────────────────────────────────────────

interface DirectLookup {
  found: boolean;
  title: string | null;
  isDisambiguation: boolean;
  /** True when MediaWiki followed a redirect to a differently-named page. */
  redirectedFrom: string | null;
  extract: string;
}

async function directLookup(query: string): Promise<DirectLookup> {
  const data = await apiGet({
    action: 'query',
    titles: query,
    redirects: '1',
    prop: 'pageprops|extracts',
    ppprop: 'disambiguation',
    exintro: '1',
    explaintext: '1',
    exsentences: '3',
  });

  const pages = data?.query?.pages || {};
  const pageId = Object.keys(pages)[0];
  const page = pageId ? pages[pageId] : null;

  if (!page || page.missing !== undefined || pageId === '-1') {
    return { found: false, title: null, isDisambiguation: false, redirectedFrom: null, extract: '' };
  }

  const redirects = data?.query?.redirects || [];
  const redirectedFrom = redirects.length > 0 ? redirects[0].from : null;

  return {
    found: true,
    title: page.title,
    isDisambiguation: page.pageprops?.disambiguation !== undefined,
    redirectedFrom,
    extract: page.extract || '',
  };
}

// ── Step 2: search fallback with strict title matching ───────────────────────

interface SearchHit {
  title: string;
  snippet: string;
}

async function searchCandidates(query: string): Promise<{ hits: SearchHit[]; totalHits: number }> {
  const data = await apiGet({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '15',
    srprop: 'snippet',
  });

  const hits: SearchHit[] = (data?.query?.search || []).map((r: any) => ({
    title: r.title,
    snippet: (r.snippet || '').replace(/<[^>]*>/g, ''),
  }));

  return { hits, totalHits: data?.query?.searchinfo?.totalhits ?? 0 };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Determines whether `query` already has an English Wikipedia article.
 *
 * Decision rules, strictest first:
 *   1. Exact title (after redirect resolution) → exists.
 *   2. Redirect landing on a differently-named page → ambiguous (could be a
 *      redirect into a list or a broader topic, which is not "has an article").
 *   3. Disambiguation page at the bare title → not_found, with candidates.
 *   4. Search hit whose title matches exactly once a parenthetical qualifier is
 *      stripped → ambiguous (e.g. "Jane Doe" vs "Jane Doe (author)").
 *   5. Anything else → not_found.
 *
 * Substring containment NEVER produces 'exists'.
 */
export async function checkWikipediaExistence(
  query: string,
  /** Optional extra context (the modifier keywords) used to disambiguate. */
  contextTerms: string[] = [],
): Promise<WikipediaExistenceResult> {
  const cleanQuery = query.trim();
  const normQuery = normalizeTitle(cleanQuery);

  const empty: WikipediaExistenceResult = {
    status: 'not_found',
    url: null,
    title: null,
    explanation: '',
    candidates: [],
    isDisambiguation: false,
  };

  if (!cleanQuery) {
    return { ...empty, explanation: 'No search term provided.' };
  }

  try {
    // ── Step 1: ask for the exact title ──────────────────────────────────────
    const direct = await directLookup(cleanQuery);

    if (direct.found && direct.title && !isNonArticleTitle(direct.title)) {
      if (direct.isDisambiguation) {
        const { hits } = await searchCandidates(cleanQuery);
        return {
          status: 'not_found',
          url: null,
          title: null,
          isDisambiguation: true,
          explanation:
            `"${direct.title}" is a disambiguation page, not an article about a specific subject. ` +
            `No single Wikipedia article covers this term.`,
          candidates: hits
            .filter(h => !isNonArticleTitle(h.title))
            .slice(0, 5)
            .map(h => ({ title: h.title, url: titleToUrl(h.title), snippet: h.snippet })),
        };
      }

      const normResolved = normalizeTitle(direct.title);

      // Exact match (allowing for a redirect that preserves the name).
      if (normResolved === normQuery) {
        return {
          status: 'exists',
          url: titleToUrl(direct.title),
          title: direct.title,
          isDisambiguation: false,
          explanation: `Wikipedia has an article titled "${direct.title}".`,
          candidates: [],
        };
      }

      // A redirect landed somewhere with a different name. That often means the
      // term redirects into a list, a parent company, or a broader topic — which
      // is NOT the same as the subject having its own article.
      return {
        status: 'ambiguous',
        url: titleToUrl(direct.title),
        title: direct.title,
        isDisambiguation: false,
        explanation:
          `"${direct.redirectedFrom || cleanQuery}" redirects to "${direct.title}", which is a ` +
          `differently-named page. Verify whether that article is actually about this subject ` +
          `or merely mentions it.`,
        candidates: [{ title: direct.title, url: titleToUrl(direct.title), snippet: direct.extract.slice(0, 200) }],
      };
    }

    // ── Step 2: full-text search, strict title comparison ────────────────────
    const { hits, totalHits } = await searchCandidates(cleanQuery);

    if (totalHits === 0 || hits.length === 0) {
      return {
        ...empty,
        explanation: `Wikipedia returned no results for "${cleanQuery}". No article exists.`,
      };
    }

    const articleHits = hits.filter(h => !isNonArticleTitle(h.title));

    // Titles that match exactly once a parenthetical qualifier is removed.
    const qualifierMatches = articleHits.filter(
      h => normalizeTitle(stripQualifier(h.title)) === normQuery,
    );

    if (qualifierMatches.length > 0) {
      // If the caller gave us modifier terms, see whether one candidate's
      // qualifier or snippet corroborates them.
      const normContext = contextTerms.map(normalizeTitle).filter(Boolean);
      const corroborated = normContext.length
        ? qualifierMatches.filter(h => {
            const hay = normalizeTitle(`${getQualifier(h.title) || ''} ${h.snippet}`);
            return normContext.some(term => hay.includes(term));
          })
        : [];

      if (corroborated.length === 1) {
        return {
          status: 'exists',
          url: titleToUrl(corroborated[0].title),
          title: corroborated[0].title,
          isDisambiguation: false,
          explanation:
            `Wikipedia has an article titled "${corroborated[0].title}", matching both the name ` +
            `and the context you supplied.`,
          candidates: [],
        };
      }

      return {
        status: 'ambiguous',
        url: titleToUrl(qualifierMatches[0].title),
        title: qualifierMatches[0].title,
        isDisambiguation: false,
        explanation:
          qualifierMatches.length === 1
            ? `Found "${qualifierMatches[0].title}" — the name matches but carries a qualifier. ` +
              `Confirm it refers to the same subject before treating it as an existing article.`
            : `Found ${qualifierMatches.length} articles sharing this exact name. ` +
              `Confirm which, if any, refers to your subject.`,
        candidates: qualifierMatches
          .slice(0, 5)
          .map(h => ({ title: h.title, url: titleToUrl(h.title), snippet: h.snippet })),
      };
    }

    // Search found pages that merely MENTION the term. That is not an article
    // about the subject — this is precisely the old false-positive case.
    return {
      status: 'not_found',
      url: null,
      title: null,
      isDisambiguation: false,
      explanation:
        `No Wikipedia article is titled "${cleanQuery}". ${articleHits.length} article(s) mention ` +
        `the term, but a mention inside another article is not the same as having an article.`,
      candidates: articleHits
        .slice(0, 5)
        .map(h => ({ title: h.title, url: titleToUrl(h.title), snippet: h.snippet })),
    };
  } catch (error) {
    console.error('Wikipedia existence check failed:', error);
    // Fail closed: never claim an article exists when we could not verify it.
    return {
      ...empty,
      explanation:
        'Could not reach the Wikipedia API to verify whether an article exists. ' +
        'Treating this as "no article found" — please verify manually.',
    };
  }
}
