/**
 * WikiEditWizard.tsx
 *
 * Step-by-step wizard for proposing edits to an existing Wikipedia article.
 *
 * Step 1 — Paste the Wikipedia URL + the specific passage you want to change.
 *           Tool verifies the passage actually exists on that page.
 * Step 2 — Edit the passage in a Google-Docs-style suggesting mode (track changes).
 *           Tool evaluates whether the edit meets Wikipedia's content policies.
 * Step 3 — Result: approved / needs amendment, with specific policy flags.
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Info,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface PolicyFlag {
  policy: string;
  detail: string;
  severity: 'block' | 'warn';
}

interface EditVerdict {
  approved: boolean;
  flags: PolicyFlag[];
  summary: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWikipediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('wikipedia.org');
  } catch {
    return false;
  }
}

/** Fetch the Wikipedia article's wikitext via the MediaWiki API */
async function fetchWikipediaText(pageUrl: string): Promise<{ text: string; title: string; error?: string }> {
  try {
    const u = new URL(pageUrl);
    // Extract title from path: /wiki/Title_Of_Article
    const pathMatch = u.pathname.match(/^\/wiki\/(.+)$/);
    if (!pathMatch) return { text: '', title: '', error: 'Could not parse Wikipedia URL. Make sure it looks like https://en.wikipedia.org/wiki/Article_Name' };
    const title = decodeURIComponent(pathMatch[1]);
    const api = `https://${u.hostname}/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}&format=json&origin=*`;
    const res = await fetch(api, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const pages = json?.query?.pages;
    const page = pages && Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return { text: '', title, error: `Page "${title}" was not found on Wikipedia.` };
    const wikitext: string = page.revisions?.[0]?.slots?.main?.['*'] || '';
    return { text: wikitext, title: page.title || title };
  } catch (e: any) {
    return { text: '', title: '', error: e.message || 'Failed to fetch the Wikipedia page.' };
  }
}

/**
 * Loosely checks if `passage` appears in `wikitext`.
 * Normalises whitespace, strips basic wikitext markup for comparison.
 */
function findPassageInWikitext(passage: string, wikitext: string): boolean {
  const normalise = (s: string) =>
    s
      .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2') // [[link|label]] → label
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')       // strip <ref>
      .replace(/{{[^}]+}}/g, '')                         // strip templates
      .replace(/[=*#|[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const haystack = normalise(wikitext);
  // Try progressively shorter prefixes of the passage to handle partial matches
  const needle = normalise(passage);
  if (!needle || needle.length < 15) return true; // too short to meaningfully check
  // Check if at least 70% of the passage words appear in the wikitext near each other
  const words = needle.split(' ').filter(w => w.length > 3);
  const matchCount = words.filter(w => haystack.includes(w)).length;
  return matchCount / words.length >= 0.65;
}

// ── Policy evaluation ─────────────────────────────────────────────────────────

/**
 * Very lightweight heuristic evaluation of a proposed edit.
 * Checks for common Wikipedia content policy violations.
 * Not a replacement for human review, but catches the most common issues.
 */
function evaluateEdit(original: string, proposed: string): EditVerdict {
  const flags: PolicyFlag[] = [];
  const added = getAddedText(original, proposed);
  const lower = added.toLowerCase();

  // WP:NPOV — promotional / peacock language
  const promoTerms = [
    'best', 'leading', 'top', 'premier', 'world-class', 'award-winning',
    'groundbreaking', 'revolutionary', 'innovative', 'cutting-edge', 'renowned',
    'celebrated', 'acclaimed', 'prestigious', 'visionary', 'pioneering',
    'exceptional', 'outstanding', 'unparalleled', 'unique offering',
  ];
  const promoHits = promoTerms.filter(t => lower.includes(t));
  if (promoHits.length > 0) {
    flags.push({
      policy: 'WP:NPOV',
      detail: `Promotional or peacock language detected: "${promoHits.slice(0, 3).join('", "')}". Wikipedia requires neutral wording — describe what sources say, not what makes the subject look good.`,
      severity: 'block',
    });
  }

  // WP:NPOV — weasel words
  const weaselTerms = ['some say', 'many believe', 'it is said', 'it has been claimed', 'reportedly', 'allegedly', 'critics say'];
  const weaselHits = weaselTerms.filter(t => lower.includes(t));
  if (weaselHits.length > 0) {
    flags.push({
      policy: 'WP:WEASEL',
      detail: `Vague attribution: "${weaselHits[0]}". Either name the source directly or remove the claim if it cannot be attributed.`,
      severity: 'warn',
    });
  }

  // WP:V — unsourced added content (no <ref> or (url) in the added text)
  const hasInlineCite = /\(\s*https?:\/\/|<ref/i.test(added);
  const addedWords = added.trim().split(/\s+/).length;
  if (!hasInlineCite && addedWords > 20) {
    flags.push({
      policy: 'WP:V',
      detail: 'The added text contains no inline citation. Wikipedia requires verifiable sourcing for factual claims — add a <ref> citation or a URL in parentheses.',
      severity: 'block',
    });
  }

  // WP:BLP — living person claim triggers
  const blpTerms = ['arrested', 'convicted', 'accused', 'alleged', 'scandal', 'controversy', 'criminal', 'fraud', 'sued'];
  const blpHits = blpTerms.filter(t => lower.includes(t));
  if (blpHits.length > 0) {
    flags.push({
      policy: 'WP:BLP',
      detail: `Added text mentions "${blpHits[0]}", which may concern a living person. BLP requires exceptional sourcing and neutrality for potentially damaging claims — cite a high-quality, independent, reliable source and ensure wording is precise.`,
      severity: 'block',
    });
  }

  // WP:COI — first-person or self-referential edits
  const coiTerms = ['i am', 'my company', 'our company', 'i founded', 'i work', 'we are', 'we offer'];
  if (coiTerms.some(t => lower.includes(t))) {
    flags.push({
      policy: 'WP:COI',
      detail: 'First-person language detected. Editing Wikipedia about yourself, your employer or your clients requires declaring a conflict of interest on the talk page. Consider proposing the change via the article\'s talk page instead.',
      severity: 'block',
    });
  }

  // WP:PEACOCK / WP:PROMO — added external links that aren't citations
  const rawLinks = (added.match(/https?:\/\/[^\s)>]+/g) || []);
  const nonWikiLinks = rawLinks.filter(l => !l.includes('wikipedia.org'));
  if (nonWikiLinks.length > 1) {
    flags.push({
      policy: 'WP:EL',
      detail: `${nonWikiLinks.length} external links added. Wikipedia discourages adding links beyond what's needed as inline citations — editors may remove them as linkspam.`,
      severity: 'warn',
    });
  }

  // Good: no issues
  const blocking = flags.filter(f => f.severity === 'block');
  const approved = blocking.length === 0;

  let summary: string;
  if (approved && flags.length === 0) {
    summary = 'This edit looks clean. No policy issues detected. Submit it directly through Wikipedia or use the talk page if you have a conflict of interest.';
  } else if (approved) {
    summary = 'No blocking issues, but there are warnings to address before submitting.';
  } else {
    summary = `${blocking.length} blocking issue${blocking.length > 1 ? 's' : ''} must be resolved before this edit can be submitted to Wikipedia.`;
  }

  return { approved, flags, summary };
}

/**
 * Compute text that was added (simplified diff — lines in proposed not in original).
 */
function getAddedText(original: string, proposed: string): string {
  const origLines = new Set(original.split('\n').map(l => l.trim()).filter(Boolean));
  return proposed.split('\n').filter(l => !origLines.has(l.trim())).join('\n');
}

// ── Track-changes diff rendering ─────────────────────────────────────────────

interface DiffPart {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

function computeDiff(original: string, proposed: string): DiffPart[] {
  // Word-level diff
  const origWords = original.split(/(\s+)/);
  const propWords = proposed.split(/(\s+)/);

  // Simple LCS-based diff
  const m = origWords.length;
  const n = propWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (origWords[i] === propWords[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const parts: DiffPart[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && origWords[i] === propWords[j]) {
      parts.push({ type: 'unchanged', text: origWords[i] });
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      parts.push({ type: 'added', text: propWords[j] });
      j++;
    } else {
      parts.push({ type: 'removed', text: origWords[i] });
      i++;
    }
  }
  return parts;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WikiEditWizard() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [pageUrl, setPageUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedTitle, setFetchedTitle] = useState('');
  const [wikitext, setWikitext] = useState('');
  const [passageNotFound, setPassageNotFound] = useState(false);
  const passageRef = useRef<HTMLDivElement>(null);

  // Step 2 state
  const [originalPassage, setOriginalPassage] = useState('');
  const proposedRef = useRef<HTMLDivElement>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // Step 3 state
  const [verdict, setVerdict] = useState<EditVerdict | null>(null);
  const [diffParts, setDiffParts] = useState<DiffPart[]>([]);

  // Tooltip
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const handleStep1 = async () => {
    setUrlError('');
    setPassageNotFound(false);

    if (!isWikipediaUrl(pageUrl)) {
      setUrlError('Please enter a valid Wikipedia URL (e.g. https://en.wikipedia.org/wiki/Article_Name)');
      return;
    }

    const passage = passageRef.current?.innerText?.trim() || '';
    if (!passage || passage.length < 10) {
      setUrlError('Paste the text you want to edit in the box below the URL.');
      return;
    }

    setIsFetching(true);
    const { text, title, error } = await fetchWikipediaText(pageUrl);
    setIsFetching(false);

    if (error) { setUrlError(error); return; }

    const found = findPassageInWikitext(passage, text);
    if (!found) {
      setPassageNotFound(true);
      return;
    }

    setFetchedTitle(title);
    setWikitext(text);
    setOriginalPassage(passage);

    // Pre-fill the proposed editor with the original text
    if (proposedRef.current) {
      proposedRef.current.innerText = passage;
    }

    setStep(2);
  };

  const handleStep2 = async () => {
    const proposed = proposedRef.current?.innerText?.trim() || '';
    if (!proposed) return;

    setIsEvaluating(true);

    // Compute diff for display
    const parts = computeDiff(originalPassage, proposed);
    setDiffParts(parts);

    // Evaluate against Wikipedia policies
    const v = evaluateEdit(originalPassage, proposed);
    setVerdict(v);
    setIsEvaluating(false);
    setShowDiff(true);
    setStep(3);
  };

  const handleReset = () => {
    setStep(1);
    setPageUrl('');
    setUrlError('');
    setFetchedTitle('');
    setWikitext('');
    setOriginalPassage('');
    setPassageNotFound(false);
    setVerdict(null);
    setDiffParts([]);
    setShowDiff(false);
    setTooltip(null);
    if (passageRef.current) passageRef.current.innerHTML = '';
    if (proposedRef.current) proposedRef.current.innerHTML = '';
  };

  const handleBackToEdit = () => {
    setStep(2);
    setVerdict(null);
    setShowDiff(false);
  };

  return (
    <div className="space-y-5 relative">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 max-w-xs rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg pointer-events-none leading-snug"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Wikipedia Edit Wizard</h3>
        <p className="text-sm text-gray-500 mt-1">
          Propose edits to an existing Wikipedia article and find out whether they'd be approved.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {(['1', '2', '3'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1.5 ${step === (i + 1) ? 'text-[#17163e] font-semibold' : step > (i + 1) ? 'text-green-600' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${step === (i + 1) ? 'bg-[#17163e] text-white' : step > (i + 1) ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-400'}`}>
                {step > (i + 1) ? '✓' : s}
              </span>
              <span>{['Locate passage', 'Make your edit', 'Policy review'][i]}</span>
            </div>
            {i < 2 && <ArrowRight className="h-3 w-3 text-gray-300" />}
          </div>
        ))}
        {step > 1 && (
          <button onClick={handleReset} className="ml-auto flex items-center gap-1 text-gray-400 hover:text-gray-600">
            <RotateCcw className="h-3 w-3" /> Start over
          </button>
        )}
      </div>

      {/* ── STEP 1 ───────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* URL input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Wikipedia page URL</label>
            <input
              type="url"
              value={pageUrl}
              onChange={e => setPageUrl(e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/Article_Name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Passage input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Paste the passage you want to change</label>
            <p className="text-xs text-gray-500">Go to the Wikipedia article, copy the exact sentence or paragraph you want to edit, and paste it here.</p>
            <div
              ref={passageRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Paste the paragraph or sentence from the Wikipedia article here…"
              className="min-h-[130px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
              style={{ lineHeight: '1.6' }}
            />
          </div>

          {passageNotFound && (
            <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Passage not found on that page.</strong> The text you pasted doesn't appear to match the current version of the article. Double-check you copied from the right page, or try a shorter, more distinctive excerpt.
              </div>
            </div>
          )}

          {urlError && (
            <p className="text-xs text-red-600">{urlError}</p>
          )}

          <Button
            onClick={handleStep1}
            disabled={isFetching || !pageUrl.trim()}
            className="bg-[#17163e] hover:bg-[#232253] text-white"
          >
            {isFetching ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying…</>
            ) : (
              <>Confirm passage <ArrowRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>
      )}

      {/* ── STEP 2 ───────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ExternalLink className="h-3.5 w-3.5" />
            <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">{fetchedTitle}</a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Original */}
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Original
                <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200">current Wikipedia text</Badge>
              </div>
              <div className="min-h-[180px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {originalPassage}
              </div>
            </div>

            {/* Proposed — editable */}
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Your edit
                <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">editable</Badge>
              </div>
              <div
                ref={proposedRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[180px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 leading-relaxed"
                style={{ lineHeight: '1.6' }}
              />
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Edit the text on the right. Add inline citations as (https://…) after any new claims.
              </p>
            </div>
          </div>

          <Button
            onClick={handleStep2}
            disabled={isEvaluating}
            className="bg-[#17163e] hover:bg-[#232253] text-white"
          >
            {isEvaluating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Evaluating…</>
            ) : (
              <>Check against Wikipedia policies <ArrowRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>
      )}

      {/* ── STEP 3 ───────────────────────────────────────────────────────────── */}
      {step === 3 && verdict && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ExternalLink className="h-3.5 w-3.5" />
            <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">{fetchedTitle}</a>
          </div>

          {/* Verdict banner */}
          <div className={`rounded-lg border p-4 flex items-start gap-3 ${verdict.approved ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {verdict.approved
              ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            }
            <div>
              <div className={`font-semibold text-sm ${verdict.approved ? 'text-green-800' : 'text-red-800'}`}>
                {verdict.approved ? 'Likely to be approved' : 'Needs amendment before submitting'}
              </div>
              <p className="text-xs mt-0.5 text-gray-700">{verdict.summary}</p>
            </div>
          </div>

          {/* Policy flags */}
          {verdict.flags.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Policy issues</div>
              {verdict.flags.map((f, i) => (
                <Card key={i} className={`border ${f.severity === 'block' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                  <CardContent className="p-3 flex gap-2.5 items-start">
                    {f.severity === 'block'
                      ? <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <code className={`text-xs font-semibold ${f.severity === 'block' ? 'text-red-700' : 'text-amber-700'}`}>{f.policy}</code>
                      <p className="text-xs text-gray-700 mt-0.5 leading-snug">{f.detail}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Track-changes diff */}
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-gray-700">Your changes</div>
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed min-h-[100px] whitespace-pre-wrap">
              {diffParts.map((part, i) => {
                if (part.type === 'unchanged') return <span key={i}>{part.text}</span>;
                if (part.type === 'removed') return (
                  <span
                    key={i}
                    className="bg-red-100 text-red-700 line-through cursor-help rounded-sm"
                    onMouseEnter={e => setTooltip({ text: 'Removed text', x: e.clientX, y: e.clientY })}
                    onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setTooltip(null)}
                  >{part.text}</span>
                );
                return (
                  <span
                    key={i}
                    className="bg-green-100 text-green-800 cursor-help rounded-sm"
                    onMouseEnter={e => setTooltip({ text: 'Added text', x: e.clientX, y: e.clientY })}
                    onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setTooltip(null)}
                  >{part.text}</span>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              <span className="bg-green-100 text-green-800 px-1 rounded">green</span> = added &nbsp;
              <span className="bg-red-100 text-red-700 line-through px-1 rounded">red</span> = removed
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBackToEdit}>
              ← Back to edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
