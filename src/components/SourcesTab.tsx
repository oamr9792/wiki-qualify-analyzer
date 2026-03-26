import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, InfoIcon, AlertTriangle } from 'lucide-react';
import { AnalyzedSource } from '@/utils/wikipediaEligibility';

interface SourcesTabProps {
  categorizedSources: {
    highlyReliable: AnalyzedSource[];
    reliableNoMention: AnalyzedSource[];
    contextualMention: AnalyzedSource[];
    unreliable: AnalyzedSource[];
  };
  sourcesList: AnalyzedSource[];
}

/** Single source row — shows the full URL (not just domain) */
function SourceRow({ source }: { source: AnalyzedSource }) {
  const isPR = !!source.pressReleaseReason;

  return (
    <li className="py-2 border-b border-gray-100 last:border-0">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline text-sm break-all"
      >
        {source.url}
      </a>
      <div className="flex flex-wrap gap-1.5 mt-1">
        <span className="text-xs text-gray-400">{source.domain}</span>
        {isPR && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-tight">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {source.reliability}
          </span>
        )}
      </div>
    </li>
  );
}

export function SourcesTab({ categorizedSources, sourcesList }: SourcesTabProps) {
  const reliable          = categorizedSources?.highlyReliable    ?? [];
  const reliableNoMention = categorizedSources?.reliableNoMention  ?? [];
  const contextual        = categorizedSources?.contextualMention  ?? [];
  const unreliable        = categorizedSources?.unreliable         ?? [];

  const total = reliable.length + reliableNoMention.length + contextual.length + unreliable.length;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="text-lg font-medium">Source Analysis</div>

        {/* ── How Wikipedia judges sources ── */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-sm space-y-2">
          <p className="font-semibold text-blue-800">How Wikipedia judges sources</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-blue-700">
            <li>
              <strong>Must be independent (WP:RS).</strong> Press releases, company websites,
              wire services, and paid distribution are written <em>by</em> the subject — they
              cannot establish notability even if the host outlet is otherwise reliable.
            </li>
            <li>
              <strong>Must be secondary.</strong> The source must be a journalist or editor
              writing <em>about</em> the subject, not the subject speaking about itself.
            </li>
            <li>
              <strong>Must be reliable.</strong> Major newspapers, peer-reviewed journals,
              and established trade press count. Blogs, social media, and directories do not.
            </li>
            <li>
              <strong>Diversity matters.</strong> Three articles from three different publishers
              count far more than three articles from the same outlet.
            </li>
          </ul>
          <p className="text-xs text-blue-600 mt-1">
            Score guide: <strong>75+</strong> = strong · <strong>66–74</strong> = borderline · <strong>&lt;66</strong> = not yet eligible
          </p>
        </div>

        {/* ── Summary counts ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-green-50 rounded-md p-3">
            <div className="text-xl font-semibold text-green-700">{reliable.length}</div>
            <div className="text-xs text-gray-600 mt-0.5">Reliable (Specific Mention)</div>
          </div>
          <div className="bg-blue-50 rounded-md p-3">
            <div className="text-xl font-semibold text-blue-700">{reliableNoMention.length}</div>
            <div className="text-xs text-gray-600 mt-0.5">Reliable (No Mention)</div>
          </div>
          <div className="bg-yellow-50 rounded-md p-3">
            <div className="text-xl font-semibold text-yellow-700">{contextual.length}</div>
            <div className="text-xs text-gray-600 mt-0.5">Contextual Mentions</div>
          </div>
          <div className="bg-red-50 rounded-md p-3">
            <div className="text-xl font-semibold text-red-700">{unreliable.length}</div>
            <div className="text-xs text-gray-600 mt-0.5">Unreliable</div>
          </div>
        </div>

        {/* ── Section 1: Reliable + specific mention ── */}
        {reliable.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-green-700 mb-1">
              <CheckCircle className="h-4 w-4" />
              {reliable.length} Reliable Source{reliable.length !== 1 ? 's' : ''} (Specific Mention)
            </h3>
            <p className="text-xs text-gray-500 mb-2 italic">
              These count toward Wikipedia notability — reliable outlets that specifically cover your subject.
            </p>
            <ul>
              {reliable.map((s, i) => <SourceRow key={i} source={s} />)}
            </ul>
          </section>
        )}

        {/* ── Section 2: Reliable but no specific mention ── */}
        {reliableNoMention.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-1">
              <InfoIcon className="h-4 w-4" />
              {reliableNoMention.length} Reliable Source{reliableNoMention.length !== 1 ? 's' : ''} (No Specific Mention)
            </h3>
            <p className="text-xs text-gray-500 mb-2 italic">
              From reliable outlets, but the article doesn't appear to be specifically about your subject.
              These do <strong>not</strong> count toward notability.
            </p>
            <ul>
              {reliableNoMention.map((s, i) => <SourceRow key={i} source={s} />)}
            </ul>
          </section>
        )}

        {/* ── Section 3: Contextual mentions ── */}
        {contextual.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-yellow-700 mb-1">
              <InfoIcon className="h-4 w-4" />
              {contextual.length} Contextual Mention{contextual.length !== 1 ? 's' : ''}
            </h3>
            <p className="text-xs text-gray-500 mb-2 italic">
              Your subject is mentioned somewhere in the content but is not the focus of the piece.
              These count at half value for notability scoring.
            </p>
            <ul>
              {contextual.map((s, i) => <SourceRow key={i} source={s} />)}
            </ul>
          </section>
        )}

        {/* ── Section 4: Unreliable (includes press releases) ── */}
        {unreliable.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-1">
              <XCircle className="h-4 w-4" />
              {unreliable.length} Unreliable Source{unreliable.length !== 1 ? 's' : ''}
            </h3>
            <p className="text-xs text-gray-500 mb-2 italic">
              These do <strong>not</strong> count toward Wikipedia notability. This includes press release
              wires, business directories, social media, and low-editorial-standards sites.
              Sources flagged with ⚠️ are company-controlled and fail Wikipedia's independence requirement.
            </p>
            <ul>
              {unreliable.map((s, i) => <SourceRow key={i} source={s} />)}
            </ul>
          </section>
        )}

        {total === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No sources to display. Run a search first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
