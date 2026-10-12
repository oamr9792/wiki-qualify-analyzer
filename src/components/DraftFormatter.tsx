/**
 * DraftFormatter.tsx
 *
 * Wikipedia Draft Formatter — paste article text with inline URL sources
 * in parentheses and get back properly-formatted Wikipedia wikitext with
 * <ref>{{cite web|...}}</ref> citation tags, plus a per-source review panel.
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { detectPressReleaseOrSelfPromo, getPressReleaseLabel } from '@/utils/pressReleaseDetector';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedRef {
  /** The raw URL exactly as pasted */
  url: string;
  /** Ref name derived from the domain, e.g. "bbc1" */
  name: string;
  /** Fetched or guessed page title */
  title: string;
  /** Publisher / site name */
  publisher: string;
  /** ISO date string or empty */
  date: string;
  /** Whether the source passes Wikipedia independence checks */
  verdict: 'qualifying' | 'flagged';
  /** Human-readable reason if flagged */
  flagReason: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Derive a short, wiki-safe ref name from a URL */
function makeRefName(url: string, index: number, used: Set<string>): string {
  const domain = extractDomain(url).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '');
  let base = domain.slice(0, 12) || `ref${index + 1}`;
  let candidate = base;
  let suffix = 1;
  while (used.has(candidate)) {
    candidate = `${base}${suffix++}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Best-effort extraction of the article subject from the first sentence.
 * Returns an array of name variants to try against the domain:
 *   "Murry N. Gunty" → ["Murry N. Gunty", "Murry Gunty"]  (with and without middle initial)
 */
function guessSubjectNames(text: string): string[] {
  // Strip leading HTML tags that may come from Google Docs paste
  const stripped = text.replace(/^(<[^>]+>\s*)+/, '').trim();
  // Match a leading sequence of capitalised words (the subject's name)
  const m = stripped.match(/^([A-Z][a-z]+(?:\s+[A-Z]\.?(?:\s+[A-Z][a-z]+){0,3})?(?:\s+[A-Z][a-z]+)?)/);
  if (!m) return [];
  const full = m[1].trim();
  const variants: string[] = [full];
  // Also try dropping any single-letter middle initials: "Murry N. Gunty" → "Murry Gunty"
  const withoutMiddle = full.replace(/\s+[A-Z]\.?\s+/g, ' ').trim();
  if (withoutMiddle !== full) variants.push(withoutMiddle);
  return variants;
}

/**
 * Convert HTML heading tags (from Google Docs pastes) to wikitext headings.
 * <h1>Foo</h1> → = Foo =
 * <h2>Foo</h2> → == Foo ==
 * <h3>Foo</h3> → === Foo ===
 * etc.
 * Also handles plain "N. Heading" number-prefixed lines that Google Docs
 * sometimes emits as plain text instead of heading elements.
 */
function convertHeadings(text: string): string {
  // HTML heading tags → wikitext
  let result = text.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_match, level: string, content: string) => {
      const eq = '='.repeat(Number(level));
      const plain = content.replace(/<[^>]+>/g, '').trim();
      return `\n${eq} ${plain} ${eq}\n`;
    },
  );

  // Strip remaining HTML tags that come from rich-text paste (Google Docs)
  // but preserve newlines embedded in the content.
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<\/p>/gi, '\n');
  result = result.replace(/<[^>]+>/g, '');

  // Collapse 3+ consecutive blank lines to 2
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Parse all inline URL citations from the text.
 * Matches: (https://...) or (http://...)
 * Returns unique URLs in order of first appearance.
 */
function extractUrls(text: string): string[] {
  const pattern = /\((https?:\/\/[^\s)]+)\)/gi;
  const seen = new Set<string>();
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const url = m[1];
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Fetch Open Graph / meta data for a URL via a simple proxy approach.
 * We use a DOMParser on the raw HTML fetched through fetch().
 * Falls back gracefully when CORS blocks the request.
 */
async function fetchPageMeta(url: string): Promise<{ title: string; publisher: string; date: string }> {
  const fallback = { title: extractDomain(url), publisher: extractDomain(url), date: '' };

  try {
    // Use allorigins as a CORS proxy to fetch page HTML
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return fallback;

    const json = await res.json();
    const html: string = json.contents || '';
    if (!html) return fallback;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const getMeta = (name: string) =>
      doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
      doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
      '';

    // Title: og:title > twitter:title > <title>
    const ogTitle = getMeta('og:title') || getMeta('twitter:title');
    const titleTag = doc.querySelector('title')?.textContent?.trim() || '';
    const title = ogTitle || titleTag || fallback.title;

    // Publisher: og:site_name > application-name > domain
    const publisher =
      getMeta('og:site_name') ||
      getMeta('application-name') ||
      extractDomain(url);

    // Date: article:published_time > datePublished > og:updated_time
    const rawDate =
      getMeta('article:published_time') ||
      getMeta('datePublished') ||
      getMeta('og:updated_time') ||
      getMeta('date') ||
      '';

    let date = '';
    if (rawDate) {
      try {
        date = new Date(rawDate).toISOString().slice(0, 10); // YYYY-MM-DD
      } catch {
        date = rawDate.slice(0, 10);
      }
    }

    return { title, publisher, date };
  } catch {
    return fallback;
  }
}

/**
 * Convert text + ref map into Wikipedia wikitext.
 * Each inline (URL) becomes <ref name="X" /> after the first occurrence
 * and a full <ref name="X">{{cite web|...}}</ref> on first use.
 */
function buildWikitext(rawText: string, refs: ParsedRef[]): string {
  // Map url → ref object for fast lookup
  const refMap = new Map(refs.map(r => [r.url, r]));
  // Track which ref names have been emitted in full already
  const emitted = new Set<string>();

  // Replace each (URL) occurrence
  const wikitext = rawText.replace(/\((https?:\/\/[^\s)]+)\)/gi, (_match, url) => {
    const ref = refMap.get(url);
    if (!ref) return _match; // shouldn't happen

    if (!emitted.has(ref.name)) {
      emitted.add(ref.name);
      const cite = [
        `{{cite web`,
        `|url=${ref.url}`,
        `|title=${ref.title}`,
        `|publisher=${ref.publisher}`,
        ref.date ? `|date=${ref.date}` : '',
        `|access-date={{subst:CURRENTYEAR}}-{{subst:CURRENTMONTH}}-{{subst:CURRENTDAY}}`,
        `}}`,
      ]
        .filter(Boolean)
        .join('');
      return `<ref name="${ref.name}">${cite}</ref>`;
    } else {
      return `<ref name="${ref.name}" />`;
    }
  });

  // Append ==References== section
  const refSection = `\n\n==References==\n{{Reflist}}`;
  return `${wikitext}${refSection}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── Draft scoring ─────────────────────────────────────────────────────────────

interface DraftIssue {
  type: 'no_source' | 'bad_source' | 'sparse_sourcing' | 'self_promo';
  message: string;
  /** sentence index (0-based) this issue attaches to, if applicable */
  sentenceIdx?: number;
}

interface DraftScore {
  score: number; // 0–100
  label: string;
  color: string; // tailwind text color class
  issues: DraftIssue[];
  /** map of sentence index → flag reason (for inline highlighting) */
  flaggedSentences: Map<number, string>;
}

function scoreDraft(rawText: string, refs: ParsedRef[]): DraftScore {
  const issues: DraftIssue[] = [];
  const flaggedSentences = new Map<number, string>();

  // Split into sentences for inline analysis
  const sentences = rawText.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const urlPattern = /\((https?:\/\/[^\s)]+)\)/gi;

  const qualifyingRefs = refs.filter(r => r.verdict === 'qualifying');
  const flaggedRefs = refs.filter(r => r.verdict === 'flagged');
  const totalRefs = refs.length;

  // Build map of url → ref
  const refByUrl = new Map(refs.map(r => [r.url, r]));

  // Per-sentence: does it have a source? is any source bad?
  const substantiveSentences: number[] = [];
  sentences.forEach((sentence, idx) => {
    // Skip very short sentences (headings, connectors)
    if (sentence.trim().length < 40) return;
    // Skip sentences that are headings (wikitext == format)
    if (/^={1,6}\s/.test(sentence.trim())) return;
    substantiveSentences.push(idx);

    const urlsInSentence = [...sentence.matchAll(urlPattern)].map(m => m[1]);

    if (urlsInSentence.length === 0) {
      // Unsourced substantive claim
      flaggedSentences.set(idx, 'Unsourced claim — Wikipedia requires inline citations for factual statements (WP:CITE).');
      issues.push({ type: 'no_source', message: 'Unsourced claim found.', sentenceIdx: idx });
    } else {
      // Check if ALL sources in this sentence are flagged
      const allBad = urlsInSentence.every(u => {
        const ref = refByUrl.get(u);
        return ref && ref.verdict === 'flagged';
      });
      const anyBad = urlsInSentence.some(u => {
        const ref = refByUrl.get(u);
        return ref && ref.verdict === 'flagged';
      });

      if (allBad) {
        const reasons = urlsInSentence
          .map(u => refByUrl.get(u)?.flagReason)
          .filter(Boolean)
          .join('; ');
        flaggedSentences.set(idx, reasons || 'All sources for this claim are non-independent or unreliable.');
        issues.push({ type: 'bad_source', message: 'Claim only sourced to non-independent sources.', sentenceIdx: idx });
      } else if (anyBad) {
        // Has at least one good source — don't flag the sentence, but note it
      }
    }
  });

  // Global issues
  if (totalRefs === 0) {
    issues.push({ type: 'sparse_sourcing', message: 'No sources found. Add URLs in parentheses after claims.' });
  } else if (qualifyingRefs.length === 0) {
    issues.push({ type: 'bad_source', message: 'All sources are non-independent. Wikipedia requires independent, third-party coverage to establish notability.' });
  } else if (qualifyingRefs.length < 2) {
    issues.push({ type: 'sparse_sourcing', message: 'Only 1 qualifying independent source. Wikipedia generally requires multiple independent sources for notability.' });
  }

  const selfPromoCount = refs.filter(r => r.verdict === 'flagged' && (r.flagReason?.includes('own website') || r.flagReason?.includes('WP:SELFPUB'))).length;
  if (selfPromoCount > 0) {
    issues.push({ type: 'self_promo', message: `${selfPromoCount} source(s) are the subject's own website or self-published content — these cannot establish notability.` });
  }

  // Score: start at 100, deduct
  let score = 100;
  // Each unsourced substantive sentence: -8
  const unsourcedCount = issues.filter(i => i.type === 'no_source').length;
  score -= unsourcedCount * 8;
  // Each sentence with only bad sources: -6
  const badSourcedCount = issues.filter(i => i.type === 'bad_source' && i.sentenceIdx !== undefined).length;
  score -= badSourcedCount * 6;
  // No qualifying sources at all: -40
  if (qualifyingRefs.length === 0 && totalRefs > 0) score -= 40;
  // Only 1 qualifying: -15
  else if (qualifyingRefs.length === 1) score -= 15;
  // Self-promo sources: -5 each
  score -= selfPromoCount * 5;
  // Bonus: good ratio of sourced sentences
  const sourcedFraction = substantiveSentences.length > 0
    ? (substantiveSentences.length - unsourcedCount) / substantiveSentences.length
    : 1;
  if (sourcedFraction < 0.5) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let label: string;
  let color: string;
  if (score >= 80) { label = 'Good'; color = 'text-green-700'; }
  else if (score >= 60) { label = 'Fair'; color = 'text-yellow-700'; }
  else if (score >= 40) { label = 'Weak'; color = 'text-orange-600'; }
  else { label = 'Poor'; color = 'text-red-700'; }

  return { score, label, color, issues, flaggedSentences };
}

export function DraftFormatter() {
  const [inputText, setInputText] = useState('');
  const [refs, setRefs] = useState<ParsedRef[]>([]);
  const [wikitext, setWikitext] = useState('');
  const [highlightedWikitext, setHighlightedWikitext] = useState<React.ReactNode[]>([]);
  const [draftScore, setDraftScore] = useState<DraftScore | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const wikitextRef = useRef<HTMLTextAreaElement>(null);

  /** Intercept paste to capture raw HTML before the browser strips it */
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      setInputText(html);
    }
    // If no HTML, let the default paste (plain text) proceed normally
  };

  const handleFormat = async () => {
    // Convert headings and clean up HTML from rich-text pastes before anything else
    const rawText = convertHeadings(inputText.trim());
    if (!rawText) return;

    setIsProcessing(true);
    setHasResult(false);
    setRefs([]);
    setWikitext('');
    setHighlightedWikitext([]);
    setDraftScore(null);

    // Try to identify the article subject for self-promo detection (try multiple name variants)
    const subjectNames = guessSubjectNames(rawText);

    const urls = extractUrls(rawText);

    // Build ref objects in parallel
    const usedNames = new Set<string>();
    const refResults: ParsedRef[] = await Promise.all(
      urls.map(async (url, i) => {
        const domain = extractDomain(url);
        const name = makeRefName(url, i, usedNames);

        // Source verdict via press-release detector (try all subject name variants)
        let detection = detectPressReleaseOrSelfPromo(url, domain, subjectNames[0]);
        if (!detection.isPressRelease && subjectNames.length > 1) {
          for (let ni = 1; ni < subjectNames.length; ni++) {
            const d2 = detectPressReleaseOrSelfPromo(url, domain, subjectNames[ni]);
            if (d2.isPressRelease) { detection = d2; break; }
          }
        }
        const verdict: ParsedRef['verdict'] = detection.isPressRelease ? 'flagged' : 'qualifying';
        const flagReason = detection.isPressRelease
          ? (detection.reason || getPressReleaseLabel(detection.category))
          : null;

        // Fetch page metadata
        const meta = await fetchPageMeta(url);

        return {
          url,
          name,
          title: meta.title,
          publisher: meta.publisher,
          date: meta.date,
          verdict,
          flagReason,
        };
      }),
    );

    const wt = buildWikitext(rawText, refResults);

    // Score the draft and compute highlighted rendering
    const score = scoreDraft(rawText, refResults);

    // Build highlighted wikitext: split into lines, colour flagged sentences red
    const wtLines = wt.split('\n');
    const highlighted: React.ReactNode[] = wtLines.map((line, li) => {
      // Try to match this line back to a flagged sentence
      const flagged = [...score.flaggedSentences.entries()].find(([, reason]) => {
        // Simple heuristic: if this line contains text from a flagged sentence, colour it
        return reason && line.length > 20 && wt.includes(line.trim().slice(0, 40));
      });
      // More reliable: check if the sentence text appears in the line
      const isFlaggedLine = [...score.flaggedSentences.keys()].some(idx => {
        const sentences = rawText.split(/(?<=[.!?])\s+(?=[A-Z])/);
        const s = sentences[idx];
        if (!s) return false;
        // Use first 30 chars of sentence as fingerprint
        const fp = s.replace(/\(https?:\/\/[^\s)]+\)/gi, '').trim().slice(0, 30);
        return fp.length > 10 && line.includes(fp);
      });
      return (
        <span
          key={li}
          className={isFlaggedLine ? 'bg-red-100 text-red-900' : ''}
          title={isFlaggedLine ? 'Issue flagged — see draft score panel' : undefined}
        >
          {line}{'\n'}
        </span>
      );
    });

    setRefs(refResults);
    setWikitext(wt);
    setHighlightedWikitext(highlighted);
    setDraftScore(score);
    setHasResult(true);
    setIsProcessing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(wikitext).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setInputText('');
    setRefs([]);
    setWikitext('');
    setHasResult(false);
  };

  const qualifyingCount = refs.filter(r => r.verdict === 'qualifying').length;
  const flaggedCount = refs.filter(r => r.verdict === 'flagged').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Wikipedia Draft Formatter</h3>
        <p className="text-sm text-gray-500 mt-1">
          Paste your article text with URLs in parentheses like{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">(https://example.com)</code> — the
          tool converts it to ready-to-paste Wikipedia wikitext with proper{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">&lt;ref&gt;</code> citation tags and
          reviews each source.
        </p>
      </div>

      {/* Input area */}
      {!hasResult && (
        <div className="space-y-3">
          <Textarea
            placeholder={`Paste your article text here. Include URLs in parentheses after each claim.\n\nExample:\nJane Smith is an award-winning journalist (https://nytimes.com/article-about-jane) who has covered international affairs for over a decade (https://bbc.com/news/jane-smith-profile).`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            className="min-h-[260px] font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleFormat}
              disabled={!inputText.trim() || isProcessing}
              className="bg-[#17163e] hover:bg-[#232253] text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Formatting…
                </>
              ) : (
                'Format for Wikipedia'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-[#17163e]" />
          <p className="text-sm text-gray-600">Fetching page metadata and reviewing sources…</p>
        </div>
      )}

      {/* Results */}
      {hasResult && !isProcessing && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">{refs.length} source{refs.length !== 1 ? 's' : ''} found</span>
              {qualifyingCount > 0 && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  {qualifyingCount} OK
                </Badge>
              )}
              {flaggedCount > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  {flaggedCount} flagged
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Start over
              </Button>
              <Button
                size="sm"
                className="bg-[#17163e] hover:bg-[#232253] text-white"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy wikitext
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Draft score panel */}
          {draftScore && (
            <div className={`rounded-lg border p-4 space-y-3 ${
              draftScore.score >= 80 ? 'border-green-200 bg-green-50' :
              draftScore.score >= 60 ? 'border-yellow-200 bg-yellow-50' :
              draftScore.score >= 40 ? 'border-orange-200 bg-orange-50' :
              'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${draftScore.color}`}>{draftScore.score}</span>
                <span className={`text-sm font-semibold ${draftScore.color}`}>{draftScore.label}</span>
                <span className="text-xs text-gray-500 ml-1">/ 100 — Wikipedia readiness score</span>
              </div>
              {draftScore.issues.length > 0 && (
                <ul className="space-y-1">
                  {draftScore.issues.map((issue, i) => (
                    <li key={i} className="flex gap-2 items-start text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-800">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {draftScore.flaggedSentences.size > 0 && (
                <p className="text-xs text-gray-500">Red-highlighted lines below have sourcing issues.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: wikitext output */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Ready-to-paste wikitext
              </div>
              <pre
                className="min-h-[380px] font-mono text-xs bg-gray-50 border rounded-md p-3 overflow-auto whitespace-pre-wrap cursor-pointer"
                onClick={() => { navigator.clipboard.writeText(wikitext); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                title="Click to copy"
              >
                {highlightedWikitext.length > 0 ? highlightedWikitext : wikitext}
              </pre>
            </div>

            {/* Right: source review */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Source review
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {refs.map((ref) => (
                  <Card
                    key={ref.name}
                    className={`border ${
                      ref.verdict === 'qualifying'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {ref.verdict === 'qualifying' ? (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <span
                            className={`text-xs font-medium ${
                              ref.verdict === 'qualifying' ? 'text-green-800' : 'text-red-700'
                            }`}
                          >
                            {ref.verdict === 'qualifying' ? 'Looks independent' : 'Flagged'}
                          </span>
                        </div>
                        <code className="text-xs bg-white border rounded px-1 py-0.5 text-gray-600 flex-shrink-0">
                          {ref.name}
                        </code>
                      </div>

                      {/* Title */}
                      <div className="text-xs text-gray-800 font-medium leading-snug line-clamp-2">
                        {ref.title}
                      </div>

                      {/* Publisher + date */}
                      <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
                        <span>{ref.publisher}</span>
                        {ref.date && <span>· {ref.date}</span>}
                      </div>

                      {/* URL */}
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate block max-w-full"
                        title={ref.url}
                      >
                        {ref.url.length > 60 ? `${ref.url.slice(0, 60)}…` : ref.url}
                      </a>

                      {/* Flag reason */}
                      {ref.flagReason && (
                        <div className="flex gap-1.5 items-start mt-1 bg-red-100 rounded p-1.5">
                          <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700 leading-snug">{ref.flagReason}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom hint */}
          {flaggedCount > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>{flaggedCount} flagged source{flaggedCount !== 1 ? 's' : ''}</strong> may be
                challenged or removed by Wikipedia editors. Consider replacing them with independent,
                third-party coverage before submitting the draft.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
