/**
 * Verification harness for the strict-evaluation rewrite.
 *
 * Run with:  npm run verify
 *
 * Covers the three reported defects:
 *   1. False "article already exists" verdicts
 *   2. Press releases / non-independent sources counting toward notability
 *   3. The new per-source checker returning sane verdicts
 */

import { evaluateSource, assessNotability, SourceVerdict } from '../src/utils/sourceEvaluation';
import { checkWikipediaExistence, normalizeTitle, stripQualifier } from '../src/services/wikipediaExistenceService';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failed++;
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ═════════════════════════════════════════════════════════════════════════════
async function main() {

  section('1. Title normalisation');

  check('strips diacritics', normalizeTitle('Zoë Müller') === 'zoe muller', normalizeTitle('Zoë Müller'));
  check('strips punctuation', normalizeTitle('Smith, Jane (Jr.)') === 'smith jane jr', normalizeTitle('Smith, Jane (Jr.)'));
  check('strips qualifier', stripQualifier('Jane Doe (author)') === 'Jane Doe', stripQualifier('Jane Doe (author)'));
  check('leaves bare title alone', stripQualifier('Jane Doe') === 'Jane Doe');

  // ═══════════════════════════════════════════════════════════════════════════
  section('2. Wikipedia existence — the reported false positive');

  const orani = await checkWikipediaExistence('orani amroussi');
  check(
    '"orani amroussi" is NOT reported as existing',
    orani.status === 'not_found',
    `got status="${orani.status}" url=${orani.url}`,
  );
  check(
    'explanation mentions no article is titled that',
    /no wikipedia article is titled|returned no results/i.test(orani.explanation),
    orani.explanation,
  );

  const obama = await checkWikipediaExistence('Barack Obama');
  check('"Barack Obama" IS reported as existing', obama.status === 'exists', `got "${obama.status}"`);
  check('…with the right URL', obama.url === 'https://en.wikipedia.org/wiki/Barack_Obama', String(obama.url));

  const orani2 = await checkWikipediaExistence('Orani');
  check('"Orani" alone resolves', orani2.status === 'exists' || orani2.isDisambiguation, `got "${orani2.status}"`);

  const nonsense = await checkWikipediaExistence('Qwertzuiop Asdfghjkl Consulting');
  check('nonsense entity is not_found', nonsense.status === 'not_found', `got "${nonsense.status}"`);

  // ═══════════════════════════════════════════════════════════════════════════
  section('3. Source evaluation — press releases must never count');

  const wire = evaluateSource({
    url: 'https://www.prnewswire.com/news-releases/acme-corp-announces-expansion-301234567.html',
    title: 'Acme Corp Announces Major Expansion',
    description: 'Acme Corp today announced it will expand operations.',
  }, 'Acme Corp');
  check('PR Newswire fails', wire.status === 'fails', wire.headline);
  check('…flagged as not independent', wire.independent === false);

  const syndicated = evaluateSource({
    url: 'https://finance.yahoo.com/news/acme-corp-announces-expansion-120000123.html',
    title: 'Acme Corp Announces Major Expansion',
    description: 'PRNewswire — Acme Corp today announced it will expand operations.',
  }, 'Acme Corp');
  check(
    'wire copy syndicated onto Yahoo fails',
    syndicated.status === 'fails',
    `${syndicated.headline} | ${syndicated.failures.map(f => f.policy).join(',')}`,
  );

  const forbesCouncil = evaluateSource({
    url: 'https://www.forbes.com/sites/forbesbusinesscouncil/2024/03/01/why-leadership-matters/',
    title: 'Why Leadership Matters',
    description: 'Council Post by Jane Doe, CEO of Acme Corp.',
  }, 'Jane Doe');
  check(
    'Forbes Council post fails (WP:FORBESCON)',
    forbesCouncil.status === 'fails' && forbesCouncil.failures.some(f => f.policy === 'WP:FORBESCON'),
    forbesCouncil.failures.map(f => f.policy).join(','),
  );

  const sponsored = evaluateSource({
    url: 'https://www.theguardian.com/sponsored/2024/acme-story',
    title: 'How Acme Corp is changing the industry',
    description: 'Paid content produced in partnership with Acme Corp.',
  }, 'Acme Corp');
  check('sponsored content on a tier-1 domain fails', sponsored.status === 'fails', sponsored.headline);

  const linkedin = evaluateSource({
    url: 'https://www.linkedin.com/in/janedoe',
    title: 'Jane Doe - CEO',
    description: 'Jane Doe profile',
  }, 'Jane Doe');
  check('LinkedIn profile fails', linkedin.status === 'fails', linkedin.headline);

  const dailymail = evaluateSource({
    url: 'https://www.dailymail.co.uk/news/article-123/Jane-Doe-profile.html',
    title: 'Jane Doe: the rise of a tech founder',
    description: 'A profile of Jane Doe.',
  }, 'Jane Doe');
  check('Daily Mail is deprecated', dailymail.tier === 'deprecated' && dailymail.status === 'fails', dailymail.headline);

  const interview = evaluateSource({
    url: 'https://www.wired.com/story/jane-doe-founder-chat/',
    title: 'Interview with Jane Doe on building Acme',
    description: 'We sat down with Jane Doe.',
  }, 'Jane Doe');
  check('interview is primary and fails', interview.status === 'fails', interview.failures.map(f => f.policy).join(','));

  // Regression: found live in production. The slug said "interview" but only
  // phrases like "interview with" were matched, so it counted as coverage.
  const slugInterview = evaluateSource(
    { url: 'https://www.theguardian.com/technology/2024/mar/12/marc-benioff-interview' },
    'Marc Benioff',
  );
  check(
    'interview detected from the URL slug alone',
    slugInterview.status === 'fails' && slugInterview.failures.some(f => f.policy === 'WP:PRIMARY'),
    `${slugInterview.status} | ${slugInterview.failures.map(f => f.policy).join(',')}`,
  );
  check(
    '…and is marked primary-but-independent, not "not independent"',
    slugInterview.independent === true && slugInterview.secondary === false,
    `independent=${slugInterview.independent} secondary=${slugInterview.secondary}`,
  );

  const pressReleaseNotSecondaryConfusion = evaluateSource({
    url: 'https://www.prnewswire.com/news-releases/acme-1.html',
  }, 'Acme Corp');
  check(
    'a press release is flagged not-independent (a different gate)',
    pressReleaseNotSecondaryConfusion.independent === false,
    `independent=${pressReleaseNotSecondaryConfusion.independent}`,
  );

  const listicle = evaluateSource({
    url: 'https://www.inc.com/lists/30-under-30-2024',
    title: '30 Under 30: Jane Doe and other rising stars',
    description: 'Our annual list.',
  }, 'Jane Doe');
  check('listicle does not count', listicle.status !== 'counts', listicle.headline);

  const funding = evaluateSource({
    url: 'https://techcrunch.com/2024/01/05/acme-raises-20m-series-a/',
    title: 'Acme Corp raises $20M Series A',
    description: 'The round was led by investors.',
  }, 'Acme Corp');
  check(
    'routine funding announcement does not count (WP:CORPDEPTH)',
    funding.status !== 'counts',
    funding.failures.map(f => f.policy).join(','),
  );

  section('4. Source evaluation — genuine coverage must count');

  const reuters = evaluateSource({
    url: 'https://www.reuters.com/investigates/special-report/jane-doe-empire/',
    title: 'Special report: How Jane Doe built and lost a fortune',
    description: 'A months-long Reuters investigation into Jane Doe.',
  }, 'Jane Doe');
  check('Reuters investigation counts', reuters.status === 'counts', `${reuters.headline} | ${reuters.failures.map(f => f.policy).join(',')}`);
  check('…rated tier1', reuters.tier === 'tier1', reuters.tier);

  const guardian = evaluateSource({
    url: 'https://www.theguardian.com/technology/2024/feb/02/jane-doe-profile',
    title: 'Jane Doe: the woman rebuilding British tech',
    description: 'An in-depth profile.',
  }, 'Jane Doe');
  check('Guardian profile counts', guardian.status === 'counts', guardian.headline);

  const passingMention = evaluateSource({
    url: 'https://www.nytimes.com/2024/03/03/business/tech-industry-trends.html',
    title: 'The tech industry faces a reckoning',
    description: 'Executives including Jane Doe have warned of a downturn.',
  }, 'Jane Doe');
  check('passing mention is partial, not counts', passingMention.status === 'partial', passingMention.headline);

  const unknownDomain = evaluateSource({
    url: 'https://www.someregionalpaper.co.uk/news/jane-doe-profile',
    title: 'Jane Doe profiled by local press',
    description: 'An in-depth look at Jane Doe.',
  }, 'Jane Doe');
  check('unknown domain is flagged for manual review', unknownDomain.tier === 'unknown', unknownDomain.tier);

  const badUrl = evaluateSource({ url: 'not a url at all' }, 'Jane Doe');
  check('garbage input is rejected', badUrl.status === 'fails' && badUrl.headline === 'Not a valid URL', badUrl.headline);

  section('4b. Registries, profiles and unassessed domains must not count');

  // These five were wrongly approved for "orani amroussi" on the live site.
  const wronglyApproved: Array<[string, string]> = [
    ['https://intch.org/16066718', 'networking profile platform'],
    ['https://find-and-update.company-information.service.gov.uk/officers/sfqbv2V3Zrha/appointments', 'Companies House registry'],
    ['https://scholar.google.com/citations?user=2Ull43oAAAAJ&hl=en', 'Google Scholar profile'],
    ['https://featured.com/p/orani-amroussi', 'expert-quote platform'],
    ['https://www.crunchbase.com/person/orani-amroussi', 'business directory'],
  ];

  wronglyApproved.forEach(([url, label]) => {
    const v = evaluateSource({ url, title: 'Orani Amroussi' }, 'Orani Amroussi');
    check(
      `${label} does not count`,
      v.status !== 'counts',
      `${v.status} | ${v.failures.map(f => f.policy).join(',') || 'no failures'} | ${url}`,
    );
  });

  const wholeSet = assessNotability(
    wronglyApproved.map(([url]) => evaluateSource({ url, title: 'Orani Amroussi' }, 'Orani Amroussi')),
  );
  check(
    'the full set that was wrongly approved is now NOT eligible',
    !wholeSet.eligible && wholeSet.qualifyingCount === 0,
    `score=${wholeSet.score} qualifying=${wholeSet.qualifyingCount} eligible=${wholeSet.eligible}`,
  );

  const unknownButPlausible = evaluateSource(
    { url: 'https://www.someregionalpaper.co.uk/news/jane-doe-the-rise-of-a-founder' },
    'Jane Doe',
  );
  check(
    'an unassessed domain is supporting, not counting',
    unknownButPlausible.status === 'partial',
    unknownButPlausible.status,
  );
  check(
    '…and is flagged for manual review rather than dismissed',
    assessNotability([unknownButPlausible]).needsManualReview === 1,
    String(assessNotability([unknownButPlausible]).needsManualReview),
  );

  const knownGoodStillCounts = evaluateSource(
    { url: 'https://www.bbc.co.uk/news/uk-jane-doe-profile', title: 'Jane Doe: a profile' },
    'Jane Doe',
  );
  check(
    'a known-reliable outlet still counts (no over-correction)',
    knownGoodStillCounts.status === 'counts',
    knownGoodStillCounts.headline,
  );

  section('5. URL-only checking (the Source Checker path)');

  const urlOnlyReuters = evaluateSource(
    { url: 'https://www.reuters.com/business/jane-doe-rebuilt-acme-2024-03-01/' },
    'Jane Doe',
  );
  check(
    'Reuters URL with subject in the slug counts',
    urlOnlyReuters.status === 'counts' && urlOnlyReuters.coverageBasis === 'url',
    `${urlOnlyReuters.status}/${urlOnlyReuters.coverageBasis}`,
  );

  const urlOnlyYahoo = evaluateSource(
    { url: 'https://finance.yahoo.com/news/acme-names-jane-doe-120000123.html' },
    'Jane Doe',
  );
  check(
    'Yahoo URL-slug inference does NOT count (syndication risk)',
    urlOnlyYahoo.status !== 'counts',
    `${urlOnlyYahoo.status} | ${urlOnlyYahoo.failures.map(f => f.policy).join(',')}`,
  );

  const urlOnlyOffTopic = evaluateSource(
    { url: 'https://www.reuters.com/markets/global-tech-outlook-2024-01-01/' },
    'Jane Doe',
  );
  check(
    'Reuters URL without the subject does not count',
    urlOnlyOffTopic.status !== 'counts',
    urlOnlyOffTopic.status,
  );

  const urlOnlyPr = evaluateSource(
    { url: 'https://www.prnewswire.com/news-releases/acme-appoints-jane-doe-301234567.html' },
    'Jane Doe',
  );
  check('PR wire still fails even with subject in slug', urlOnlyPr.status === 'fails', urlOnlyPr.headline);

  const urlOnlySet = assessNotability([
    evaluateSource({ url: 'https://www.reuters.com/business/jane-doe-rebuilt-acme/' }, 'Jane Doe'),
    evaluateSource({ url: 'https://www.theguardian.com/business/2024/feb/02/jane-doe-profile' }, 'Jane Doe'),
    evaluateSource({ url: 'https://www.bbc.co.uk/news/business-98765' }, 'Jane Doe'),
  ]);
  check(
    'opaque BBC URL is flagged for manual review, not counted as failure',
    urlOnlySet.needsManualReview >= 1,
    `needsManualReview=${urlOnlySet.needsManualReview}`,
  );

  const allOpaque = assessNotability([
    evaluateSource({ url: 'https://www.bbc.co.uk/news/business-98765' }, 'Jane Doe'),
    evaluateSource({ url: 'https://www.reuters.com/article/idUSKBN123456' }, 'Jane Doe'),
  ]);
  check(
    'an all-opaque-URL set does NOT claim the subject would be deleted',
    !/deleted at afd/i.test(allOpaque.verdict),
    allOpaque.verdict,
  );

  section('6. Notability roll-up');

  const mk = (url: string, title: string): SourceVerdict =>
    evaluateSource({ url, title, description: title }, 'Jane Doe');

  const threeStrong = [
    mk('https://www.reuters.com/world/uk/jane-doe-profile-2024/', 'Jane Doe and the rebuilding of a company'),
    mk('https://www.theguardian.com/business/2024/jane-doe-feature', 'Jane Doe: a life in business'),
    mk('https://www.bbc.co.uk/news/business-12345', 'Jane Doe on the record'),
  ];
  const strongAssessment = assessNotability(threeStrong);
  check(
    'three strong independent domains reach the eligibility line',
    strongAssessment.score >= 66 && strongAssessment.eligible,
    `score=${strongAssessment.score} domains=${strongAssessment.qualifyingDomains} eligible=${strongAssessment.eligible}`,
  );

  const onePublisher = [
    mk('https://www.reuters.com/a/jane-doe-1', 'Jane Doe profile one'),
    mk('https://www.reuters.com/a/jane-doe-2', 'Jane Doe profile two'),
    mk('https://www.reuters.com/a/jane-doe-3', 'Jane Doe profile three'),
  ];
  const onePubAssessment = assessNotability(onePublisher);
  check(
    'three pieces in ONE outlet stays below the line',
    onePubAssessment.score <= 45 && !onePubAssessment.eligible,
    `score=${onePubAssessment.score} domains=${onePubAssessment.qualifyingDomains}`,
  );

  const allPressReleases = [
    mk('https://www.prnewswire.com/news-releases/jane-doe-1.html', 'Jane Doe announces new venture'),
    mk('https://www.businesswire.com/news/home/jane-doe-2', 'Jane Doe announces expansion'),
    mk('https://www.globenewswire.com/news-release/jane-doe-3', 'Jane Doe announces partnership'),
  ];
  const prAssessment = assessNotability(allPressReleases);
  check(
    'an all-press-release profile scores near zero',
    prAssessment.qualifyingCount === 0 && prAssessment.score < 20,
    `score=${prAssessment.score} qualifying=${prAssessment.qualifyingCount}`,
  );

  const emptyAssessment = assessNotability([]);
  check('no sources at all scores minimum', emptyAssessment.score <= 10, `score=${emptyAssessment.score}`);

  // A pile of directory listings must not score the same as one strong article.
  const manyJunkSources = assessNotability(
    Array.from({ length: 40 }, (_, i) =>
      evaluateSource({ url: `https://www.crunchbase.com/person/jane-doe-${i}` }, 'Jane Doe'),
    ),
  );
  check(
    '40 directory listings score no higher than 30',
    manyJunkSources.score <= 30 && manyJunkSources.qualifyingCount === 0,
    `score=${manyJunkSources.score} qualifying=${manyJunkSources.qualifyingCount}`,
  );

  const oneStrongSource = assessNotability([
    evaluateSource(
      { url: 'https://www.bbc.co.uk/news/jane-doe-profile', title: 'Jane Doe: a profile' },
      'Jane Doe',
    ),
  ]);
  check(
    'one strong article outscores 40 directory listings',
    oneStrongSource.score > manyJunkSources.score,
    `strong=${oneStrongSource.score} junk=${manyJunkSources.score}`,
  );

  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n\x1b[1mResult: ${passed} passed, ${failed} failed\x1b[0m`);
  if (failed > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Harness crashed:', err);
  process.exit(1);
});
