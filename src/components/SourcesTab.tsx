import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, XCircle, InfoIcon } from 'lucide-react';
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

export function SourcesTab({ categorizedSources, sourcesList }: SourcesTabProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-lg font-medium mb-4">Source Analysis</div>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-2">How We Score Sources</h3>
          <p className="text-xs text-blue-700 mb-2">
            Our scoring system evaluates the reliability and independence of sources:
          </p>
          <ul className="text-xs text-blue-700 list-disc pl-5 space-y-1">
            <li><strong>Reliable sources with specific mention:</strong> 20 points each (diminishing returns per domain)</li>
            <li><strong>Sources with contextual mention:</strong> 7 points each</li>
            <li><strong>Reliable sources without specific mention:</strong> 3 points each</li>
            <li><strong>Diminishing returns:</strong> Each extra source from same domain gets 15% fewer points</li>
            <li><strong>Domain cap:</strong> Max 3 sources counted per domain</li>
            <li><strong>Press releases are excluded</strong> — only independent third-party coverage counts</li>
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            A score of 66–74 is borderline eligible. 75+ is strongly eligible for Wikipedia.
          </p>
        </div>

        <div className="text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="bg-green-50 p-3 rounded-md flex flex-col items-center">
              <span className="font-medium">{categorizedSources?.highlyReliable?.length || 0}</span>
              <span className="text-xs text-gray-500 text-center">Reliable (Specific Mention)</span>
            </div>
            <div className="bg-blue-50 p-3 rounded-md flex flex-col items-center">
              <span className="font-medium">{categorizedSources?.reliableNoMention?.length || 0}</span>
              <span className="text-xs text-gray-500 text-center">Reliable (No Mention)</span>
            </div>
            <div className="bg-yellow-50 p-3 rounded-md flex flex-col items-center">
              <span className="font-medium">{categorizedSources?.contextualMention?.length || 0}</span>
              <span className="text-xs text-gray-500 text-center">Contextual Mentions</span>
            </div>
            <div className="bg-red-50 p-3 rounded-md flex flex-col items-center">
              <span className="font-medium">{categorizedSources?.unreliable?.length || 0}</span>
              <span className="text-xs text-gray-500 text-center">Unreliable</span>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full mt-4">

            {categorizedSources?.highlyReliable && categorizedSources.highlyReliable.length > 0 && (
              <AccordionItem value="highlyReliable" className="border-b">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    {categorizedSources.highlyReliable.length} Reliable Sources (Specific Mention)
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mb-2 text-xs text-gray-600 italic">
                    These reliable sources specifically mention the full search term in title, URL, or description.
                    <strong className="block mt-1">These are the sources that count toward Wikipedia notability.</strong>
                  </div>
                  <ul className="text-xs space-y-2">
                    {categorizedSources.highlyReliable.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {categorizedSources?.reliableNoMention && categorizedSources.reliableNoMention.length > 0 && (
              <AccordionItem value="reliableNoMention" className="border-b">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center">
                    <InfoIcon className="h-4 w-4 mr-2 text-blue-500" />
                    {categorizedSources.reliableNoMention.length} Reliable Sources (No Specific Mention)
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mb-2 text-xs text-gray-600 italic">
                    These come from reliable domains but don't appear to be specifically about the search term.
                    <strong className="block mt-1">These are not counted toward Wikipedia notability.</strong>
                  </div>
                  <ul className="text-xs space-y-2">
                    {categorizedSources.reliableNoMention.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {categorizedSources?.contextualMention && categorizedSources.contextualMention.length > 0 && (
              <AccordionItem value="contextualMention" className="border-b">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center">
                    <InfoIcon className="h-4 w-4 mr-2 text-yellow-500" />
                    {categorizedSources.contextualMention.length} Contextual Mentions
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mb-2 text-xs text-gray-600 italic">
                    These may mention the topic in content but not prominently in title, URL or description.
                    <strong className="block mt-1">These count for partial credit toward Wikipedia notability.</strong>
                  </div>
                  <ul className="text-xs space-y-2">
                    {categorizedSources.contextualMention.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {categorizedSources?.unreliable && categorizedSources.unreliable.length > 0 && (
              <AccordionItem value="unreliable" className="border-b">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center">
                    <XCircle className="h-4 w-4 mr-2 text-red-500" />
                    {categorizedSources.unreliable.length} Unreliable Sources
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mb-2 text-xs text-gray-600 italic">
                    These sources are not considered reliable for Wikipedia citations.
                    <strong className="block mt-1">These do not count toward Wikipedia notability.</strong>
                  </div>
                  <ul className="text-xs space-y-2">
                    {categorizedSources.unreliable.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
}
