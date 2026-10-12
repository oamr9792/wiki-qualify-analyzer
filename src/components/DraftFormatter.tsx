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
 * We look for the first run of Title-Cased Words at the start of the text
 * (after stripping leading HTML tags/whitespace). This handles the common
 * Wikipedia article opening: "Jane Smith is an American entrepreneur..."
 */
function guessSubjectName(text: string): string {
  // Strip leading HTML tags that may come from Google Docs paste
  const stripped = text.replace(/^(<[^>]+>\s*)+/, '').trim();
  // Match a leading sequence of capitalised words (the subject's name)
  const m = stripped.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})/);
  return m ? m[1].trim() : '';
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

export function DraftFormatter() {
  const [inputText, setInputText] = useState('');
  const [refs, setRefs] = useState<ParsedRef[]>([]);
  const [wikitext, setWikitext] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const wikitextRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = async () => {
    // Convert headings and clean up HTML from rich-text pastes before anything else
    const rawText = convertHeadings(inputText.trim());
    if (!rawText) return;

    setIsProcessing(true);
    setHasResult(false);
    setRefs([]);
    setWikitext('');

    // Try to identify the article subject for self-promo detection
    const subjectName = guessSubjectName(rawText);

    const urls = extractUrls(rawText);

    // Build ref objects in parallel
    const usedNames = new Set<string>();
    const refResults: ParsedRef[] = await Promise.all(
      urls.map(async (url, i) => {
        const domain = extractDomain(url);
        const name = makeRefName(url, i, usedNames);

        // Source verdict via press-release detector (pass subject for self-promo check)
        const detection = detectPressReleaseOrSelfPromo(url, domain, subjectName);
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

    setRefs(refResults);
    setWikitext(wt);
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: wikitext output */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Ready-to-paste wikitext
              </div>
              <Textarea
                ref={wikitextRef}
                value={wikitext}
                readOnly
                className="min-h-[380px] font-mono text-xs bg-gray-50"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
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
