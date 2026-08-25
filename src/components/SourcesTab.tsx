import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { CategorizedSources } from '@/utils/wikipediaEligibility';
import { NotabilityAssessment } from '@/utils/sourceEvaluation';
import { SourceVerdictList } from '@/components/SourceVerdictList';

interface SourcesTabProps {
  categorized: CategorizedSources;
  notability: NotabilityAssessment;
}

export function SourcesTab({ categorized, notability }: SourcesTabProps) {
  const qualifying = categorized?.qualifying || [];
  const supporting = categorized?.supporting || [];
  const rejected = categorized?.rejected || [];
  const total = qualifying.length + supporting.length + rejected.length;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-lg font-medium mb-4">Source Analysis</div>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            How a Wikipedia editor judges a source
          </h3>
          <p className="text-xs text-blue-700 mb-2">
            A source only counts toward notability if it clears <strong>all four</strong> tests.
            Failing any one of them means it contributes nothing — however famous the publication.
          </p>
          <ul className="text-xs text-blue-700 list-disc pl-5 space-y-1">
            <li>
              <strong>Reliable</strong> (WP:RS) — real editorial oversight and a record of
              fact-checking.
            </li>
            <li>
              <strong>Independent</strong> (WP:IS / WP:ORGIND) — not written, placed or paid for by
              the subject. This excludes press releases, syndicated wire copy, sponsored posts,
              contributor and Council columns, directories and social profiles.
            </li>
            <li>
              <strong>Significant</strong> (WP:SIGCOV) — actually about the subject, in depth. A
              name-check inside an article about something else does not count.
            </li>
            <li>
              <strong>Secondary</strong> (WP:PSTS) — independent analysis, not an interview or the
              subject relaying their own claims.
            </li>
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            Eligibility needs a score of 66+ <em>and</em> qualifying coverage from at least three
            separate publishers. Multiple pieces in the same outlet count once, with sharply
            reduced weight for the second.
          </p>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-green-50 border border-green-200 p-3 rounded-md flex flex-col items-center">
            <span className="font-medium text-lg">{qualifying.length}</span>
            <span className="text-xs text-gray-600 text-center">Count toward notability</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex flex-col items-center">
            <span className="font-medium text-lg">{supporting.length}</span>
            <span className="text-xs text-gray-600 text-center">Supporting only</span>
          </div>
          <div className="bg-red-50 border border-red-200 p-3 rounded-md flex flex-col items-center">
            <span className="font-medium text-lg">{rejected.length}</span>
            <span className="text-xs text-gray-600 text-center">Excluded</span>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
          {notability?.verdict}
          {total > 0 && (
            <span className="text-gray-500">
              {' '}
              ({total} source{total === 1 ? '' : 's'} analysed, across{' '}
              {notability?.qualifyingDomains || 0} qualifying publisher
              {notability?.qualifyingDomains === 1 ? '' : 's'}.)
            </span>
          )}
        </div>

        <Accordion type="multiple" defaultValue={['qualifying']} className="w-full">
          <AccordionItem value="qualifying" className="border-b">
            <AccordionTrigger className="text-sm py-2">
              <span className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                {qualifying.length} source{qualifying.length === 1 ? '' : 's'} counting toward
                notability
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-2 text-xs text-gray-600 italic">
                Reliable, independent, and substantially about the subject. These are the sources to
                cite in a draft.
              </p>
              <SourceVerdictList
                verdicts={qualifying.map(s => s.verdict)}
                emptyMessage="No sources cleared all four tests. An article built on the sources found here would be deleted at review."
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="supporting" className="border-b">
            <AccordionTrigger className="text-sm py-2">
              <span className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                {supporting.length} supporting source{supporting.length === 1 ? '' : 's'}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-2 text-xs text-gray-600 italic">
                Usable to verify individual facts inside an article, but not enough on their own to
                justify the article existing.
              </p>
              <SourceVerdictList verdicts={supporting.map(s => s.verdict)} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rejected" className="border-b">
            <AccordionTrigger className="text-sm py-2">
              <span className="flex items-center">
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                {rejected.length} excluded source{rejected.length === 1 ? '' : 's'}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-2 text-xs text-gray-600 italic">
                Each of these fails a specific policy, shown against the source. These carry no
                weight at all — a press release on a well-known domain is still a press release.
              </p>
              <SourceVerdictList verdicts={rejected.map(s => s.verdict)} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
