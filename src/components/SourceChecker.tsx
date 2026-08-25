import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, XCircle, AlertTriangle, ClipboardList, Calendar } from 'lucide-react';
import { evaluateSource, assessNotability, SourceVerdict } from '@/utils/sourceEvaluation';
import { SourceVerdictList } from '@/components/SourceVerdictList';

/**
 * Standalone source checker.
 *
 * Paste a list of URLs and get a per-source verdict against Wikipedia's sourcing
 * policy, plus a roll-up saying whether the set as a whole would satisfy WP:GNG.
 *
 * Uses the same `evaluateSource` engine as the entity analyser, so a source that
 * is rejected here is rejected there too.
 */

const MAX_SOURCES = 50;

/** Pulls one URL per line, tolerating surrounding text, bullets and markdown. */
function extractUrls(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  raw
    .split(/[\n\r]+/)
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      // Prefer an explicit http(s) URL anywhere on the line.
      const match = line.match(/https?:\/\/[^\s<>"'\])}]+/i);
      let candidate = match
        ? match[0]
        // Otherwise accept a bare domain-looking token.
        : (line.match(/(?:^|\s)((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i)?.[1] ?? '');

      candidate = candidate.replace(/[.,;:]+$/, '').trim();
      if (!candidate) return;

      const key = candidate.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      if (seen.has(key)) return;
      seen.add(key);
      out.push(candidate);
    });

  return out;
}

export function SourceChecker() {
  const [subject, setSubject] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [verdicts, setVerdicts] = useState<SourceVerdict[] | null>(null);
  const [checkedSubject, setCheckedSubject] = useState('');
  const [truncatedFrom, setTruncatedFrom] = useState(0);

  const detectedCount = useMemo(() => extractUrls(rawInput).length, [rawInput]);

  const handleCheck = () => {
    const all = extractUrls(rawInput);
    const urls = all.slice(0, MAX_SOURCES);
    setTruncatedFrom(all.length > MAX_SOURCES ? all.length : 0);
    setCheckedSubject(subject.trim());
    setVerdicts(urls.map(url => evaluateSource({ url }, subject.trim())));
  };

  const handleClear = () => {
    setRawInput('');
    setVerdicts(null);
    setTruncatedFrom(0);
  };

  const openCalendly = () => {
    const url = 'https://calendly.com/orani/30min';
    if (typeof window !== 'undefined' && (window as any).Calendly?.initPopupWidget) {
      (window as any).Calendly.initPopupWidget({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const counting = verdicts?.filter(v => v.status === 'counts') || [];
  const supporting = verdicts?.filter(v => v.status === 'partial') || [];
  const failing = verdicts?.filter(v => v.status === 'fails') || [];
  const notability = verdicts ? assessNotability(verdicts) : null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-5 w-5 text-[#17163e]" />
            <h2 className="text-lg font-medium">Source Checker</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Paste the sources you were planning to cite — one per line — and each will be judged
            the way a Wikipedia editor would judge it at a deletion discussion. Press releases,
            sponsored placements and contributor columns are rejected regardless of how well-known
            the publication is.
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject <span className="font-normal text-gray-500">(optional, but strongly recommended)</span>
          </label>
          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Jane Doe, or Acme Corporation"
            className="mb-1"
          />
          <p className="text-xs text-gray-500 mb-4">
            Without a subject we can check reliability and independence, but not whether the
            coverage is actually <em>about</em> your subject rather than a passing mention.
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sources — one URL per line
          </label>
          <Textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            rows={8}
            placeholder={
              'https://www.reuters.com/business/...\n' +
              'https://www.prnewswire.com/news-releases/...\n' +
              'https://www.forbes.com/sites/forbesbusinesscouncil/...'
            }
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {detectedCount} URL{detectedCount === 1 ? '' : 's'} detected
              {detectedCount > MAX_SOURCES && ` — only the first ${MAX_SOURCES} will be checked`}
            </span>
            <div className="flex gap-2">
              {verdicts && (
                <Button variant="outline" size="sm" onClick={handleClear}>
                  Clear
                </Button>
              )}
              <Button
                onClick={handleCheck}
                disabled={detectedCount === 0}
                className="bg-[#17163e] hover:bg-[#232253] text-white"
                size="sm"
              >
                Check {detectedCount > 0 ? `${Math.min(detectedCount, MAX_SOURCES)} ` : ''}source
                {detectedCount === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {verdicts && notability && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-3">
              Results{checkedSubject && <span className="text-gray-500 font-normal"> for {checkedSubject}</span>}
            </h3>

            {truncatedFrom > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                You pasted {truncatedFrom} URLs. Only the first {MAX_SOURCES} were checked.
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 border border-green-200 p-3 rounded-md flex flex-col items-center">
                <span className="font-medium text-lg">{counting.length}</span>
                <span className="text-xs text-gray-600 text-center">Count toward notability</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex flex-col items-center">
                <span className="font-medium text-lg">{supporting.length}</span>
                <span className="text-xs text-gray-600 text-center">Supporting only</span>
              </div>
              <div className="bg-red-50 border border-red-200 p-3 rounded-md flex flex-col items-center">
                <span className="font-medium text-lg">{failing.length}</span>
                <span className="text-xs text-gray-600 text-center">Rejected</span>
              </div>
            </div>

            {checkedSubject ? (
              <div
                className={`p-3 rounded-md border mb-4 text-sm ${
                  notability.eligible
                    ? 'bg-green-50 border-green-200 text-green-900'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  {notability.eligible ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium mb-1">
                      Score {notability.score} —{' '}
                      {notability.eligible
                        ? 'this source set supports an article'
                        : 'this source set is not sufficient'}
                    </p>
                    <p>{notability.verdict}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-3 mb-4">
                Reliability and independence were checked. Enter a subject above to also assess
                whether each source covers it in enough depth, and to get an overall notability
                score.
              </p>
            )}

            <Accordion type="multiple" defaultValue={['counts', 'fails']} className="w-full">
              <AccordionItem value="counts">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    {counting.length} would count
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <SourceVerdictList
                    verdicts={counting}
                    emptyMessage="None of these sources would count toward notability."
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="partial">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                    {supporting.length} supporting only
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <SourceVerdictList verdicts={supporting} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="fails">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center">
                    <XCircle className="h-4 w-4 mr-2 text-red-500" />
                    {failing.length} rejected
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <SourceVerdictList verdicts={failing} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {!notability.eligible && (
              <div className="mt-6 border rounded-md p-4 bg-gray-50">
                <h4 className="font-medium mb-2">Need stronger sources?</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Getting genuinely independent, in-depth coverage is the whole game. Book a call
                  and we'll go through what would actually move the needle for your subject.
                </p>
                <Button onClick={openCalendly} className="w-full bg-[#17163e] hover:bg-[#232253] text-white">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule a Free Consultation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
