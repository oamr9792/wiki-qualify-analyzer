/**
 * pressReleaseDetector.ts
 *
 * Detects whether a URL is a press release, self-promotional content,
 * or otherwise non-independent coverage that CANNOT establish Wikipedia notability.
 *
 * Wikipedia policy references:
 *   WP:RS  — sources must be independent of the subject
 *   WP:SELFPUB — self-published sources cannot establish notability
 *   WP:NOTRELIABLE — press releases, directories, social media do not count
 *   WP:SIGCOV — coverage must be significant AND independent
 *   WP:PROMO — promotional content is explicitly excluded
 */

// ── CATEGORY 1: Press release wire services ──────────────────────────────────
// These exist solely to distribute company press releases.
// WP:NOTRELIABLE § Press releases
export const WIRE_SERVICE_DOMAINS = new Set([
  'prnewswire.com', 'businesswire.com', 'globenewswire.com', 'prweb.com',
  'einpresswire.com', 'accesswire.com', 'newswire.com', 'prlog.org',
  'send2press.com', 'marketwired.com', 'cision.com', 'prnews.io',
  'issuewire.com', 'openpr.com', 'presswire.com', '24-7pressrelease.com',
  'prfire.co.uk', 'responsesource.com', 'mynewsdesk.com', 'marketersmedia.com',
  'pr.com', 'free-press-release.com', 'i-newswire.com', 'prurgent.com',
  'przoom.com', 'pressbox.co.uk', 'newsfilecorp.com', 'tmxmoney.com',
  'sedar.com', 'einnews.com', 'sbwire.com', 'abnewswire.com', 'releasewire.com',
  'noodls.com', 'virtual-strategy.com', 'whowire.com',
]);

// ── CATEGORY 2: Business directories and aggregators ─────────────────────────
// Pull structured data; no editorial judgment. WP:DIRECTORY
export const DIRECTORY_DOMAINS = new Set([
  'crunchbase.com', 'zoominfo.com', 'dnb.com', 'manta.com',
  'yellowpages.com', 'whitepages.com', 'superpages.com', 'bbb.org',
  'angieslist.com', 'thumbtack.com', 'clutch.co', 'g2.com',
  'capterra.com', 'trustpilot.com', 'glassdoor.com', 'comparably.com',
  'indeed.com', 'owler.com', 'pitchbook.com', 'tracxn.com', 'craft.co',
  'signalhire.com', 'rocketreach.co', 'apollo.io', 'clearbit.com',
  'builtwith.com', 'similarweb.com', 'semrush.com', 'alexa.com',
  'kompass.com', 'europages.com', 'hotfrog.com', 'bizapedia.com',
  'opencorporates.com', 'f6s.com', 'gust.com', 'startupranking.com',
  'wellfound.com', 'producthunt.com',
]);

// ── CATEGORY 3: Social media and user-generated content ──────────────────────
// Wikipedia: WP:SOCIALMEDIA — explicitly prohibited
export const SOCIAL_MEDIA_DOMAINS = new Set([
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'reddit.com', 'quora.com', 'tiktok.com', 'pinterest.com',
  'snapchat.com', 'telegram.org', 't.me', 'discord.com', 'mastodon.social',
  'threads.net', 'bsky.app',
]);

// ── CATEGORY 4: Self-publishing platforms ────────────────────────────────────
// No editorial oversight. WP:SELFPUB
export const SELF_PUBLISH_DOMAINS = new Set([
  'medium.com', 'wordpress.com', 'blogspot.com', 'substack.com',
  'wix.com', 'squarespace.com', 'weebly.com', 'ghost.io',
  'tumblr.com', 'livejournal.com', 'hubpages.com', 'ezinearticles.com',
]);

// ── CATEGORY 5: Press-release aggregators / content farms ────────────────────
// Republish press releases verbatim or produce low-standards SEO content.
export const CONTENT_FARM_DOMAINS = new Set([
  'digitaljournal.com', 'stocknewsgazette.com', 'wallstreetreporter.com',
  'streetinsider.com', 'benzinga.com',
]);

// ── URL PATH PATTERNS ─────────────────────────────────────────────────────────
// Even reliable domains have press-release *sections* that are not journalism.
// e.g. reuters.com/press-releases/ is a paid distribution service.
const PRESS_RELEASE_PATH_PATTERNS: string[] = [
  '/press-release', '/press_release', '/pressrelease', '/press-releases',
  '/news-release', '/newsrelease', '/news-releases',
  '/investor-relations', '/investors/', '/investor/', '/ir/', '/ir-news',
  '/media-releases', '/media-release', '/media-centre/press',
  '/corporate/press', '/corporate/news/press',
  '/about-us', '/about_us', '/our-story', '/company/about',
  '/official-statement', '/announcement',
  '/sponsored/', '/sponsored-content', '/partner-content',
  '/brandstudio', '/advertiser-content', '/paid-content',
  '/brand-voice', '/advertorial',
];

// ── Known editorial subdomains to EXCLUDE from path-pattern checks ────────────
// Some big outlets have both editorial and PR sections; don't block the whole domain.
const EDITORIAL_DOMAINS_EXEMPT_FROM_PATH_CHECK = new Set([
  'techcrunch.com', 'reuters.com', 'bloomberg.com', 'apnews.com',
  'businessinsider.com',
]);

// ─────────────────────────────────────────────────────────────────────────────

export interface PressReleaseDetectionResult {
  isPressRelease: boolean;
  reason: string | null;
  /** Fine-grained category so the UI can display the right badge text */
  category: 'wire_service' | 'directory' | 'social_media' | 'self_publish' | 'content_farm' | 'pr_path' | 'independent' | null;
}

export function detectPressReleaseOrSelfPromo(
  url: string,
  domain: string,
): PressReleaseDetectionResult {
  const lowerUrl = url.toLowerCase();
  const normDomain = domain.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');

  const matchesDomainSet = (set: Set<string>): boolean => {
    for (const d of set) {
      if (normDomain === d || normDomain.endsWith(`.${d}`)) return true;
    }
    return false;
  };

  if (matchesDomainSet(WIRE_SERVICE_DOMAINS)) {
    return { isPressRelease: true, reason: 'Press release wire service — content is written by the company, not by journalists.', category: 'wire_service' };
  }
  if (matchesDomainSet(DIRECTORY_DOMAINS)) {
    return { isPressRelease: true, reason: 'Business directory or aggregator — not independent editorial coverage.', category: 'directory' };
  }
  if (matchesDomainSet(SOCIAL_MEDIA_DOMAINS)) {
    return { isPressRelease: true, reason: 'Social media — explicitly excluded by Wikipedia policy (WP:SOCIALMEDIA).', category: 'social_media' };
  }
  if (matchesDomainSet(SELF_PUBLISH_DOMAINS)) {
    return { isPressRelease: true, reason: 'Self-publishing platform — no editorial oversight (WP:SELFPUB).', category: 'self_publish' };
  }
  if (matchesDomainSet(CONTENT_FARM_DOMAINS)) {
    return { isPressRelease: true, reason: 'Site primarily republishes press releases without editorial oversight.', category: 'content_farm' };
  }

  // Path-pattern check — only for non-exempt domains
  const isExempt = [...EDITORIAL_DOMAINS_EXEMPT_FROM_PATH_CHECK].some(
    d => normDomain === d || normDomain.endsWith(`.${d}`)
  );
  if (!isExempt) {
    for (const pattern of PRESS_RELEASE_PATH_PATTERNS) {
      if (lowerUrl.includes(pattern)) {
        return {
          isPressRelease: true,
          reason: `URL path contains "${pattern}" — indicates press release or company-controlled page, not independent journalism.`,
          category: 'pr_path',
        };
      }
    }
  }

  return { isPressRelease: false, reason: null, category: 'independent' };
}

export function getPressReleaseLabel(category: PressReleaseDetectionResult['category']): string {
  switch (category) {
    case 'wire_service':  return 'Press release wire — not independent';
    case 'directory':     return 'Business directory — not editorial';
    case 'social_media':  return 'Social media — excluded by WP policy';
    case 'self_publish':  return 'Self-published — no editorial oversight';
    case 'content_farm':  return 'PR aggregator — not original journalism';
    case 'pr_path':       return 'Press release section — not editorial';
    default:              return '';
  }
}
