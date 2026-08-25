import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { SourceVerdict, ReliabilityTier } from '@/utils/sourceEvaluation';

/**
 * Renders per-source verdicts with the policy reasoning attached.
 *
 * Shared by the entity analyser's Sources tab and the standalone source checker
 * so both present identical judgements.
 */

const TIER_LABEL: Record<ReliabilityTier, string> = {
  tier1: 'Top-tier outlet',
  reliable: 'Generally reliable',
  situational: 'No consensus',
  unreliable: 'Generally unreliable',
  deprecated: 'Deprecated',
  unknown: 'Not on the perennial list',
};

const TIER_CLASS: Record<ReliabilityTier, string> = {
  tier1: 'bg-emerald-100 text-emerald-800',
  reliable: 'bg-green-100 text-green-800',
  situational: 'bg-amber-100 text-amber-800',
  unreliable: 'bg-red-100 text-red-800',
  deprecated: 'bg-red-200 text-red-900',
  unknown: 'bg-gray-100 text-gray-700',
};

function StatusIcon({ status }: { status: SourceVerdict['status'] }) {
  if (status === 'counts') return <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />;
  if (status === 'partial') return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />;
  return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />;
}

export function SourceVerdictRow({ verdict }: { verdict: SourceVerdict }) {
  const borderClass =
    verdict.status === 'counts'
      ? 'border-green-200 bg-green-50/50'
      : verdict.status === 'partial'
        ? 'border-amber-200 bg-amber-50/50'
        : 'border-red-200 bg-red-50/40';

  return (
    <div className={`border rounded-md p-3 ${borderClass}`}>
      <div className="flex items-start gap-2">
        <StatusIcon status={verdict.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-medium text-sm">{verdict.headline}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${TIER_CLASS[verdict.tier]}`}>
              {TIER_LABEL[verdict.tier]}
            </span>
            {!verdict.independent && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                Not independent
              </span>
            )}
            {verdict.independent && !verdict.secondary && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                Primary source
              </span>
            )}
          </div>

          <a
            href={verdict.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline break-all inline-flex items-start gap-1"
          >
            {verdict.url}
            <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5" />
          </a>

          {verdict.failures.length > 0 && (
            <ul className="mt-2 space-y-1">
              {verdict.failures.map((f, i) => (
                <li key={i} className="text-xs text-gray-700">
                  <span className="font-mono text-[10px] bg-gray-200 text-gray-800 px-1 py-0.5 rounded mr-1">
                    {f.policy}
                  </span>
                  {f.detail}
                </li>
              ))}
            </ul>
          )}

          {verdict.notes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {verdict.notes.map((n, i) => (
                <li key={i} className="text-xs text-gray-500 italic">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function SourceVerdictList({
  verdicts,
  emptyMessage = 'Nothing in this group.',
}: {
  verdicts: SourceVerdict[];
  emptyMessage?: string;
}) {
  if (!verdicts.length) {
    return <p className="text-xs text-gray-500 italic py-2">{emptyMessage}</p>;
  }
  return (
    <div className="space-y-2">
      {verdicts.map((v, i) => (
        <SourceVerdictRow key={`${v.url}-${i}`} verdict={v} />
      ))}
    </div>
  );
}
