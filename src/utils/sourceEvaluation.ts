/**
 * sourceEvaluation.ts
 *
 * Evaluates a SINGLE source the way a strict Wikipedia editor would at AfD.
 *
 * A source only counts toward notability if it clears ALL FOUR gates:
 *
 *   1. RELIABLE      (WP:RS)     — editorial oversight, reputation for fact-checking
 *   2. INDEPENDENT   (WP:IS)     — not produced, placed or paid for by the subject
 *   3. SIGNIFICANT   (WP:SIGCOV) — addresses the subject directly and in detail
 *   4. SECONDARY     (WP:PSTS)   — contains analysis, not just relayed claims
 *
 * Failing ANY gate means the source contributes nothing to notability, no matter
 * how prestigious the masthead. A press release in Reuters is still a press
 * release; a Forbes Council post is still self-published marketing.
 *
 * This module is shared by the entity analyser and the standalone source checker
 * so both give identical verdicts.
 */

import { getEffectiveDomain } from './domainUtils';
import { wikipediaSourceReliability } from './wikipediaSourceReliability';
import {
  detectPressReleaseOrSelfPromo,
  getPressReleaseLabel,
} from './pressReleaseDetector';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReliabilityTier =
  | 'tier1'        // Gold-standard: Reuters, AP, BBC, NYT…
  | 'reliable'     // Generally reliable per WP:RSP
  | 'situational'  // No consensus / context-dependent
  | 'unreliable'   // Generally unreliable
  | 'deprecated'   // Deprecated or blacklisted
  | 'unknown';     // Not on the perennial list

export type CoverageDepth = 'significant' | 'passing' | 'unknown';

export type SourceStatus =
  | 'counts'    // Clears all four gates — counts toward WP:GNG
  | 'partial'   // Reliable and independent but coverage looks thin
  | 'fails';    // Fails at least one hard gate

export interface PolicyFinding {
  /** Shortcut such as "WP:ORGIND" */
  policy: string;
  detail: string;
}

export interface SourceVerdict {
  url: string;
  domain: string;
  status: SourceStatus;
  tier: ReliabilityTier;
  independent: boolean;
  /**
   * Whether the source is secondary (WP:PSTS). An interview in a quality paper
   * is independent but primary — the subject is speaking about themselves — so
   * it fails notability on a different gate than a press release does.
   */
  secondary: boolean;
  coverage: CoverageDepth;
  /** Which signal the coverage judgement rests on. 'url' means it was inferred. */
  coverageBasis: 'headline' | 'url' | 'snippet' | 'none';
  /** Display name of the outlet when we know it. */
  outletName: string | null;
  /** Why it failed — empty when status is 'counts'. */
  failures: PolicyFinding[];
  /** Supporting observations shown to the user. */
  notes: string[];
  /** Notability weight. 0 unless status is 'counts' or 'partial'. */
  weight: number;
  /** One-line verdict for compact display. */
  headline: string;
}

export interface SourceInput {
  url: string;
  title?: string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reliability tiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outlets whose reporting carries the most weight at AfD. Kept deliberately
 * short — these are wire services and papers of record.
 */
const TIER_1_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'afp.com', 'bbc.com', 'bbc.co.uk',
  'nytimes.com', 'wsj.com', 'washingtonpost.com', 'ft.com', 'theguardian.com',
  'economist.com', 'bloomberg.com', 'latimes.com', 'theatlantic.com',
  'newyorker.com', 'propublica.org', 'npr.org', 'pbs.org',
  'nature.com', 'science.org', 'smh.com.au', 'theage.com.au',
  'independent.co.uk', 'telegraph.co.uk', 'thetimes.co.uk',
  'spiegel.de', 'dw.com', 'aljazeera.com', 'haaretz.com',
]);

/**
 * Domains where the masthead is reliable but a large share of URLs are
 * contributor/syndicated content that carries no editorial vetting.
 * These need per-URL scrutiny rather than blanket trust.
 */
const MIXED_EDITORIAL_DOMAINS = new Set([
  'forbes.com',        // WP:FORBESCON — contributor posts are self-published
  'entrepreneur.com',  // large syndicated/contributor programme
  'inc.com',
  'fastcompany.com',
  'yahoo.com',         // syndicates wire copy verbatim
  'msn.com',           // aggregator, republishes everything
  'businessinsider.com',
  'huffpost.com',
  'thestreet.com',
  'ibtimes.com',
  'observer.com',
  'techtimes.com',
]);

function toTier(reliabilityLabel: string, inList: boolean, domain: string): ReliabilityTier {
  if (TIER_1_DOMAINS.has(domain)) return 'tier1';
  if (!inList) return 'unknown';
  switch (reliabilityLabel) {
    case 'Generally reliable':   return 'reliable';
    case 'No consensus':         return 'situational';
    case 'Generally unreliable': return 'unreliable';
    case 'Deprecated':           return 'deprecated';
    default:                     return 'unknown';
  }
}

/** Looks the domain up on the perennial-sources map, honouring subdomains. */
function lookupReliability(domain: string): { label: string; inList: boolean; name: string | null } {
  for (const key of Object.keys(wikipediaSourceReliability)) {
    if (domain === key || domain.endsWith(`.${key}`)) {
      const entry = wikipediaSourceReliability[key];
      return { label: entry.reliability, inList: true, name: entry.name };
    }
  }
  return { label: 'Unknown', inList: false, name: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Independence signals that live in the URL / headline rather than the domain
// ─────────────────────────────────────────────────────────────────────────────

/** Forbes/Entrepreneur-style paid contributor programmes (WP:FORBESCON). */
const CONTRIBUTOR_URL_MARKERS = [
  '/sites/forbes', 'forbes.com/sites/', '/councils/', '/council-post',
  '/contributor/', '/contributors/', '/guest-post', '/guest-author',
  '/expert-panel', '/leadership-council', '/business-council',
  '/agency-council', '/technology-council', '/communications-council',
  '/finance-council', '/coaches-council', '/nonprofit-council',
  '/young-entrepreneur-council', '/blogs/', '/blog/',
];

const CONTRIBUTOR_TEXT_MARKERS = [
  'council post', 'contributor', 'guest post', 'guest column',
  'opinion contributed', 'expert panel', 'members of forbes',
];

/** Wire copy republished on an otherwise-reliable domain. */
const SYNDICATION_MARKERS = [
  'prnewswire', 'pr newswire', 'business wire', 'businesswire',
  'globe newswire', 'globenewswire', 'accesswire', 'einpresswire',
  'ein presswire', 'pr web', 'prweb', 'marketwired', 'newsfile corp',
  'via ap newsroom', '/pr-newswire/', '/business-wire/', '/globenewswire/',
  '/newswire/', 'source: prnewswire', 'source: business wire',
];

/** Sponsored / advertorial placements — paid, therefore not independent. */
const SPONSORED_MARKERS = [
  'sponsored', 'advertorial', 'paid post', 'paid content', 'partner content',
  'promoted', 'brand studio', 'brandvoice', 'brand voice', 'in partnership with',
  'presented by', 'advertisement feature', 'promoted content', 'branded content',
];

/**
 * Interviews and Q&As are PRIMARY sources — the subject is speaking about
 * themselves. Useful for facts, useless for notability (WP:PRIMARY, WP:INTERVIEW).
 */
const INTERVIEW_MARKERS = [
  'interview', 'interviewed', 'in conversation with', 'q&a', 'q & a',
  ' talks about ', ' tells us ', ' on how i ', 'in his own words',
  'in her own words', 'in their own words', 'ask me anything',
  ' shares his ', ' shares her ', ' shares their ', ' opens up about ',
  ' sat down with ', ' speaks to ', ' speaks with ', 'oral history',
];

/**
 * Routine business announcements. WP:CORPDEPTH explicitly excludes these even
 * when a reliable outlet reports them.
 */
const ROUTINE_ANNOUNCEMENT_MARKERS = [
  'announces', 'announcement', 'launches', 'launch of', 'unveils', 'introduces',
  'appoints', 'appointment of', 'names new', 'joins as', 'hires',
  'raises $', 'raises £', 'secures funding', 'closes round', 'series a',
  'series b', 'series c', 'funding round', 'acquires', 'acquisition of',
  'merger with', 'partners with', 'partnership with', 'expands to',
  'opens new', 'wins award', 'named to', 'recognized as', 'recognised as',
  'honored as', 'honoured as', 'ranked among', 'makes the list',
  'celebrates', 'anniversary', 'earnings', 'quarterly results',
];

/** Listicles and rankings rarely constitute significant coverage. */
const LISTICLE_MARKERS = [
  'top 10', 'top 20', 'top 25', 'top 50', 'top 100', 'best of',
  ' to watch', 'rising stars', '30 under 30', '40 under 40',
  'people to know', 'movers and shakers', 'power list',
];

/**
 * `getEffectiveDomain` never throws — on unparseable input it returns the input
 * unchanged — so validate the URL shape ourselves before trusting it.
 */
function parseDomain(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  let hostname: string;
  try {
    hostname = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  // A real hostname has a dot, no whitespace, and a plausible TLD.
  if (!hostname || /\s/.test(hostname)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) return null;

  return getEffectiveDomain(withScheme).replace(/^www\./, '').toLowerCase();
}

function containsAny(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    if (n.trim() && haystack.includes(n)) return n;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage depth (WP:SIGCOV)
// ─────────────────────────────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Turns a URL path into readable words so it can be matched like a headline.
 * News slugs are generated from headlines, so "/business/jane-doe-rebuilt-acme"
 * is strong evidence the piece is about Jane Doe.
 */
function urlToWords(rawUrl: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    return normalizeForMatch(
      decodeURIComponent(u.pathname)
        .replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/[-_/+]/g, ' '),
    );
  } catch {
    return '';
  }
}

/**
 * Decides whether the source is *about* the subject or merely mentions it.
 *
 * We cannot fetch the page body, so evidence is ranked by strength:
 *   headline > URL slug > snippet.
 *
 * `basis` records which signal was used, so the UI can tell the user when the
 * depth judgement is inferred rather than observed.
 */
function assessCoverage(
  subject: string,
  title: string,
  description: string,
  urlWords: string,
): { depth: CoverageDepth; note: string; basis: 'headline' | 'url' | 'snippet' | 'none' } {
  const normSubject = normalizeForMatch(subject);
  if (!normSubject) {
    return { depth: 'unknown', note: 'No subject supplied to compare against.', basis: 'none' };
  }

  const normTitle = normalizeForMatch(title);
  const normDesc = normalizeForMatch(description);
  const subjectWords = normSubject.split(' ').filter(w => w.length > 2);

  const allWordsIn = (hay: string) =>
    subjectWords.length > 1 && subjectWords.every(w => hay.includes(w));

  // 1. Headline — the strongest signal.
  if (normTitle && (normTitle.includes(normSubject) || allWordsIn(normTitle))) {
    return {
      depth: 'significant',
      note: 'Subject appears in the headline — likely the article’s main topic.',
      basis: 'headline',
    };
  }

  // 2. URL slug — nearly as strong, since slugs are built from headlines.
  if (urlWords && (urlWords.includes(normSubject) || allWordsIn(urlWords))) {
    return {
      depth: 'significant',
      note: 'Subject appears in the URL slug, which is generated from the headline — the article is very likely about them. Confirm the piece is substantial rather than a brief item.',
      basis: 'url',
    };
  }

  // 3. Snippet only — a mention inside a piece about something else.
  if (normDesc && (normDesc.includes(normSubject) || allWordsIn(normDesc))) {
    return {
      depth: 'passing',
      note: 'Subject appears only in the snippet, not the headline — likely a passing mention rather than substantial coverage.',
      basis: 'snippet',
    };
  }

  // Nothing to go on at all.
  if (!normTitle && !normDesc && !urlWords) {
    return {
      depth: 'unknown',
      note: 'No headline, snippet or descriptive URL available to judge depth of coverage.',
      basis: 'none',
    };
  }

  // We had something to check and the subject was not in it.
  if (!normTitle && !normDesc) {
    return {
      depth: 'unknown',
      note: 'The URL gives no indication of the subject. Check manually whether this piece is actually about them.',
      basis: 'none',
    };
  }

  return {
    depth: 'passing',
    note: 'Subject does not appear in the headline or snippet — this source is probably about something else.',
    basis: 'none',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Weighting
// ─────────────────────────────────────────────────────────────────────────────

const TIER_WEIGHT: Record<ReliabilityTier, number> = {
  tier1: 1.0,
  reliable: 0.85,
  situational: 0.4,
  unknown: 0.25,
  unreliable: 0,
  deprecated: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main evaluator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates one source against Wikipedia's sourcing policy.
 *
 * @param input   The source (URL required; title/description improve accuracy).
 * @param subject The entity being assessed. Omit for domain-level evaluation
 *                only, in which case coverage depth is reported as 'unknown'.
 */
export function evaluateSource(input: SourceInput, subject = ''): SourceVerdict {
  const rawUrl = (input.url || '').trim();
  const title = input.title || '';
  const description = input.description || '';

  const failures: PolicyFinding[] = [];
  const notes: string[] = [];

  // ── Parse the URL ──────────────────────────────────────────────────────────
  const domain = parseDomain(rawUrl);
  if (!domain) {
    return {
      url: rawUrl,
      domain: '',
      status: 'fails',
      tier: 'unknown',
      independent: false,
      secondary: true,
      coverage: 'unknown',
      coverageBasis: 'none',
      outletName: null,
      failures: [{ policy: 'Invalid URL', detail: 'This does not look like a usable web address.' }],
      notes: [],
      weight: 0,
      headline: 'Not a valid URL',
    };
  }

  const lowerUrl = rawUrl.toLowerCase();
  const haystack = normalizeForMatch(`${title} ${description}`);
  // Slugs are generated from headlines, so they carry the same signals when the
  // caller only supplied a bare URL.
  const urlWords = urlToWords(rawUrl);
  const editorialText = `${haystack} ${urlWords}`.trim();

  // ── Gate 1: reliability ────────────────────────────────────────────────────
  const { label, inList, name } = lookupReliability(domain);
  let tier = toTier(label, inList, domain);

  if (tier === 'deprecated') {
    failures.push({
      policy: 'WP:DEPRECATED',
      detail: `${name || domain} is deprecated on Wikipedia's perennial sources list. It cannot be used as a citation at all.`,
    });
  } else if (tier === 'unreliable') {
    failures.push({
      policy: 'WP:RS',
      detail: `${name || domain} is listed as generally unreliable and does not support notability.`,
    });
  } else if (tier === 'unknown') {
    notes.push(
      'This domain is not on Wikipedia’s perennial sources list, so its reliability cannot be confirmed automatically. Open it and check for a masthead, named journalists and a corrections policy. If it is a genuine publication it may qualify; if it is a profile, listing or blog it does not.',
    );
  }

  // ── Gate 2: independence ───────────────────────────────────────────────────
  const prCheck = detectPressReleaseOrSelfPromo(rawUrl, domain);
  let independent = true;

  if (prCheck.isPressRelease) {
    independent = false;
    failures.push({
      policy: prCheck.category === 'social_media' ? 'WP:SOCIALMEDIA'
            : prCheck.category === 'self_publish' ? 'WP:SELFPUB'
            : prCheck.category === 'directory' ? 'WP:DIRECTORY'
            : 'WP:ORGIND',
      detail: prCheck.reason || 'Not an independent source.',
    });
    notes.push(getPressReleaseLabel(prCheck.category));
  }

  // Contributor / council content — self-published even on a reliable masthead.
  const contributorHit =
    containsAny(lowerUrl, CONTRIBUTOR_URL_MARKERS) || containsAny(haystack, CONTRIBUTOR_TEXT_MARKERS);
  if (contributorHit) {
    independent = false;
    const isForbes = domain.endsWith('forbes.com');
    failures.push({
      policy: isForbes ? 'WP:FORBESCON' : 'WP:SELFPUB',
      detail: isForbes
        ? 'Forbes contributor and Council posts are written by paid members with no editorial fact-checking. Wikipedia treats them as self-published and they carry no notability weight.'
        : `Contributor or guest-authored content (matched "${contributorHit}") is self-published — it has not passed editorial review.`,
    });
  }

  // Wire copy republished on a reliable domain.
  const syndicationHit = containsAny(lowerUrl, SYNDICATION_MARKERS) || containsAny(haystack, SYNDICATION_MARKERS);
  if (syndicationHit) {
    independent = false;
    failures.push({
      policy: 'WP:ORGIND',
      detail: `This is wire-service copy republished here (matched "${syndicationHit}"). The text originates from the subject's own press release, so hosting it on a reputable domain does not make it independent.`,
    });
  }

  // Sponsored / advertorial.
  const sponsoredHit = containsAny(lowerUrl, SPONSORED_MARKERS) || containsAny(haystack, SPONSORED_MARKERS);
  if (sponsoredHit) {
    independent = false;
    failures.push({
      policy: 'WP:ORGIND',
      detail: `Sponsored or branded content (matched "${sponsoredHit}") is paid placement, not independent journalism.`,
    });
  }

  // ── Gate 3: secondary vs primary ───────────────────────────────────────────
  const interviewHit = containsAny(editorialText, INTERVIEW_MARKERS);
  let secondary = true;
  if (interviewHit) {
    // Note this does NOT clear `independent`: an interview in a quality paper is
    // still independent of the subject. It fails because it is primary.
    secondary = false;
    failures.push({
      policy: 'WP:PRIMARY',
      detail: `This looks like an interview or first-person piece (matched "${interviewHit}"). The outlet may be impeccable, but the subject speaking about themselves is a primary source — it can verify facts inside an article, and does not help establish that the article should exist.`,
    });
  }

  // ── Gate 4: significant coverage ───────────────────────────────────────────
  const { depth, note: coverageNote, basis } = assessCoverage(subject, title, description, urlWords);
  // The coverage note is only added below, and only when the source has not
  // already failed a hard gate — telling the user a rejected LinkedIn profile
  // "is very likely about them" is noise.

  const routineHit = containsAny(editorialText, ROUTINE_ANNOUNCEMENT_MARKERS);
  const listicleHit = containsAny(editorialText, LISTICLE_MARKERS);

  let coverage = depth;

  if (routineHit && tier !== 'tier1') {
    coverage = 'passing';
    failures.push({
      policy: 'WP:CORPDEPTH',
      detail: `Routine announcement coverage (matched "${routineHit}"). Funding rounds, hires, launches, awards and partnerships are explicitly excluded from establishing notability.`,
    });
  } else if (routineHit && tier === 'tier1') {
    notes.push(
      `Headline reads like a routine announcement (matched "${routineHit}"), but this is a top-tier outlet — check whether the piece contains independent analysis or just relays the announcement.`,
    );
  }

  if (listicleHit) {
    coverage = 'passing';
    failures.push({
      policy: 'WP:SIGCOV',
      detail: `Ranking or listicle content (matched "${listicleHit}") gives each entry a line or two — that is not coverage "in detail".`,
    });
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  const reliabilityFails = tier === 'unreliable' || tier === 'deprecated';
  const hardFail = reliabilityFails || !independent || !secondary;

  if (subject && !hardFail) notes.push(coverageNote);

  let status: SourceStatus;
  if (hardFail) {
    status = 'fails';
  } else if (coverage === 'significant') {
    status = 'counts';
  } else if (coverage === 'unknown') {
    // Domain-level check with no subject: report reliability only.
    status = 'partial';
  } else {
    status = 'partial';
    if (!failures.some(f => f.policy === 'WP:SIGCOV' || f.policy === 'WP:CORPDEPTH')) {
      failures.push({
        policy: 'WP:SIGCOV',
        detail: 'Coverage of the subject looks incidental rather than substantial. Wikipedia requires sources that address the subject directly and in detail.',
      });
    }
  }

  // An unverified domain cannot establish notability. Wikipedia's perennial list
  // is not exhaustive, so this is not a claim the source is bad — but a strict
  // reviewer does not accept an unassessed domain as evidence, and in practice
  // most unknown domains surfacing for a person are profiles, listings and
  // content farms rather than publications. Downgraded to supporting and
  // reported under "needs manual review" so a real publication can be promoted
  // by hand rather than silently credited.
  if (status === 'counts' && tier === 'unknown') {
    status = 'partial';
    failures.push({
      policy: 'WP:RS',
      detail:
        'Reliability of this domain could not be verified — it is not on Wikipedia’s perennial sources list. It is not counted toward notability until you confirm it is an established publication with editorial oversight.',
    });
  }

  // Aggregators and contributor-heavy mastheads republish wire copy under their
  // own slug, so a URL-slug inference is not enough to call it real coverage.
  // Require an actual headline before crediting these domains.
  if (status === 'counts' && basis === 'url' && MIXED_EDITORIAL_DOMAINS.has(domain)) {
    status = 'partial';
    failures.push({
      policy: 'WP:ORGIND',
      detail: `${name || domain} carries a large volume of syndicated and contributor material under its own URLs. Without the headline and byline we cannot tell staff journalism from republished PR, so this cannot be credited as independent coverage.`,
    });
  }

  // Situational sources never fully count on their own.
  if (status === 'counts' && tier === 'situational') {
    status = 'partial';
    notes.push('Reliability of this outlet is context-dependent (no consensus on WP:RSP), so it supports but does not by itself establish notability.');
  }

  const baseWeight = TIER_WEIGHT[tier];
  const weight = status === 'counts' ? baseWeight : status === 'partial' ? baseWeight * 0.3 : 0;

  // ── Headline ───────────────────────────────────────────────────────────────
  let headline: string;
  if (status === 'counts') {
    headline = tier === 'tier1'
      ? 'Counts toward notability — top-tier independent coverage'
      : 'Counts toward notability — reliable, independent, substantial';
  } else if (status === 'fails') {
    headline = failures[0]?.policy === 'WP:DEPRECATED'
      ? 'Cannot be cited — deprecated source'
      : `Does not count — ${failures[0]?.policy || 'fails Wikipedia sourcing policy'}`;
  } else if (!subject) {
    // Domain-level check only: we verified reliability and independence but
    // cannot judge depth of coverage without knowing who the article is about.
    headline = 'Reliable and independent — add the subject name to judge coverage depth';
  } else {
    headline = 'Supporting only — usable for facts, not for notability';
  }

  if (MIXED_EDITORIAL_DOMAINS.has(domain) && status !== 'fails') {
    notes.push(
      `${name || domain} carries both staff journalism and contributor/syndicated material. Confirm this specific piece has a staff byline.`,
    );
  }

  return {
    url: rawUrl,
    domain,
    status,
    tier,
    independent,
    secondary,
    coverage,
    coverageBasis: basis,
    outletName: name,
    failures,
    notes: notes.filter(Boolean),
    weight,
    headline,
  };
}

/** Convenience wrapper for scoring a batch of pasted URLs. */
export function evaluateSources(inputs: SourceInput[], subject = ''): SourceVerdict[] {
  return inputs.map(i => evaluateSource(i, subject));
}

// ─────────────────────────────────────────────────────────────────────────────
// Notability roll-up (WP:GNG)
// ─────────────────────────────────────────────────────────────────────────────

export interface NotabilityAssessment {
  /** Sources clearing all four gates. */
  qualifyingCount: number;
  /** Distinct domains among the qualifying sources. */
  qualifyingDomains: number;
  /** Weighted total used to derive the score. */
  weightedTotal: number;
  /**
   * Reliable, independent sources whose depth of coverage could not be judged
   * from the information supplied. These are not counted, but they are not
   * evidence of absence either — the user should check them by hand.
   */
  needsManualReview: number;
  score: number;
  eligible: boolean;
  verdict: string;
}

/**
 * Rolls individual verdicts up into a 0–100 score.
 *
 * The curve is anchored on what actually decides an AfD: the NUMBER of
 * independent, reliable, in-depth sources. Three solid sources from three
 * different publishers is the practical floor for GNG, and that lands at 66.
 *
 * Per-domain diminishing returns are steep — five pieces in one outlet is one
 * publisher's editorial judgement, not five.
 */
export function assessNotability(verdicts: SourceVerdict[]): NotabilityAssessment {
  const qualifying = verdicts.filter(v => v.status === 'counts');
  const supporting = verdicts.filter(v => v.status === 'partial');

  const perDomain = new Map<string, number>();
  let weightedTotal = 0;

  // Strongest sources first so the full-weight slot goes to the best piece.
  [...qualifying]
    .sort((a, b) => b.weight - a.weight)
    .forEach(v => {
      const seen = perDomain.get(v.domain) || 0;
      // 1st from a domain: full. 2nd: 40%. 3rd+: nothing.
      const factor = seen === 0 ? 1 : seen === 1 ? 0.4 : 0;
      weightedTotal += v.weight * factor;
      perDomain.set(v.domain, seen + 1);
    });

  // Supporting sources contribute a small amount, capped.
  const supportingBonus = Math.min(supporting.reduce((sum, v) => sum + v.weight, 0), 3);
  weightedTotal += supportingBonus;

  const qualifyingDomains = perDomain.size;

  // Map weighted total to a score. 3 strong independent domains ≈ 2.7 weighted
  // units, which must land at the 66 eligibility line.
  let score: number;
  if (weightedTotal <= 0) {
    score = 5;
  } else if (weightedTotal < 2.7) {
    // 0 → 5, 2.7 → 66
    score = 5 + (weightedTotal / 2.7) * 61;
  } else {
    // Diminishing gains above the threshold; 8 units ≈ 95.
    score = 66 + Math.min(29, (weightedTotal - 2.7) * 5.5);
  }

  // Hard caps when there are not enough distinct publishers. Wikipedia does not
  // accept one outlet, however good, as proof of notability.
  //
  // Zero qualifying sources is capped hardest: a large pile of supporting
  // material is not "nearly there", and without this a subject with dozens of
  // directory listings lands at the same 45 as one with a single strong
  // article, which reads as far more encouraging than the evidence warrants.
  if (qualifying.length === 0) score = Math.min(score, 30);
  else if (qualifyingDomains < 2) score = Math.min(score, 45);
  else if (qualifyingDomains === 2) score = Math.min(score, 62);

  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;

  const eligible = score >= 66 && qualifyingDomains >= 3;

  // Sources a human could plausibly promote to "counts" after checking them:
  // either a known-reliable outlet whose depth we could not measure, or an
  // unassessed domain that otherwise looks like real coverage.
  const needsManualReview = verdicts.filter(v => {
    if (v.status !== 'partial' || !v.independent || !v.secondary) return false;
    const knownOutletUnknownDepth =
      v.coverage === 'unknown' && (v.tier === 'tier1' || v.tier === 'reliable');
    const unknownOutletRealCoverage = v.tier === 'unknown' && v.coverage === 'significant';
    return knownOutletUnknownDepth || unknownOutletRealCoverage;
  }).length;

  let verdict: string;
  if (qualifying.length === 0 && needsManualReview > 0) {
    // Do NOT claim the subject fails — we never established depth either way.
    verdict =
      `No source could be confirmed as in-depth coverage, but ${needsManualReview} reliable, ` +
      `independent source${needsManualReview === 1 ? '' : 's'} could not be assessed for depth from ` +
      `the URL alone. Open ${needsManualReview === 1 ? 'it' : 'them'} and check whether the subject is ` +
      `the main topic — if so, this set may well qualify.`;
  } else if (qualifying.length === 0) {
    verdict = 'No sources clear Wikipedia’s bar. An article created on this evidence would be deleted at AfD.';
  } else if (qualifyingDomains < 3) {
    verdict = `Only ${qualifyingDomains} independent publisher${qualifyingDomains === 1 ? ' provides' : 's provide'} qualifying coverage. Wikipedia expects at least three before an article is likely to survive.`;
  } else if (score >= 80) {
    verdict = `${qualifying.length} qualifying sources across ${qualifyingDomains} publishers. This comfortably meets the general notability guideline.`;
  } else {
    verdict = `${qualifying.length} qualifying sources across ${qualifyingDomains} publishers. This meets the minimum bar, but a strict reviewer may still challenge it.`;
  }

  return {
    qualifyingCount: qualifying.length,
    qualifyingDomains,
    weightedTotal: Math.round(weightedTotal * 100) / 100,
    needsManualReview,
    score,
    eligible,
    verdict,
  };
}
